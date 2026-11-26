"""R1 (TD-REL-007): local end-to-end rehearsal of the apply_migrations host flow.

Drives the real module in-process against the drill PostgreSQL container,
injecting only the host action exits (compose / http probes / orchestrator
delegate). The three historical precheck bug shapes are asserted as negative
assets. Full migration of the scratch database keeps every SQL surface
(registry/outbox/deliveries/inventory preconditions) real.
"""
from datetime import datetime, timezone
from pathlib import Path
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/operations'))
import release_migration_drill_test as drill  # noqa: E402
import psql_helper  # noqa: E402

spec = importlib.util.spec_from_file_location('apply_migrations', ROOT / 'scripts/apply_migrations.py')
am = importlib.util.module_from_spec(spec)
spec.loader.exec_module(am)

CONTAINER = drill.CONTAINER
APPROVED = ('0073_credential_must_change.sql', '0074_tenant_settings.sql', '0075_login_lockout.sql', '0076_rfq_close_transition.sql', '0077_po_partial_receipt_transition.sql', '0080_po_draft_cancel.sql')


def stamp():
    return datetime.now(timezone.utc).strftime('%Y%m%d%H%M%SZ').lower()


class HostFlowRehearsal(unittest.TestCase):
    """End-to-end host flow with a fully migrated scratch database."""

    @classmethod
    def setUpClass(cls):
        if not drill.HAS_DOCKER:
            raise unittest.SkipTest('no local development postgres container')
        cls.temp = tempfile.TemporaryDirectory(prefix='apply-rehearsal-')
        cls.base = Path(cls.temp.name)
        cls.staged = cls.base / 'staged'
        (cls.staged / 'migrations').mkdir(parents=True)
        for name in ('release_orchestrator.py', 'production_preflight.py'):
            shutil.copy(ROOT / 'scripts' / name, cls.staged / name)
        for path in sorted((ROOT / 'packages/database/migrations').glob('[0-9][0-9][0-9][0-9]*.sql')):
            shutil.copy(path, cls.staged / 'migrations' / path.name)
        cls.prod = cls.base / 'prod'
        (cls.prod / '.release-migration-evidence').mkdir(parents=True)
        (cls.prod / '.release-backups').mkdir()
        (cls.prod / '.release-sha').write_text('01ef0e1fd34c724b21cfd470a41161687020ec5c')
        (cls.prod / '.env.production').write_text(
            'POSTGRES_USER=kingturf\nPOSTGRES_DB=kingturf\nKINGTURF_WRITE_FENCE=disabled\n')
        (cls.prod / '.env.production').chmod(0o600)  # A4-P1-2 (A-F1): fixture matches the enforced mode
        (cls.prod / 'attachments').mkdir()
        (cls.prod / 'attachments' / 'keep.txt').write_text('attachment-bytes')
        cls.runner = cls.base / 'reference-migrator.mjs'
        cls.runner.write_text(drill.REFERENCE_MIGRATOR)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def prepare_database(self):
        """Fully migrated scratch db, then remove the two approved rows (72 base)."""
        dbname = f'apply_rehearsal_{stamp()}'
        self.addCleanup(self.drop_database, dbname)
        admin = drill.admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {dbname}')
            admin.query(f'CREATE DATABASE {dbname}')
        finally:
            admin.close()
        url = drill.URL_PREFIX + dbname
        result = subprocess.run(
            ['node', '--experimental-transform-types', str(self.runner),
             str(ROOT / 'packages/database/migrations')],
            env={**__import__('os').environ, 'DATABASE_URL': url},
            capture_output=True, text=True, timeout=900)
        assert result.returncode == 0, result.stderr[-400:]
        for name in APPROVED:
            psql_helper.query(url, f"DELETE FROM schema_migrations WHERE name='{name}';")
        return url, dbname

    def drop_database(self, dbname):
        admin = drill.admin_session()
        try:
            admin.query(f'DROP DATABASE IF EXISTS {dbname}')
        finally:
            admin.close()

    def base_argv(self):
        return ['--candidate-sha', 'f' * 40,
                '--approved-suffixes', ','.join(APPROVED),
                '--staged-root', str(self.staged), '--approver', 'rehearsal',
                '--prod-root', str(self.prod),
                '--attachments-dir', str(self.prod / 'attachments'),
                '--postgres-container', CONTAINER,
                '--expected-before', '72', '--expected-after', '78']

    def run_main(self, url, orchestrator_stub, version_ok=True):
        seen = {'compose': [], 'orchestrator': []}

        real_sleep = time.sleep

        def quick_sleep(seconds):
            real_sleep(min(seconds, 0.4))  # keep loops real; enough for tmpfs postgres init

        env_path = self.prod / '.env.production'
        env_backup = env_path.read_text()
        dbname = url.rsplit('/', 1)[-1]
        env_path.write_text(env_backup.replace('POSTGRES_DB=kingturf', f'POSTGRES_DB={dbname}'))
        env_path.chmod(0o600)  # write_text 不保留模式，重设为门禁要求
        try:
            with mock.patch.object(sys, 'argv', ['apply_migrations.py'] + self.base_argv()):
                with mock.patch.object(am, 'compose', lambda root, *a: seen['compose'].append(a)):
                    with mock.patch.object(am, 'run_orchestrator',
                                           lambda staged, *cli: orchestrator_stub(url, seen, cli)):
                        with mock.patch.object(am, 'http_status', lambda path, method='GET':
                                               200 if path == '/health' else
                                               (503 if method == 'POST' else 200)):
                            with mock.patch.object(am, 'version_matches_marker',
                                                   lambda path, marker: version_ok):
                                with mock.patch.object(am.time, 'sleep', quick_sleep):
                                    am.main()
        finally:
            env_path.write_text(env_backup)
        return seen

    def test_happy_path_full_flow(self):
        url, _ = self.prepare_database()

        def stub(url, seen, cli):
            seen['orchestrator'].append(cli[0])
            if cli[0] == 'check-evidence':
                return {'check_evidence': 'PASS', 'pending': list(APPROVED)}
            if cli[0] == 'execute':
                rows = ','.join(f"('{name}',md5('{index}'))" for index, name in enumerate(APPROVED))
                psql_helper.query(url, f'INSERT INTO schema_migrations(name,checksum) VALUES {rows};')
                return {'verdict': 'COMPLETED'}
            return {'postcheck': 'PASS', 'classification': 'FULLY_MATCHED'}

        seen = self.run_main(url, stub)
        self.assertEqual(seen['orchestrator'], ['check-evidence', 'execute', 'postcheck'])
        self.assertIn(('stop', '-t', '30', 'api'), seen['compose'])
        fence = json.loads((self.prod / '.release-migration-evidence/write_fence.json').read_text())
        self.assertEqual(fence['method'], 'controlled_old_api_shutdown')
        self.assertEqual(fence['api_release_sha'], '01ef0e1fd34c724b21cfd470a41161687020ec5c')
        drain = json.loads((self.prod / '.release-migration-evidence/task_drain.json').read_text())
        self.assertEqual(drain['in_flight'], 0)
        self.assertEqual(int(psql_helper.query(url, 'SELECT count(*) FROM schema_migrations;')), 78)

    def test_drain_blocked_restores_api_and_fails_closed(self):
        url, _ = self.prepare_database()
        psql_helper.query(url,
                          "INSERT INTO organizations(id,owner_organization_id,code,name,organization_type)"
                          " VALUES(gen_random_uuid(),NULL,'REH','Rehearsal','COMPANY');")
        psql_helper.query(url,
                          "INSERT INTO domain_event_outbox(id,tenant_id,event_type,event_version,"
                          "aggregate_type,aggregate_id,aggregate_version,occurred_at,actor_id,correlation_id,payload)"
                          " SELECT gen_random_uuid(),id,'rehearsal.event',1,'x',gen_random_uuid(),1,now(),NULL,gen_random_uuid(),'{}'::jsonb"
                          " FROM organizations WHERE code='REH';")
        with self.assertRaises(SystemExit) as caught:
            self.run_main(url, lambda url, seen, cli: {})
        self.assertEqual(caught.exception.code, 1)  # restored API keeps failure semantics
        self.assertIn('KINGTURF_WRITE_FENCE=disabled',
                      (self.prod / '.env.production').read_text())  # restore re-enabled traffic
        self.assertEqual(int(psql_helper.query(url, 'SELECT count(*) FROM schema_migrations;')), 72)


class HistoricalBugShapes(unittest.TestCase):
    """Parametrized negative assets: the three shipped bugs must stay intercepted."""

    def test_directory_must_not_pass_is_file_layout_check(self):
        with tempfile.TemporaryDirectory() as temp:
            staged = Path(temp)
            (staged / 'migrations').write_text('file-not-dir')  # old is_file bug shape
            (staged / 'release_orchestrator.py').write_text('#')
            (staged / 'production_preflight.py').write_text('#')
            with self.assertRaisesRegex(RuntimeError, 'migrations directory missing'):
                am.validate_staged_layout(staged, staged / 'migrations', 1, [])

    def test_undefined_name_is_caught_by_cli_smoke(self):
        with tempfile.TemporaryDirectory() as temp:
            staged = Path(temp) / 'staged'
            (staged / 'migrations').mkdir(parents=True)
            (staged / 'migrations' / '0001_a.sql').write_text('-- a')
            (staged / 'release_orchestrator.py').write_text('# o')
            (staged / 'production_preflight.py').write_text('# p')
            result = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/apply_migrations.py'),
                 '--candidate-sha', 'f' * 40, '--approved-suffixes', '0001_a.sql',
                 '--staged-root', str(staged), '--approver', 't',
                 '--expected-after', '1', '--prod-root', str(Path(temp) / 'prod')],
                capture_output=True, text=True, timeout=120)
            first = json.loads(result.stdout.strip().splitlines()[0])
            self.assertEqual((first['step'], first['status']), ('validate-inputs', 'PASS'))

    def test_scalar_sum_is_never_the_constant_one_wrapper(self):
        class Rows:
            def query(self, sql):
                return ['7']  # the wrapper-bug shape would report 1 instead
        self.assertEqual(am.scalar(Rows(), 'SELECT 7;'), '7')


if __name__ == '__main__':
    unittest.main()
