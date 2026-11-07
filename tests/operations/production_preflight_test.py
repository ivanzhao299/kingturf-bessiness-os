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
        self.actual = [{'name': name, 'checksum': value} for name, value in self.expected.items()]
        self.mount = '/data'
        self.healthy = True
        self.api_running = True
        self.live_source = self.pg
        self.version = self.marker
        self.config = {'name': gate.PROJECT, 'services': {
            'postgres': {'volumes': [{'type': 'bind', 'source': str(self.pg), 'target': '/var/lib/postgresql/data'}]},
            'api': {'image': 'ghcr.io/x/api@sha256:' + 'a' * 64, 'volumes': [{'type': 'bind', 'source': str(self.files), 'target': '/var/lib/kingturf/attachments'}], 'environment': {'DATABASE_URL': 'synthetic-sensitive-url', 'SESSION_SECRET': 'x' * 32, 'WEBSITE_LEAD_INGEST_SECRET': 'y' * 32}},
            'web': {'image': 'ghcr.io/x/web@sha256:' + 'b' * 64, 'ports': [{'published': '4332'}]},
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
            running = self.api_running if service == 'api' else True
            return json.dumps([{'State': {'Running': running, 'Health': {'Status': 'healthy' if self.healthy else 'unhealthy'}}, 'Mounts': [] if service == 'web' else [{'Type': 'bind', 'Source': str(source), 'Destination': target}]}])
        if 'exec' in args:
            self.assertIn('BEGIN READ ONLY', text)
            for forbidden in ('INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'CREATE '): self.assertNotIn(forbidden, text)
            return json.dumps(self.actual)
        raise AssertionError('Unexpected inventory command')

    def run_gate(self, *, require_full=False, allow_stopped_api=False):
        original_stat = os.stat
        self.urlopen_calls = []
        def stat(path, *args, **kwargs):
            return original_stat(self.root if str(path) == '/data' else path, *args, **kwargs)
        def urlopen(*args, **kwargs):
            self.urlopen_calls.append(args)
            return io.BytesIO(json.dumps({'sha': self.version}).encode())
        output = io.StringIO()
        with patch.object(gate, 'RELEASE', self.root), patch.object(gate, 'POSTGRES', self.pg), patch.object(gate, 'ATTACHMENTS', self.files), patch.object(gate, 'command', self.command), patch.object(gate.os, 'stat', stat), patch.object(gate.shutil, 'disk_usage', return_value=SimpleNamespace(free=self.free)), patch.object(gate.urllib.request, 'urlopen', urlopen), contextlib.redirect_stdout(output):
            gate.preflight(str(self.root), self.expected, require_full=require_full, allow_stopped_api=allow_stopped_api)
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
        self.actual[0]['checksum'] = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'migration checksums'): self.run_gate()

    def test_matched_prefix_pending_classifies_and_reports_pending_suffix(self):
        self.expected = {'0001_fixture.sql': 'a' * 64, '0002_fixture.sql': 'b' * 64, '0003_fixture.sql': 'c' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'a' * 64}, {'name': '0002_fixture.sql', 'checksum': 'b' * 64}]
        result = json.loads(self.run_gate())
        self.assertEqual(result['registry_classification'], 'MATCHED_PREFIX_PENDING')
        self.assertEqual(result['applied'], 2)
        self.assertEqual(result['pending'], [{'name': '0003_fixture.sql', 'checksum': 'c' * 64}])

    def test_fully_matched_registry_passes_with_empty_pending(self):
        self.expected = {'0001_fixture.sql': 'a' * 64, '0002_fixture.sql': 'b' * 64}
        self.actual = [{'name': name, 'checksum': value} for name, value in self.expected.items()]
        result = json.loads(self.run_gate())
        self.assertEqual(result['registry_classification'], 'FULLY_MATCHED')
        self.assertEqual(result['pending'], [])

    def test_require_full_mode_rejects_pending_suffix(self):
        self.expected = {'0001_fixture.sql': 'a' * 64, '0002_fixture.sql': 'b' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'a' * 64}]
        with self.assertRaisesRegex(RuntimeError, 'FULLY_MATCHED'): self.run_gate(require_full=True)

    def test_missing_middle_migration_blocks(self):
        self.expected = {'0001_fixture.sql': 'a' * 64, '0002_fixture.sql': 'b' * 64, '0003_fixture.sql': 'c' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'a' * 64}, {'name': '0003_fixture.sql', 'checksum': 'c' * 64}]
        with self.assertRaisesRegex(RuntimeError, 'MIGRATION_HISTORY_GAP'): self.run_gate()

    def test_unknown_extra_migration_blocks(self):
        self.expected = {'0001_fixture.sql': 'a' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'a' * 64}, {'name': '0004_unknown.sql', 'checksum': 'd' * 64}]
        with self.assertRaisesRegex(RuntimeError, 'UNKNOWN_EXTRA_MIGRATION'): self.run_gate()

    def test_duplicate_registry_rows_block(self):
        self.expected = {'0001_fixture.sql': 'a' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'a' * 64}, {'name': '0001_fixture.sql', 'checksum': 'a' * 64}]
        with self.assertRaisesRegex(RuntimeError, 'DUPLICATE_MIGRATION'): self.run_gate()

    def test_malformed_registry_row_blocks(self):
        self.expected = {'0001_fixture.sql': 'a' * 64}
        self.actual = [{'name': '0001_fixture.sql', 'checksum': 'short'}]
        with self.assertRaisesRegex(RuntimeError, 'INVALID_REGISTRY'): self.run_gate()

    def test_out_of_order_manifest_is_rejected(self):
        self.expected = {'0001_a.sql': 'a' * 64, '0001_b.sql': 'b' * 64}
        with self.assertRaisesRegex(RuntimeError, 'strictly ordered'): self.run_gate()

    def test_hostile_migration_name_is_rejected_by_charset_rule(self):
        self.expected = {"0001_x'); DELETE FROM schema_migrations;--.sql": 'a' * 64}
        with self.assertRaisesRegex(RuntimeError, 'Invalid candidate migration manifest'): self.run_gate()

    def test_missing_security_configuration_blocks(self):
        self.config['services']['api']['environment']['SESSION_SECRET'] = ''
        with self.assertRaisesRegex(RuntimeError, 'configuration missing'): self.run_gate()

    def test_mutable_image_tag_blocks(self):
        self.config['services']['api']['image'] = 'ghcr.io/x/api:latest'
        with self.assertRaisesRegex(RuntimeError, 'digest-pinned'): self.run_gate()

    def test_malformed_digest_references_block(self):
        for image in (
            'ghcr.io/x/api@sha256:' + 'a' * 63,                      # too short
            'ghcr.io/x/api@sha256:' + 'a' * 65,                      # too long
            'ghcr.io/x/api@sha256:' + 'a' * 64 + 'x',                # trailing garbage
            'ghcr.io/x/api@sha256:' + 'a' * 32 + '@sha256:' + 'b' * 64,  # double digest segment
            'ghcr.io/x/api@' + 'a' * 64,                             # algorithm prefix missing
        ):
            with self.subTest(image=image[-12:]):
                self.config['services']['api']['image'] = image
                with self.assertRaisesRegex(RuntimeError, 'digest-pinned'): self.run_gate()

    def test_unhealthy_service_blocks(self):
        self.healthy = False
        with self.assertRaisesRegex(RuntimeError, 'not healthy'): self.run_gate()

    def test_insufficient_space_blocks(self):
        self.free = 1024
        with self.assertRaisesRegex(RuntimeError, 'free-space floor'): self.run_gate()

    def test_failed_rollout_marker_mismatch_blocks_blind_retry(self):
        self.version = 'c' * 40
        with self.assertRaisesRegex(RuntimeError, 'disagrees'): self.run_gate()

    def test_stopped_api_blocks_without_window_mode(self):
        self.api_running = False
        with self.assertRaisesRegex(RuntimeError, 'not healthy'): self.run_gate()

    def test_window_mode_allows_stopped_api_and_skips_version_probe(self):
        self.api_running = False
        self.version = 'c' * 40  # would disagree with the marker if probed at all
        result = self.run_gate(allow_stopped_api=True)
        payload = json.loads(result)
        self.assertEqual(payload['preflight'], 'PASS')
        self.assertEqual(payload['previous_sha'], self.marker)
        self.assertIn('skipped', payload['version_probe'])
        self.assertEqual(self.urlopen_calls, [])

    def test_window_mode_still_requires_running_healthy_postgres_and_web(self):
        self.api_running = False
        self.healthy = False  # postgres is inspected first and must stay healthy
        with self.assertRaisesRegex(RuntimeError, 'not healthy'): self.run_gate(allow_stopped_api=True)

    def test_window_mode_running_api_still_requires_health(self):
        self.api_running = True
        self.healthy = False
        with self.assertRaisesRegex(RuntimeError, 'not healthy'): self.run_gate(allow_stopped_api=True)

    def test_unknown_preflight_flag_is_rejected(self):
        probe = subprocess.run([sys.executable, str(ROOT / 'scripts/production_preflight.py'), '/data/kingturf-erp', base64.b64encode(b'{}').decode(), '--allow-build'], capture_output=True, text=True)
        self.assertNotEqual(probe.returncode, 0)
        self.assertIn('unknown preflight flag', probe.stderr)

    def test_manifest_mode_reads_all_current_migration_files_without_production_calls(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/production_preflight.py'), '--manifest', str(ROOT / 'packages/database/migrations')], capture_output=True, text=True, check=True)
        manifest = json.loads(base64.b64decode(result.stdout, validate=False))
        self.assertEqual(len(manifest), 72)
        self.assertEqual(sorted(manifest)[-1], '0072_production_return_guards.sql')
        self.assertIn('0070_business_document_communications.sql', manifest)
        self.assertTrue(all(len(value) == 64 for value in manifest.values()))


if __name__ == '__main__': unittest.main()
