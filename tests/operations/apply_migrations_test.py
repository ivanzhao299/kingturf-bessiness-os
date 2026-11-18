import importlib.util
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


if __name__ == '__main__':
    unittest.main()
