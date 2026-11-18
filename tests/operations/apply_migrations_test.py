import importlib.util
import json
import unittest.mock
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('apply_migrations', ROOT / 'scripts/apply_migrations.py')
am = importlib.util.module_from_spec(spec)
spec.loader.exec_module(am)


class PureLogicTest(unittest.TestCase):
    def test_suffix_parsing_accepts_exact_names_and_rejects_bad_input(self):
        self.assertEqual(
            am.parse_suffixes('0073_credential_must_change.sql,0074_tenant_settings.sql'),
            ['0073_credential_must_change.sql', '0074_tenant_settings.sql'],
        )
        for bad in ('', '0073.sql', '0073_credential_must_change.sql,0073_credential_must_change.sql',
                    'not-a-file.txt', '0073_credential_must_change.sql,', '  ,  '):
            with self.assertRaises(RuntimeError):
                am.parse_suffixes(bad)

    def test_candidate_sha_must_be_40_lowercase_hex(self):
        am.validate_candidate_sha('f' * 40)
        for bad in ('F' * 40, 'f' * 39, 'f' * 41, 'zzzz', ''):
            with self.assertRaises(RuntimeError):
                am.validate_candidate_sha(bad)

    def test_approval_window_and_release_approval_shape(self):
        now = datetime(2026, 11, 18, 16, 0, 0, tzinfo=timezone.utc)
        approval = am.build_release_approval('f' * 40, ['a.sql', 'b.sql'], 'owner', now)
        self.assertEqual(approval['release_sha'], 'f' * 40)
        self.assertEqual(approval['approved_suffix'], ['a.sql', 'b.sql'])
        self.assertEqual(approval['approver'], 'owner')
        start = datetime.fromisoformat(approval['approved_at_utc'].replace('Z', '+00:00'))
        end = datetime.fromisoformat(approval['window_end_utc'].replace('Z', '+00:00'))
        self.assertEqual(end - start, timedelta(hours=6))
        self.assertLessEqual((end - start).total_seconds(), 12 * 3600)

    def test_write_fence_requires_stopped_state_and_settled_writes(self):
        fence = am.build_write_fence('01ef0e1fd34c724b21cfd470a41161687020ec5c',
                                     '2026-11-18T16:00:00Z', '2026-11-18T16:01:00Z',
                                     '2026-11-18T16:02:00Z')
        self.assertEqual(fence['method'], 'controlled_old_api_shutdown')
        self.assertTrue(fence['in_flight_settled'])
        self.assertEqual(fence['api_service_state'], 'stopped')
        self.assertEqual(fence['api_release_sha'], '01ef0e1fd34c724b21cfd470a41161687020ec5c')

    def test_dump_paths_are_timestamped_under_backup_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dump, sidecar = am.dump_paths(root, '20261118T160000Z')
            self.assertEqual(dump, root / 'wave2-20261118T160000Z.dump')
            self.assertEqual(sidecar, root / 'wave2-20261118T160000Z.dump.sha256')

    def test_postgres_env_extraction(self):
        user, db = am.parse_postgres_env(
            'POSTGRES_DB=kingturf\nOTHER=x\nPOSTGRES_USER=kingturf\n')
        self.assertEqual((user, db), ('kingturf', 'kingturf'))
        with self.assertRaises(RuntimeError):
            am.parse_postgres_env('POSTGRES_DB=kingturf\n')

    def test_expected_registry_assertions(self):
        am.require_registry([{'name': f'{i:04d}_x.sql'} for i in range(72)], 72, [])
        with self.assertRaisesRegex(RuntimeError, 'registry count'):
            am.require_registry([], 72, [])
        rows = [{'name': f'{i:04d}_x.sql'} for i in range(72)] + [{'name': '0073_a.sql'}]
        with self.assertRaisesRegex(RuntimeError, 'registry count'):
            am.require_registry(rows, 72, [])
        rows2 = [{'name': f'{i:04d}_x.sql'} for i in range(72)]
        with self.assertRaisesRegex(RuntimeError, 'already present'):
            am.require_registry(rows2, 72, ['0001_x.sql'])

    def test_pending_set_must_equal_approved_suffixes_exactly(self):
        plan = {'classification': 'MATCHED_PREFIX_PENDING',
                'pending': [{'name': '0074_b.sql'}, {'name': '0073_a.sql'}]}
        am.require_plan(plan, ['0073_a.sql', '0074_b.sql'])
        with self.assertRaisesRegex(RuntimeError, 'classification'):
            am.require_plan({'classification': 'FULLY_MATCHED', 'pending': []}, ['0073_a.sql'])
        with self.assertRaisesRegex(RuntimeError, 'pending'):
            am.require_plan(plan, ['0073_a.sql'])

    def test_staged_layout_validation_accepts_tree_and_rejects_missing_pieces(self):
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            staged = Path(temp)
            # Red first: directory-only staged (previous is_file() bug always failed here).
            (staged / 'migrations').mkdir()
            (staged / 'migrations' / '0073_a.sql').write_text('-- x')
            (staged / 'release_orchestrator.py').write_text('# o')
            (staged / 'production_preflight.py').write_text('# p')
            am.validate_staged_layout(staged, staged / 'migrations', 1, ['0073_a.sql'])
            (staged / 'release_orchestrator.py').unlink()
            with self.assertRaisesRegex(RuntimeError, 'staged file missing'):
                am.validate_staged_layout(staged, staged / 'migrations', 1, ['0073_a.sql'])
            (staged / 'release_orchestrator.py').write_text('# o')
            (staged / 'migrations' / '0073_a.sql').unlink()
            with self.assertRaisesRegex(RuntimeError, 'migrations count'):
                am.validate_staged_layout(staged, staged / 'migrations', 1, ['0073_a.sql'])
            (staged / 'migrations').rename(staged / 'not-migrations')
            with self.assertRaisesRegex(RuntimeError, 'staged migrations directory missing'):
                am.validate_staged_layout(staged, staged / 'migrations', 1, ['0073_a.sql'])

    def test_cli_validate_inputs_passes_on_valid_staged_tree(self):
        """End-to-end smoke for the fixed layout assertion: a valid staged tree must
        emit a validate-inputs PASS line (the is_file() bug and the names NameError
        both turned this into an early FAIL with no PASS line)."""
        import subprocess, sys
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            staged = root / 'staged'
            (staged / 'migrations').mkdir(parents=True)
            (staged / 'migrations' / '0073_a.sql').write_text('-- a')
            (staged / 'release_orchestrator.py').write_text('# orchestrator')
            (staged / 'production_preflight.py').write_text('# preflight')
            result = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/apply_migrations.py'),
                 '--candidate-sha', 'f' * 40, '--approved-suffixes', '0073_a.sql',
                 '--staged-root', str(staged), '--approver', 'test',
                 '--expected-after', '1', '--prod-root', str(root / 'prod')],
                capture_output=True, text=True, timeout=120)
            first = result.stdout.strip().splitlines()[0] if result.stdout.strip() else '{}'
            payload = json.loads(first)
            self.assertEqual(payload['step'], 'validate-inputs')
            self.assertEqual(payload['status'], 'PASS')
            self.assertEqual(payload['migrations'], 1)
            self.assertNotEqual(result.returncode, 0)  # fails later at host access, as designed
            self.assertNotIn('api-restored', result.stdout)  # fence never applied on this path
            self.assertNotIn('api-restore-failed', result.stdout)

    def test_scalar_joins_psql_session_row_list(self):
        class FakeSession:
            def query(self, sql):
                return ['0', '\n']          # PsqlSession returns a list of lines
        self.assertEqual(am.scalar(FakeSession(), 'SELECT 1;'), '0')
        class ListSession:
            def query(self, sql):
                return ['12']
        self.assertEqual(am.scalar(ListSession(), 'SELECT 1;'), '12')

    def test_require_zero_covers_task_drain_and_precondition_scalar_paths(self):
        class Zero:
            def query(self, sql):
                return ['0', '\n']
        class One:
            def query(self, sql):
                return ['1']
        am.require_zero(Zero(), 'SELECT 1;', 'label')
        with self.assertRaisesRegex(RuntimeError, 'label: 1'):
            am.require_zero(One(), 'SELECT 1;', 'label')

    def test_fence_text_transforms_are_inverse_and_idempotent(self):
        base = 'A=1\nKINGTURF_WRITE_FENCE=disabled\nB=2\n'
        enabled = am.enable_fence_text(base)
        self.assertIn('KINGTURF_WRITE_FENCE=enabled', enabled)
        self.assertEqual(am.disable_fence_text(enabled), base)
        self.assertEqual(am.enable_fence_text(enabled), enabled)
        with self.assertRaises(RuntimeError):
            am.enable_fence_text('no fence line')

    def test_wait_until_success_and_timeout(self):
        state = {'n': 0}

        def flaky():
            state['n'] += 1
            return state['n'] >= 3
        self.assertTrue(am.wait_until(flaky, attempts=5, delay=0))
        self.assertFalse(am.wait_until(lambda: False, attempts=3, delay=0))

    def test_version_matches_marker_compares_body_sha(self):
        import urllib.request, io
        class Reply:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self): return json.dumps({'sha': 'a' * 40}).encode()
        def fake_urlopen(url, timeout=15): return Reply()
        with unittest.mock.patch.object(urllib.request, 'urlopen', fake_urlopen):
            self.assertTrue(am.version_matches_marker('/version', 'a' * 40))
            self.assertFalse(am.version_matches_marker('/version', 'b' * 40))

    def test_version_matches_marker_swallows_transport_and_body_errors(self):
        import urllib.request
        def boom(url, timeout=15): raise OSError('down')
        with unittest.mock.patch.object(urllib.request, 'urlopen', boom):
            self.assertFalse(am.version_matches_marker('/version', 'a' * 40))
        class BadBody(Reply if False else object):
            status = 200
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self): return b'not-json'
        with unittest.mock.patch.object(urllib.request, 'urlopen', lambda url, timeout=15: BadBody()):
            self.assertFalse(am.version_matches_marker('/version', 'a' * 40))

    def test_drain_gate_four_states(self):
        """(1) scalar sum is fetched directly (never the constant-1 wrapper bug);
        (2) seed-era undelivered outbox is ignored by the in-flight gate but
        disclosed by the legacy count; (3) recent undelivered blocks;
        (4) a PENDING delivery blocks regardless of age."""
        inflight = am.inflight_drain_sql()
        legacy = am.legacy_undelivered_sql()
        # (1) the in-flight SQL is a direct scalar sum, not count(*) over a scalar
        self.assertTrue(inflight.startswith('SELECT coalesce(('))
        self.assertNotIn('SELECT count(*) FROM (SELECT', inflight)
        self.assertIn("interval '7 days'", inflight)
        # (2) legacy disclosure counts ALL undelivered, no time filter
        self.assertNotIn('interval', legacy)
        class ScalarSession:
            """Executes the exact SQL shapes against an in-table predicate."""
            def __init__(self, results): self.results = results; self.queries = []
            def query(self, sql):
                self.queries.append(sql)
                if "interval '7 days'" in sql:
                    return [str(self.results['recent'] + self.results['deliveries'])]
                return [str(self.results['legacy'])]
        # seed-era only: gate passes, legacy disclosed as 164
        session = ScalarSession({'recent': 0, 'deliveries': 0, 'legacy': 164})
        am.require_zero(session, inflight, 'background queues have in-flight work')
        self.assertEqual(am.scalar(session, legacy), '164')
        # recent undelivered: gate blocks
        blocked = ScalarSession({'recent': 1, 'deliveries': 0, 'legacy': 164})
        with self.assertRaisesRegex(RuntimeError, 'in-flight'):
            am.require_zero(blocked, inflight, 'background queues have in-flight work')
        # PENDING delivery blocks regardless of age
        pending = ScalarSession({'recent': 0, 'deliveries': 2, 'legacy': 164})
        with self.assertRaisesRegex(RuntimeError, 'in-flight'):
            am.require_zero(pending, inflight, 'background queues have in-flight work')


if __name__ == '__main__':
    unittest.main()
