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


class OrchestratorIsolationTest(unittest.TestCase):
    def test_real_child_receives_isolated_flag_and_the_original_cli_arguments(self):
        import sys
        from unittest import mock
        with tempfile.TemporaryDirectory() as temp:
            staged = Path(temp)
            completed = mock.Mock(returncode=0, stdout='{"verdict":"COMPLETED"}', stderr='')
            with mock.patch.object(am.subprocess, 'run', return_value=completed) as run:
                self.assertEqual(am.run_orchestrator(staged, 'execute', 'plan with spaces.json', '--strict'), {'verdict': 'COMPLETED'})
            self.assertEqual(run.call_args.args[0], [sys.executable, '-I', str(staged / 'release_orchestrator.py'), 'execute', 'plan with spaces.json', '--strict'])
            self.assertEqual(run.call_args.kwargs, {'capture_output': True, 'text': True, 'timeout': 1800})

    def test_real_child_ignores_poisoned_pythonpath_and_staging_imports(self):
        import os
        from unittest import mock
        for location in ('environment', 'script directory'):
            with self.subTest(poison=location), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                staged, poison = root / 'staged', root / 'poison'
                staged.mkdir()
                poison.mkdir()
                target = poison if location == 'environment' else staged
                (target / 'decimal.py').write_text("raise RuntimeError('untrusted decimal import executed')\n")
                (staged / 'release_orchestrator.py').write_text(
                    "import decimal,json,sys\n"
                    "print(json.dumps({'isolated':sys.flags.isolated,'ignore_environment':sys.flags.ignore_environment,'no_user_site':sys.flags.no_user_site,'decimal':str(decimal.Decimal('1.25')),'argv':sys.argv[1:]}))\n")
                with mock.patch.dict(os.environ, PYTHONPATH=str(poison)):
                    result = am.run_orchestrator(staged, 'plan', 'input with spaces.json')
                self.assertEqual(result, {'isolated': 1, 'ignore_environment': 1, 'no_user_site': 1,
                                          'decimal': '1.25', 'argv': ['plan', 'input with spaces.json']})

    def test_real_child_nonzero_exit_is_still_a_failed_orchestrator(self):
        with tempfile.TemporaryDirectory() as temp:
            staged = Path(temp)
            (staged / 'release_orchestrator.py').write_text('import sys\nsys.exit(7)\n')
            with self.assertRaisesRegex(RuntimeError, 'orchestrator failed'):
                am.run_orchestrator(staged, 'execute', 'plan.json')


class ApiStopBindingTest(unittest.TestCase):
    """TD-REL-013: execute the real host flow up to drain with controlled Docker."""

    def flow(self, *, after_probe=None, after_up=None, replace_at_stop=False):
        import contextlib
        import copy
        import hashlib
        import io
        import sys
        from unittest import mock
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            staged = root / 'staged'
            (staged / 'migrations').mkdir(parents=True)
            for name in ('0001_base.sql', '0002_next.sql'):
                (staged / 'migrations' / name).write_text('SELECT 1;')
            (staged / 'production_preflight.py').write_text('# synthetic layout fixture')
            (staged / 'release_orchestrator.py').write_text(
                "class PsqlSession:\n def __init__(self, argv): pass\n def close(self): pass\n"
                "def read_registry(session): return [{'name':'0001_base.sql','checksum':'a'*64}]\n"
                "def build_plan(*args): return {'classification':'MATCHED_PREFIX_PENDING','pending':[{'name':'0002_next.sql'}]}\n")
            prod = root / 'prod'
            prod.mkdir()
            attachments = prod / 'attachments'
            attachments.mkdir()
            env = prod / '.env.production'
            env.write_text('POSTGRES_USER=fixture\nPOSTGRES_DB=fixture\nKINGTURF_WRITE_FENCE=disabled\n')
            env.chmod(0o600)
            (prod / '.release-sha').write_text('a'*40)
            initial = {'Id': '3'*64, 'Name': '/kingturf-erp-production-api-1',
                       'Image': 'sha256:'+'3'*64,
                       'Config': {'Image': 'fixture/api@sha256:'+'3'*64,
                                  'Labels': {'com.docker.compose.project': 'kingturf-erp-production', 'com.docker.compose.service': 'api'},
                                  'Env': ['KINGTURF_RELEASE_SHA='+'a'*40, 'KINGTURF_WRITE_FENCE=disabled']},
                       'Mounts': [{'Type': 'bind', 'Source': str(attachments), 'Destination': '/var/lib/kingturf/attachments'}],
                       'State': {'Running': True, 'Restarting': False}}
            current = copy.deepcopy(initial)
            retired, stops, compose_calls, observations = {}, [], [], []
            def replace():
                retired[current['Id']] = copy.deepcopy(current)
                current['Id'] = '9'*64
                current['State'].update(Running=True, Restarting=False)
            def docker(argv, **kwargs):
                if argv[1] == 'inspect':
                    observations.append((current['Id'], tuple(argv[2:])))
                    values = [current if key in (current['Id'], 'kingturf-erp-production-api-1') else retired[key] for key in argv[2:]]
                    return json.dumps(values).encode()
                if argv[1] == 'stop':
                    if replace_at_stop:
                        replace()
                    target = current if argv[-1] == current['Id'] else retired[argv[-1]]
                    stops.append(target['Id'])
                    target['State'].update(Running=False, Restarting=False)
                    return b''
                raise AssertionError('Unexpected host command in isolated stop fixture')
            def compose(_root, *args):
                compose_calls.append(args)
                if args[0] == 'up':
                    retired[current['Id']] = copy.deepcopy(current)
                    current['Id'] = '4'*64
                    current['Config']['Env'] = ['KINGTURF_RELEASE_SHA='+'a'*40, 'KINGTURF_WRITE_FENCE=enabled']
                    if after_up:
                        after_up(current)
                elif args[0] == 'stop':
                    if replace_at_stop:
                        replace()
                    stops.append(current['Id'])
                    current['State'].update(Running=False, Restarting=False)
                return b''
            def probe(_path, method='GET'):
                if method == 'POST':
                    if after_probe:
                        after_probe(current, replace)
                    return 503
                return 200
            def dump(_container, _user, _db, path):
                path.write_bytes(b'controlled dump fixture')
                return hashlib.sha256(path.read_bytes()).hexdigest()
            def restored(_root):
                env.write_text(am.disable_fence_text(env.read_text()))
                return True
            argv = ['apply_migrations.py', '--candidate-sha', 'f'*40,
                    '--approved-suffixes', '0002_next.sql', '--staged-root', str(staged),
                    '--approver', 'fixture', '--prod-root', str(prod),
                    '--attachments-dir', str(attachments), '--expected-before', '1', '--expected-after', '2']
            with mock.patch.object(sys, 'argv', argv), \
                 mock.patch.object(am, 'command', side_effect=docker), \
                 mock.patch.object(am, 'compose', side_effect=compose), \
                 mock.patch.object(am, 'dump_database', side_effect=dump), \
                 mock.patch.object(am, 'http_status', side_effect=probe), \
                 mock.patch.object(am, 'require_zero', side_effect=RuntimeError('verified stop boundary')), \
                 mock.patch.object(am, 'restore_api_on_failure', side_effect=restored) as restore, \
                 mock.patch.object(am.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as exit_status:
                    am.main()
            self.assertEqual(exit_status.exception.code, 1)
            return {'stops': stops, 'running': current['State']['Running'], 'id': current['Id'],
                    'restores': restore.call_count, 'compose': compose_calls,
                    'observations': observations, 'fence': env.read_text()}

    def test_replacement_after_fenced_probe_is_not_stopped_or_restored(self):
        result = self.flow(after_probe=lambda current, replace: replace())
        self.assertEqual(result['stops'], [])
        self.assertEqual(result['restores'], 0)
        self.assertEqual(result['id'], '9'*64)
        self.assertTrue(result['running'])
        self.assertIn('KINGTURF_WRITE_FENCE=enabled', result['fence'])

    def test_replacement_at_stop_dispatch_cannot_redirect_the_stop(self):
        result = self.flow(replace_at_stop=True)
        self.assertEqual(result['stops'], ['4'*64])
        self.assertNotIn('9'*64, result['stops'])
        self.assertTrue(result['running'])
        self.assertEqual(result['restores'], 0)
        self.assertIn('KINGTURF_WRITE_FENCE=enabled', result['fence'])

    def test_legal_fence_recreation_binds_observed_new_id(self):
        result = self.flow()
        self.assertEqual(result['stops'], ['4'*64])
        self.assertNotIn('3'*64, result['stops'])
        self.assertTrue(any(identity == '4'*64 for identity, _ in result['observations']))
        self.assertFalse(any(args[0] == 'stop' for args in result['compose']))
        self.assertEqual(result['restores'], 1)  # Existing pre-migration drain failure recovery remains.

    def test_scope_or_original_identity_drift_after_probe_retains_fence(self):
        import forward_recovery_test as fixtures
        for index in range(12):
            with self.subTest(variant=index):
                def changed(current, replace):
                    if index < 9:
                        _, mutation = list(fixtures.api_scope_variants(current))[index]
                        current.clear()
                        current.update(mutation)
                    elif index == 9:
                        current['Image'] = 'sha256:'+'9'*64
                    elif index == 10:
                        current['Config']['Image'] = 'unrelated@sha256:'+'9'*64
                    else:
                        current['Config']['Env'][0] = 'KINGTURF_RELEASE_SHA='+'9'*40
                result = self.flow(after_probe=changed)
                self.assertEqual(result['stops'], [])
                self.assertEqual(result['restores'], 0)
                self.assertTrue(result['running'])
                self.assertIn('KINGTURF_WRITE_FENCE=enabled', result['fence'])

    def test_fence_recreation_must_preserve_the_original_image_and_release(self):
        for field in ('Image', 'release'):
            with self.subTest(field=field):
                def changed(current):
                    if field == 'Image':
                        current['Image'] = 'sha256:'+'9'*64
                    else:
                        current['Config']['Env'][0] = 'KINGTURF_RELEASE_SHA='+'9'*40
                result = self.flow(after_up=changed)
                self.assertEqual(result['stops'], [])
                self.assertEqual(result['restores'], 0)
                self.assertTrue(result['running'])


if __name__ == '__main__':
    unittest.main()
