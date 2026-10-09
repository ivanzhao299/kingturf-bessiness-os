import base64
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('production_preflight', ROOT / 'scripts/production_preflight.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class ProductionPreflightTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kingturf-preflight-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pg = self.root / 'postgres'
        self.files = self.root / 'attachments'
        self.pg.mkdir(); self.files.mkdir()
        self.marker = 'b' * 40
        (self.root / '.release-sha').write_text(self.marker)
        self.expected = {'0001_fixture.sql': 'a' * 64}
        self.actual = dict(self.expected)
        self.mount = '/data'
        self.healthy = True
        self.live_source = self.pg
        self.version = self.marker
        self.config = {'name': gate.PROJECT, 'services': {
            'postgres': {'volumes': [{'type': 'bind', 'source': str(self.pg), 'target': '/var/lib/postgresql/data'}]},
            'api': {'volumes': [{'type': 'bind', 'source': str(self.files), 'target': '/var/lib/kingturf/attachments'}], 'environment': {'DATABASE_URL': 'synthetic-sensitive-url', 'SESSION_SECRET': 'x' * 32, 'WEBSITE_LEAD_INGEST_SECRET': 'y' * 32}},
            'web': {'ports': [{'published': '4332'}]},
        }}
        self.calls = []
        self.free = 20 * 1024 ** 3

    def command(self, args, *, text=None):
        self.calls.append(args)
        if args[0] == 'findmnt': return self.mount
        if 'config' in args: return json.dumps(self.config)
        if 'container' in args:
            return next(x.split('=')[-1] for x in args if x.startswith('label=com.docker.compose.service='))
        if 'inspect' in args:
            service = args[-1]
            target = '/var/lib/postgresql/data' if service == 'postgres' else '/var/lib/kingturf/attachments'
            source = self.live_source if service == 'postgres' else self.files
            return json.dumps([{'State': {'Running': True, 'Health': {'Status': 'healthy' if self.healthy else 'unhealthy'}}, 'Mounts': [] if service == 'web' else [{'Type': 'bind', 'Source': str(source), 'Destination': target}]}])
        if 'exec' in args:
            self.assertIn('BEGIN READ ONLY', text)
            for forbidden in ('INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'CREATE '): self.assertNotIn(forbidden, text)
            return json.dumps(self.actual)
        raise AssertionError('Unexpected inventory command')

    def run_gate(self):
        original_stat = os.stat
        def stat(path, *args, **kwargs):
            return original_stat(self.root if str(path) == '/data' else path, *args, **kwargs)
        output = io.StringIO()
        with patch.object(gate, 'RELEASE', self.root), patch.object(gate, 'POSTGRES', self.pg), patch.object(gate, 'ATTACHMENTS', self.files), patch.object(gate, 'command', self.command), patch.object(gate.os, 'stat', stat), patch.object(gate.shutil, 'disk_usage', return_value=SimpleNamespace(free=self.free)), patch.object(gate.urllib.request, 'urlopen', return_value=io.BytesIO(json.dumps({'sha': self.version}).encode())), contextlib.redirect_stdout(output):
            gate.preflight(str(self.root), self.expected)
        return output.getvalue()

    def test_healthy_inventory_is_readonly_and_does_not_claim_restore(self):
        result = self.run_gate()
        self.assertEqual(json.loads(result)['preflight'], 'PASS')
        self.assertEqual(json.loads(result)['restore'], 'REQUIRES_INDEPENDENT_EVIDENCE')
        self.assertNotIn('synthetic-sensitive-url', result)
        for args in self.calls:
            self.assertFalse(any(x in args for x in ['up', 'rm', 'restart', 'down', 'pg_restore', 'pg_dump']))

    def test_unmounted_data_disk_blocks_before_compose(self):
        self.mount = '/'
        with self.assertRaisesRegex(RuntimeError, 'actual mounted'): self.run_gate()
        self.assertEqual(len(self.calls), 1)

    def test_named_volume_fallback_is_rejected(self):
        self.config['services']['postgres']['volumes'][0]['type'] = 'volume'
        with self.assertRaisesRegex(RuntimeError, 'approved bind'): self.run_gate()

    def test_actual_container_mount_must_match_configuration(self):
        self.live_source = self.root / 'wrong'
        with self.assertRaisesRegex(RuntimeError, 'Live persistent mount'): self.run_gate()

    def test_schema_drift_blocks_before_runtime_promotion(self):
        self.actual['0001_fixture.sql'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'migration checksums'): self.run_gate()

    def test_missing_security_configuration_blocks(self):
        self.config['services']['api']['environment']['SESSION_SECRET'] = ''
        with self.assertRaisesRegex(RuntimeError, 'configuration missing'): self.run_gate()

    def test_unhealthy_service_blocks(self):
        self.healthy = False
        with self.assertRaisesRegex(RuntimeError, 'not healthy'): self.run_gate()

    def test_insufficient_space_blocks(self):
        self.free = 1024
        with self.assertRaisesRegex(RuntimeError, 'free-space floor'): self.run_gate()

    def test_failed_rollout_marker_mismatch_blocks_blind_retry(self):
        self.version = 'c' * 40
        with self.assertRaisesRegex(RuntimeError, 'disagrees'): self.run_gate()

    def test_manifest_mode_reads_all_current_migration_files_without_production_calls(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/production_preflight.py'), '--manifest', str(ROOT / 'packages/database/migrations')], capture_output=True, text=True, check=True)
        manifest = json.loads(base64.b64decode(result.stdout, validate=False))
        self.assertEqual(len(manifest), 70)
        self.assertEqual(sorted(manifest)[-1], '0070_business_document_communications.sql')
        self.assertTrue(all(len(value) == 64 for value in manifest.values()))


if __name__ == '__main__': unittest.main()
