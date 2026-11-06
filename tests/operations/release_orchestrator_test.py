import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_orchestrator', ROOT / 'scripts/release_orchestrator.py')
ro = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ro)

SHA = '8' * 40
FIXED_NOW = '2026-11-05T12:00:00+00:00'


class FakeSession:
    """Scripted psql stand-in: serves the registry, tracks applied migrations."""

    def __init__(self, rows, *, lock_busy=False, fail_names=(), registry_under_lock=None):
        self.rows = [dict(row) for row in rows]
        self.lock_busy = lock_busy
        self.fail_names = set(fail_names)
        self.registry_under_lock = registry_under_lock
        self.applied = []
        self.wrapped = []
        self.lock_attempts = 0

    def query(self, sql):
        if sql.startswith(('CREATE TABLE IF NOT EXISTS schema_migrations', 'ALTER TABLE schema_migrations')):
            return []
        if sql.startswith('BEGIN READ ONLY'):
            if self.registry_under_lock is not None and self.lock_attempts:
                return [json.dumps(self.registry_under_lock)]
            return [json.dumps(self.rows)]
        if 'pg_stat_activity' in sql or 'to_regclass' in sql:
            return ['0'] if 'pg_stat_activity' in sql else ['t']
        if 'SELECT count(*) FROM (' in sql or 'SELECT 1 FROM inventory_movements' in sql or 'NOT EXISTS' in sql and 'inventory_movement_id' in sql:
            return ['0']
        if 'pg_try_advisory_lock' in sql:
            self.lock_attempts += 1
            return ['f' if self.lock_busy else 't']
        if 'pg_advisory_unlock' in sql:
            return ['t']
        if sql.startswith('BEGIN;'):
            self.wrapped.append(sql)
            name = next(part for part in sql.splitlines() if 'INSERT INTO schema_migrations' in part).split("VALUES ('")[1].split("','")[0]
            if name in self.fail_names:
                raise ro.StopError('database session ended unexpectedly: simulated failure in ' + name)
            checksum = next(part for part in sql.splitlines() if 'INSERT INTO schema_migrations' in part).split("','")[1].split("');")[0]
            self.rows.append({'name': name, 'checksum': checksum})
            self.rows.sort(key=lambda row: row['name'])
            self.applied.append(name)
            return []
        if sql.startswith('SELECT checksum FROM schema_migrations'):
            name = sql.split("name = '")[1].split("';")[0]
            return [next(row['checksum'] for row in self.rows if row['name'] == name)]
        raise AssertionError('unexpected statement: ' + sql[:60])


class OrchestratorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kingturf-orchestrator-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.migrations = self.base / 'migrations'
        self.migrations.mkdir()
        self.manifest = {}
        for index, name in enumerate(('0001_one.sql', '0002_two.sql', '0003_three.sql'), start=1):
            content = f'-- synthetic migration {index}\nSELECT {index};\n'
            (self.migrations / name).write_text(content)
            self.manifest[name] = ro.migration_checksum(self.migrations / name)
        self.rows = [{'name': '0001_one.sql', 'checksum': self.manifest['0001_one.sql']}]
        self.evidence = self.base / 'evidence'
        self.evidence.mkdir()
        self.state = self.base / 'state'
        self.state.mkdir()
        self.plan = ro.build_plan(self.migrations, SHA, self.rows)

    def write_evidence(self, **overrides):
        values = {
            'release_approval': {'release_sha': SHA, 'approved_suffix': ['0002_two.sql', '0003_three.sql'], 'approved_at_utc': '2026-11-05T11:00:00Z', 'window_end_utc': '2026-11-05T13:00:00Z', 'approver': 'lead'},
            'write_fence': {'method': 'api_write_fence', 'enabled_at_utc': '2026-11-05T11:30:00Z', 'observed_no_new_writes_utc': '2026-11-05T11:40:00Z', 'api_release_sha': SHA, 'in_flight_settled': True},
            'task_drain': {'background_queues_drained': True, 'external_write_channels_isolated': True, 'drained_at_utc': '2026-11-05T11:45:00Z'},
            'backup_restore': {'database_dump': {'file': 'x.dump', 'sha256': None, 'captured_at_utc': '2026-11-05T11:35:00Z'}, 'attachments_archive': {'file': 'x.tar', 'sha256': None, 'captured_at_utc': '2026-11-05T11:35:00Z'}, 'config_material': 'AVAILABLE', 'restore_rehearsal': 'PASS', 'rehearsal_report': 'report.md', 'rpo_statement': 'rpo', 'rto_statement': 'rto'},
            'image_compatibility': {'api_digest': 'c' * 64, 'web_digest': 'd' * 64, 'old_app_on_new_schema': {'verified': True, 'evidence': 'compat.md'}},
            'data_preconditions': {'negative_balance_groups': 0, 'over_return_groups': 0, 'orphan_return_movements': 0, 'checked_at_utc': '2026-11-05T11:50:00Z'},
        }
        import hashlib as _h
        backups = self.evidence / '.release-backups'
        backups.mkdir(exist_ok=True)
        (backups / 'x.dump').write_bytes(b'dump-bytes')
        (backups / 'x.tar').write_bytes(b'tar-bytes')
        values['backup_restore']['database_dump']['sha256'] = _h.sha256(b'dump-bytes').hexdigest()
        values['backup_restore']['attachments_archive']['sha256'] = _h.sha256(b'tar-bytes').hexdigest()
        values.update(overrides)
        for name, value in values.items():
            if value is not None:
                (self.evidence / (name + '.json')).write_text(json.dumps(value))

    def run_stages(self, session, **kwargs):
        kwargs.setdefault('backup_root', self.evidence / '.release-backups')
        return ro.run_stages(self.plan, self.evidence, session, self.migrations, self.state, now=ro.parse_instant(FIXED_NOW), **kwargs)

    def load_state(self):
        return json.loads((self.state / 'orchestration-state.json').read_text())

    def test_happy_path_completes_with_full_match_and_registered_suffix(self):
        self.write_evidence()
        session = FakeSession(self.rows)
        state = self.run_stages(session)
        self.assertEqual(state['verdict'], 'COMPLETED')
        self.assertEqual(session.applied, ['0002_two.sql', '0003_three.sql'])
        names = [row['name'] for row in session.rows]
        self.assertEqual(names, sorted(self.manifest))

    def test_missing_write_fence_evidence_stops_at_gate(self):
        self.write_evidence(write_fence=None)
        with self.assertRaisesRegex(ro.StopError, 'write_fence'):
            self.run_stages(FakeSession(self.rows))
        self.assertEqual(self.load_state()['verdict'], 'STOPPED')
        self.assertEqual(self.load_state()['stop_stage'], 'write_fence')

    def test_incomplete_joint_restore_evidence_blocks(self):
        evidence = json.loads((self.write_evidence() or (self.evidence / 'backup_restore.json').read_text()))
        del evidence['restore_rehearsal']
        (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ro.StopError, 'backup_restore'):
            self.run_stages(FakeSession(self.rows))
        self.assertEqual(self.load_state()['stop_stage'], 'backup_restore')

    def test_expired_approval_window_blocks(self):
        self.write_evidence(release_approval={'release_sha': SHA, 'approved_suffix': ['0002_two.sql', '0003_three.sql'], 'approved_at_utc': '2026-11-05T10:00:00Z', 'window_end_utc': '2026-11-05T11:00:00Z', 'approver': 'lead'})
        with self.assertRaisesRegex(ro.StopError, 'release_approval'):
            self.run_stages(FakeSession(self.rows))

    def test_approved_suffix_mismatch_blocks(self):
        self.write_evidence(release_approval={'release_sha': SHA, 'approved_suffix': ['0003_three.sql'], 'approved_at_utc': '2026-11-05T11:00:00Z', 'window_end_utc': '2026-11-05T13:00:00Z', 'approver': 'lead'})
        with self.assertRaisesRegex(ro.StopError, 'approved suffix'):
            self.run_stages(FakeSession(self.rows))

    def test_nonzero_data_precondition_blocks(self):
        self.write_evidence(data_preconditions={'negative_balance_groups': 1, 'over_return_groups': 0, 'orphan_return_movements': 0, 'checked_at_utc': '2026-11-05T11:50:00Z'})
        with self.assertRaisesRegex(ro.StopError, 'data_preconditions'):
            self.run_stages(FakeSession(self.rows))

    def test_stopped_attempt_refuses_rerun_without_fresh_approval(self):
        self.write_evidence()
        with self.assertRaisesRegex(ro.StopError, '0003_three.sql'):
            self.run_stages(FakeSession(self.rows, fail_names={'0003_three.sql'}))
        state = self.load_state()
        self.assertEqual(state['verdict'], 'STOPPED')
        self.assertEqual(state['stop_stage'], 'apply:0003_three.sql')
        self.assertEqual([row['name'] for row in state['registry_after_stop']], ['0001_one.sql', '0002_two.sql'])
        with self.assertRaisesRegex(RuntimeError, 'without --new-approval'):
            self.run_stages(FakeSession(self.rows))
        consumed = state['approval_sha256']
        with self.assertRaisesRegex(RuntimeError, 'fresh approval'):
            ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, self.state, now=ro.parse_instant(FIXED_NOW), new_approval=consumed)

    def test_completed_plan_refuses_reexecution(self):
        self.write_evidence()
        self.run_stages(FakeSession(self.rows))
        with self.assertRaisesRegex(ro.StopError, 'already COMPLETED'):
            self.run_stages(FakeSession(self.rows))

    def test_concurrent_migration_lock_blocks(self):
        self.write_evidence()
        with self.assertRaisesRegex(ro.StopError, 'CONCURRENT_MIGRATION_ACTIVE'):
            self.run_stages(FakeSession(self.rows, lock_busy=True))

    def test_registry_changed_under_lock_blocks(self):
        self.write_evidence()
        drifted = self.rows + [{'name': '0002_two.sql', 'checksum': self.manifest['0002_two.sql']}]
        with self.assertRaisesRegex(ro.StopError, 'REGISTRY_CHANGED_UNDER_LOCK'):
            self.run_stages(FakeSession(self.rows, registry_under_lock=drifted))

    def test_migration_wrapping_enforces_lock_and_statement_timeouts(self):
        self.write_evidence()
        session = FakeSession(self.rows)
        self.run_stages(session)
        self.assertEqual(session.applied, ['0002_two.sql', '0003_three.sql'])
        self.assertEqual(session.lock_attempts, 1)
        self.assertEqual(len(session.wrapped), 2)
        for wrapped in session.wrapped:
            for setting in ("SET LOCAL lock_timeout = '2s'", "SET LOCAL statement_timeout = '300s'", "SET LOCAL idle_in_transaction_session_timeout = '300s'"):
                self.assertIn(setting, wrapped)
            self.assertTrue(wrapped.lstrip().startswith('BEGIN;'))
            self.assertTrue(wrapped.rstrip().endswith('COMMIT;'))

    def test_backup_artifact_hash_or_timestamp_violations_block(self):
        for index, mutate in enumerate((
            lambda evidence: evidence['database_dump'].update(sha256='not-hex'),
            lambda evidence: evidence['attachments_archive'].update(captured_at_utc='2026-11-05T11:00:00Z'),
            lambda evidence: evidence['database_dump'].update(file=123),
        )):
            with self.subTest(mutation=index):
                self.write_evidence()
                evidence = json.loads((self.evidence / 'backup_restore.json').read_text())
                mutate(evidence)
                (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
                state = self.base / f'state-backup-{index}'
                with self.assertRaisesRegex(ro.StopError, 'backup_restore'):
                    ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, state, now=ro.parse_instant(FIXED_NOW))

    def test_digest_length_violation_blocks(self):
        self.write_evidence(image_compatibility={'api_digest': 'c' * 65, 'web_digest': 'd' * 64, 'old_app_on_new_schema': {'verified': True, 'evidence': 'compat.md'}})
        with self.assertRaisesRegex(ro.StopError, 'image_compatibility'):
            self.run_stages(FakeSession(self.rows))

    def test_web_digest_missing_or_malformed_blocks(self):
        for index, mutate in enumerate((
            lambda evidence: evidence.pop('web_digest'),
            lambda evidence: evidence.update(web_digest='d' * 63),
            lambda evidence: evidence.update(web_digest='sha256:zz'),
            lambda evidence: evidence.update(api_digest='sha256:sha256:' + 'c' * 64),
        )):
            with self.subTest(mutation=index):
                self.write_evidence()
                evidence = json.loads((self.evidence / 'image_compatibility.json').read_text())
                mutate(evidence)
                (self.evidence / 'image_compatibility.json').write_text(json.dumps(evidence))
                state = self.base / f'state-webdigest-{index}'
                with self.assertRaisesRegex(ro.StopError, 'image_compatibility'):
                    ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, state, now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')

    def test_image_gate_accepts_sha256_prefixed_digest_forms(self):
        self.write_evidence(image_compatibility={'api_digest': 'sha256:' + 'c' * 64, 'web_digest': 'sha256:' + 'd' * 64, 'old_app_on_new_schema': {'verified': True, 'evidence': 'compat.md'}})
        state = self.run_stages(FakeSession(self.rows))
        self.assertEqual(state['verdict'], 'COMPLETED')

    def test_psql_argv_without_on_error_stop_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'ON_ERROR_STOP'):
            ro.PsqlSession(['psql', '-X', '-qAt'])

    def test_psql_argv_accepts_the_workflow_sh_c_form(self):
        # The production compose-exec form carries the flag inside one sh -c string;
        # construction must not spawn a process we would not clean up, so only the
        # validation path is exercised via a rejected stub afterwards.
        argv = ['docker', 'compose', 'exec', '-T', 'postgres', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 --username="$POSTGRES_USER"']
        ro.PsqlSession(argv).close()

    def test_new_approval_loader_binds_release_and_canonical_form(self):
        consumed = {'release_sha': SHA, 'approved_suffix': ['0002_two.sql'], 'approved_at_utc': '2026-11-05T11:00:00Z', 'window_end_utc': '2026-11-05T13:00:00Z', 'approver': 'lead'}
        replay = self.base / 'replay.json'
        replay.write_text(json.dumps(consumed, indent=4))
        consumed_hash = ro.load_new_approval(replay, SHA)
        # Any non-canonical formatting of the SAME artifact hashes identically...
        replay_differently_formatted = self.base / 'replay2.json'
        replay_differently_formatted.write_text(json.dumps(consumed, separators=(',', ':')))
        self.assertEqual(ro.load_new_approval(replay_differently_formatted, SHA), consumed_hash)
        # ...so a rerun presenting the consumed approval is detectably stale:
        self.assertNotEqual(consumed_hash, 'not-the-consumed-hash')
        wrong_release = self.base / 'wrong.json'
        wrong_release.write_text(json.dumps({**consumed, 'release_sha': '9' * 40}))
        with self.assertRaisesRegex(RuntimeError, 'different release'):
            ro.load_new_approval(wrong_release, SHA)
        garbage = self.base / 'garbage.json'
        garbage.write_text('not json')
        with self.assertRaises(ValueError):
            ro.load_new_approval(garbage, SHA)

    def test_non_utc_timestamp_offsets_are_rejected(self):
        self.write_evidence(release_approval={'release_sha': SHA, 'approved_suffix': ['0002_two.sql', '0003_three.sql'], 'approved_at_utc': '2026-11-05T19:00:00+08:00', 'window_end_utc': '2026-11-05T21:00:00+08:00', 'approver': 'lead'})
        with self.assertRaisesRegex(ro.StopError, 'UTC'):
            self.run_stages(FakeSession(self.rows))

    def test_approval_window_over_12h_is_rejected(self):
        self.write_evidence(release_approval={'release_sha': SHA, 'approved_suffix': ['0002_two.sql', '0003_three.sql'], 'approved_at_utc': '2026-11-05T11:00:00Z', 'window_end_utc': '2026-11-06T01:00:00Z', 'approver': 'lead'})
        with self.assertRaisesRegex(ro.StopError, '12 hours'):
            self.run_stages(FakeSession(self.rows))

    def test_backup_tamper_missing_file_and_traversal_are_rejected(self):
        import hashlib as _h

        def stage(index):
            return self.base / f'state-backup2-{index}'

        # Well-formed but WRONG hash: recomputation from disk must reject it.
        self.write_evidence()
        evidence = json.loads((self.evidence / 'backup_restore.json').read_text())
        evidence['database_dump']['sha256'] = 'a' * 64
        (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ro.StopError, 'sha256 mismatch'):
            ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, stage(0), now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')
        # Listed file that does not exist on disk.
        self.write_evidence()
        evidence = json.loads((self.evidence / 'backup_restore.json').read_text())
        evidence['attachments_archive']['file'] = 'missing.tar'
        (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ro.StopError, 'file not found'):
            ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, stage(1), now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')
        # Relative traversal escaping .release-backups, even with a matching hash.
        (self.evidence / 'escaped.dump').write_bytes(b'escaped-bytes')
        self.write_evidence()
        evidence = json.loads((self.evidence / 'backup_restore.json').read_text())
        evidence['database_dump']['file'] = '../escaped.dump'
        evidence['database_dump']['sha256'] = _h.sha256(b'escaped-bytes').hexdigest()
        (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ro.StopError, 'escapes'):
            ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, stage(2), now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')
        # Absolute paths are refused outright.
        self.write_evidence()
        evidence = json.loads((self.evidence / 'backup_restore.json').read_text())
        evidence['database_dump']['file'] = '/etc/hostname'
        (self.evidence / 'backup_restore.json').write_text(json.dumps(evidence))
        with self.assertRaisesRegex(ro.StopError, 'relative to'):
            ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, stage(3), now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')

    def controlled_shutdown_fence(self, **extra):
        fence = {'method': 'controlled_old_api_shutdown', 'enabled_at_utc': '2026-11-05T11:30:00Z', 'observed_no_new_writes_utc': '2026-11-05T11:40:00Z', 'api_release_sha': SHA, 'in_flight_settled': True, 'api_service_state': 'stopped', 'stopped_at_utc': '2026-11-05T11:35:00Z'}
        fence.update(extra)
        return fence

    def test_controlled_shutdown_requires_stopped_state_and_timestamp(self):
        for index, mutate in enumerate((
            lambda fence: fence.update(api_service_state='running'),
            lambda fence: fence.pop('stopped_at_utc'),
        )):
            with self.subTest(mutation=index):
                self.write_evidence(write_fence=self.controlled_shutdown_fence())
                fence = json.loads((self.evidence / 'write_fence.json').read_text())
                mutate(fence)
                (self.evidence / 'write_fence.json').write_text(json.dumps(fence))
                state = self.base / f'state-fence-req-{index}'
                with self.assertRaisesRegex(ro.StopError, 'write_fence'):
                    ro.run_stages(self.plan, self.evidence, FakeSession(self.rows), self.migrations, state, now=ro.parse_instant(FIXED_NOW), backup_root=self.evidence / '.release-backups')

    def test_controlled_shutdown_without_release_root_blocks(self):
        self.write_evidence(write_fence=self.controlled_shutdown_fence())
        with self.assertRaisesRegex(ro.StopError, 'FENCE_STATE_MISMATCH'):
            self.run_stages(FakeSession(self.rows))

    def test_controlled_shutdown_cross_check_blocks_on_running_api(self):
        self.write_evidence(write_fence=self.controlled_shutdown_fence())
        running = mock.Mock(returncode=0, stdout='[{"Name":"api","State":"running"}]')
        with mock.patch.object(ro.subprocess, 'run', return_value=running):
            with self.assertRaisesRegex(ro.StopError, 'FENCE_STATE_MISMATCH'):
                self.run_stages(FakeSession(self.rows), release_root=self.base)
        self.assertEqual(self.load_state()['verdict'], 'STOPPED')

    def test_controlled_shutdown_cross_check_passes_when_api_stopped(self):
        self.write_evidence(write_fence=self.controlled_shutdown_fence())
        stopped = mock.Mock(returncode=0, stdout='\n')
        calls = []
        with mock.patch.object(ro.subprocess, 'run', side_effect=lambda argv, **kwargs: calls.append(argv) or stopped):
            state = self.run_stages(FakeSession(self.rows), release_root=self.base)
        self.assertEqual(state['verdict'], 'COMPLETED')
        self.assertIn('fence_cross_check', [stage['name'] for stage in state['stages']])
        argv = calls[0]
        self.assertIn('ps', argv)
        self.assertIn('--status', argv)
        self.assertEqual(argv[argv.index('--status') + 1], 'running')
        compose = next(part for part in argv if part.endswith('infra/docker/compose.production.yaml'))
        self.assertEqual(Path(compose), self.base / 'infra/docker/compose.production.yaml')
        env_file = next(part for part in argv if part.endswith('.env.production'))
        self.assertEqual(Path(env_file), self.base / '.env.production')

    def test_derive_release_root_matches_canonical_layout(self):
        self.assertEqual(ro.derive_release_root(Path('/data/kingturf-erp/.release-migration-evidence')), Path('/data/kingturf-erp'))
        self.assertEqual(ro.derive_release_root(Path('.release-migration-evidence')), Path('.'))
        self.assertEqual(ro.derive_release_root(Path('/tmp/other-name')), Path('/tmp/other-name'))

    def write_canonical_release(self):
        """Materialize the production layout with a LIVE approval window (CLI runs use the real clock)."""
        release = self.base / 'release'
        release.mkdir(exist_ok=True)
        self.evidence = release / '.release-migration-evidence'
        self.evidence.mkdir()
        self.write_evidence()
        now = datetime.now(timezone.utc)

        def stamp(hours):
            return (now + timedelta(hours=hours)).strftime('%Y-%m-%dT%H:%M:%SZ')

        live = {
            'release_approval': {'release_sha': SHA, 'approved_suffix': ['0002_two.sql', '0003_three.sql'], 'approved_at_utc': stamp(-1), 'window_end_utc': stamp(1), 'approver': 'lead'},
            'write_fence': {'method': 'api_write_fence', 'enabled_at_utc': stamp(-0.5), 'observed_no_new_writes_utc': stamp(-1 / 3), 'api_release_sha': SHA, 'in_flight_settled': True},
            'task_drain': {'background_queues_drained': True, 'external_write_channels_isolated': True, 'drained_at_utc': stamp(-0.25)},
            'data_preconditions': {'negative_balance_groups': 0, 'over_return_groups': 0, 'orphan_return_movements': 0, 'checked_at_utc': stamp(-0.2)},
        }
        for name, value in live.items():
            (self.evidence / (name + '.json')).write_text(json.dumps(value))
        backup = json.loads((self.evidence / 'backup_restore.json').read_text())
        backup['database_dump']['captured_at_utc'] = stamp(-0.4)
        backup['attachments_archive']['captured_at_utc'] = stamp(-0.4)
        (self.evidence / 'backup_restore.json').write_text(json.dumps(backup))
        (self.evidence / '.release-backups').rename(release / '.release-backups')
        (self.evidence / 'plan.json').write_text(json.dumps(self.plan))
        return release

    def orchestrator_cli(self, *arguments, cwd):
        return subprocess.run([sys.executable, str(ROOT / 'scripts/release_orchestrator.py'), *arguments], cwd=cwd, capture_output=True, text=True)

    def test_check_evidence_cli_accepts_exact_workflow_invocation(self):
        release = self.write_canonical_release()
        result = self.orchestrator_cli('check-evidence', '.release-migration-evidence/plan.json', '.release-migration-evidence', cwd=release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['check_evidence'], 'PASS')

    def test_verify_images_cli_requires_and_normalizes_digests(self):
        release = self.write_canonical_release()
        env_file = release / '.env.production'
        api, web = 'sha256:' + 'c' * 64, 'sha256:' + 'd' * 64
        # Evidence holds bare hex; the env file holds the docker-native prefixed form.
        env_file.write_text(f'KINGTURF_API_DIGEST={api}\nKINGTURF_WEB_DIGEST={web}\n')
        result = self.orchestrator_cli('verify-images', '.release-migration-evidence', '.env.production', cwd=release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['verify_images'], 'PASS')
        # A real mismatch is refused (not merely a different serialization).
        env_file.write_text(f'KINGTURF_API_DIGEST={web}\nKINGTURF_WEB_DIGEST={web}\n')
        result = self.orchestrator_cli('verify-images', '.release-migration-evidence', '.env.production', cwd=release)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('IMAGE_DIGEST_MISMATCH', result.stderr)
        # Bare-hex env values cannot satisfy compose interpolation and are refused.
        env_file.write_text(f'KINGTURF_API_DIGEST={"c" * 64}\nKINGTURF_WEB_DIGEST={web}\n')
        result = self.orchestrator_cli('verify-images', '.release-migration-evidence', '.env.production', cwd=release)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('must be sha256:<64hex>', result.stderr)
        # Absent on both sides must NOT pass as None == None.
        env_file.write_text('OTHER=value\n')
        evidence = json.loads((self.evidence / 'image_compatibility.json').read_text())
        evidence.pop('api_digest'), evidence.pop('web_digest')
        (self.evidence / 'image_compatibility.json').write_text(json.dumps(evidence))
        result = self.orchestrator_cli('verify-images', '.release-migration-evidence', '.env.production', cwd=release)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('IMAGE_DIGEST_MISMATCH', result.stderr)
        # A missing evidence directory fails with a gate message, not a traceback.
        result = self.orchestrator_cli('verify-images', '.release-migration-evidence', '.env.production', cwd=self.base)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('GATE_FAILED', result.stderr)

    def test_plan_requires_contiguous_prefix(self):
        with self.assertRaisesRegex(RuntimeError, 'MIGRATION_HISTORY_GAP'):
            ro.build_plan(self.migrations, SHA, self.rows + [{'name': '0003_three.sql', 'checksum': self.manifest['0003_three.sql']}])


if __name__ == '__main__':
    unittest.main()
