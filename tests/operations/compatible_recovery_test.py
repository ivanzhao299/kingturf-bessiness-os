"""Real local Git/tar/JSON binding tests with explicitly synthetic drill reports.

These fixtures do NOT run API/Web images and must never be used as release proof.
"""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('compatible_orchestrator', ROOT/'scripts/release_orchestrator.py')
ro = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ro)
spec = importlib.util.spec_from_file_location('compatible_apply', ROOT/'scripts/apply_migrations.py')
am = importlib.util.module_from_spec(spec)
spec.loader.exec_module(am)


class CompatibleRecoveryEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.evidence = self.base/'evidence'
        self.evidence.mkdir()
        self.repo = self.base/'source'
        self.repo.mkdir()
        self.git('init', '--quiet', '-b', 'main')
        self.git('config', 'user.name', 'Local fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        directory = self.repo/'packages/database/migrations'
        directory.mkdir(parents=True)
        (directory/'0001_one.sql').write_text('SELECT 1;\n')
        self.commit('legacy fixture')
        legacy = self.git('rev-parse', 'HEAD').strip()
        (directory/'0002_two.sql').write_text('SELECT 2;\n')
        self.commit('recovery fixture')
        recovery = self.git('rev-parse', 'HEAD').strip()
        self.git('branch', 'recovery')
        self.source = self.evidence/'source.bundle'
        self.git('bundle', 'create', str(self.source), '--all')
        self.manifest = ro.read_manifest(directory)
        self.plan = {'release_sha': 'b'*40, 'manifest': self.manifest, 'pending': [{'name': '0002_two.sql', 'checksum': self.manifest['0002_two.sql']}]}
        self.now = datetime(2026, 11, 26, 10, tzinfo=timezone.utc)
        self.binding = {'legacy_business_sha': legacy, 'recovery_release_sha': recovery, 'recovery_main_sha': recovery, 'api_digest': 'sha256:'+'c'*64, 'web_digest': 'sha256:'+'d'*64, 'target_manifest_sha256': ro.canonical_digest(self.manifest), 'recovery_bundle_sha256': '', 'report_sha256': ''}
        self.bundle = self.evidence/'recovery.tar.gz'
        self.write_bundle()
        records = [{'name': name, 'checksum': checksum, 'applied_at': '2026-11-26T08:00:00+00:00'} for name, checksum in sorted(self.manifest.items())]
        files = {'.release-migration-state/orchestration-state.json': 'e'*64, '.staging/wave2-100-1/plan.json': 'f'*64}
        self.report = {'kind': 'compatible_application_recovery_drill_v1', 'isolated': True, 'bindings': {}, 'tested_at_utc': '2026-11-26T09:30:00Z', 'steps': [{'name': name, 'result': 'PASS', 'at_utc': (self.now-timedelta(minutes=40-i)).isoformat()} for i, name in enumerate(ro.RECOVERY_STEPS)], 'runtime': {'release_sha': recovery, 'api_digest': self.binding['api_digest'], 'web_digest': self.binding['web_digest']}, 'authenticated_write': {'authenticated': True, 'status': 201, 'operation': 'synthetic-fixture-only'}, 'registry': {'includes_applied_at': True, 'before': records, 'after': records, 'before_sha256': ro.canonical_digest(records), 'after_sha256': ro.canonical_digest(records)}, 'migration_state': {'before_files': files, 'after_files': files, 'before_sha256': ro.canonical_digest(files), 'after_sha256': ro.canonical_digest(files)}}
        self.artifacts = {'kind': 'compatible_application_recovery_v1', 'recovery_bundle_file': self.bundle.name, 'source_bundle_file': self.source.name, 'report_file': 'report.json'}
        self.approval = {'release_sha': self.plan['release_sha'], 'approved_suffix': ['0002_two.sql'], 'approver': 'synthetic fixture', 'approved_at_utc': self.now.isoformat(), 'window_end_utc': (self.now+timedelta(hours=2)).isoformat(), 'image_compatibility_mode': 'compatible_recovery', 'compatible_recovery': self.binding}
        self.fence = {'api_release_sha': legacy}
        self.write_report()

    def git(self, *args):
        result = subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, text=True, timeout=60)
        if result.returncode:
            raise AssertionError('Local Git fixture command failed: '+result.stderr)
        return result.stdout

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '--quiet', '-m', message)

    def write_bundle(self, release=None, manifest=None):
        raw = json.dumps(self.manifest if manifest is None else manifest, sort_keys=True).encode()
        release = release or {'release_sha': self.binding['recovery_release_sha'], 'migration_manifest_sha256': hashlib.sha256(raw).hexdigest(), 'images': {s: {'source': 'ghcr.io/ivanzhao299/kingturf-erp-'+s, 'digest': self.binding[s+'_digest']} for s in ('api', 'web')}}
        with tarfile.open(self.bundle, 'w:gz') as archive:
            for name, data in (('migrations.json', raw), ('release.json', json.dumps(release).encode())):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        self.binding['recovery_bundle_sha256'] = ro.artifact_digest(self.bundle)

    def write_report(self):
        self.report['bindings'] = {k: v for k, v in self.binding.items() if k != 'report_sha256'}
        path = self.evidence/'report.json'
        path.write_text(json.dumps(self.report, sort_keys=True))
        self.binding['report_sha256'] = ro.artifact_digest(path)
        (self.evidence/'compatible_recovery.json').write_text(json.dumps(self.artifacts))

    def check(self):
        ro.check_approval(self.approval, self.plan, self.now)
        ro.check_image_compatibility(self.artifacts, approval=self.approval, plan=self.plan, fence=self.fence, evidence_root=self.evidence)

    def test_synthetic_report_checks_actual_local_git_ancestry_tar_metadata_and_report_bytes(self):
        self.check()

    def test_mode_must_be_explicit_and_legacy_still_requires_its_original_evidence(self):
        for approval in ({}, {'image_compatibility_mode': 'legacy'}):
            with self.subTest(approval=approval):
                with self.assertRaisesRegex(RuntimeError, 'image_compatibility'):
                    ro.check_image_compatibility(self.artifacts, approval=approval)
        legacy = {'api_digest': 'c'*64, 'web_digest': 'd'*64, 'old_app_on_new_schema': {'verified': True, 'evidence': 'independent legacy compatibility report'}}
        ro.check_image_compatibility(legacy)
        legacy['old_app_on_new_schema']['evidence'] = 'runner isolation smoke images_run_id=1 bundle=x'
        with self.assertRaisesRegex(RuntimeError, 'candidate smoke'):
            ro.check_image_compatibility(legacy)

    def test_file_presence_does_not_select_mode_in_apply(self):
        self.assertIsNone(am.selected_recovery_approval(ro, self.evidence, self.plan, self.fence['api_release_sha'], self.now))
        path = self.evidence/'migration-recovery-approval.json'
        path.write_text(json.dumps(self.approval))
        self.assertEqual(am.selected_recovery_approval(ro, self.evidence, self.plan, self.fence['api_release_sha'], self.now), self.approval)
        body = copy.deepcopy(self.approval)
        body.pop('image_compatibility_mode')
        path.write_text(json.dumps(body))
        with self.assertRaisesRegex(RuntimeError, 'must select'):
            am.selected_recovery_approval(ro, self.evidence, self.plan, self.fence['api_release_sha'], self.now)

    def test_missing_tampered_or_external_symlink_report_is_rejected(self):
        report = self.evidence/'report.json'
        original = report.read_bytes()
        report.unlink()
        with self.assertRaisesRegex(RuntimeError, 'existing in-bundle'):
            self.check()
        report.write_bytes(original+b' ')
        with self.assertRaisesRegex(RuntimeError, 'report bytes'):
            self.check()
        report.unlink()
        outside = self.base/'outside.json'
        outside.write_bytes(original)
        report.symlink_to(outside)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            self.check()

    def test_report_paths_cannot_escape_even_with_matching_hash(self):
        for path in ('../outside.json', '/tmp/report.json', ''):
            with self.subTest(path=path):
                self.artifacts['report_file'] = path
                with self.assertRaisesRegex(RuntimeError, 'artifact path'):
                    self.check()

    def test_nested_symlink_inside_bundle_is_rejected(self):
        link = self.evidence/'linked'
        link.symlink_to(self.evidence, target_is_directory=True)
        self.artifacts['report_file'] = 'linked/report.json'
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            self.check()

    def test_old_release_or_candidate_target_digest_wrong_binding_blocks(self):
        for key, wrong in (('legacy_business_sha', 'f'*40), ('recovery_release_sha', 'f'*40), ('api_digest', 'sha256:'+'f'*64), ('web_digest', 'sha256:'+'f'*64), ('target_manifest_sha256', 'f'*64), ('recovery_main_sha', 'f'*40)):
            original = self.binding[key]
            with self.subTest(key=key):
                self.binding[key] = wrong
                with self.assertRaises(RuntimeError):
                    self.check()
                self.binding[key] = original

    def test_raw_recovery_bundle_tamper_is_rejected(self):
        with self.bundle.open('ab') as stream:
            stream.write(b'tampered')
        with self.assertRaisesRegex(RuntimeError, 'bundle bytes'):
            self.check()

    def test_report_binding_cannot_disagree_even_when_its_new_hash_is_approved(self):
        self.report['runtime']['release_sha'] = self.binding['legacy_business_sha']
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'runtime identity'):
            self.check()

    def test_empty_registry_or_state_observations_never_pass_equal_hashes(self):
        for key, names, empty in (('registry', ('before', 'after'), []), ('migration_state', ('before_files', 'after_files'), {})):
            original = copy.deepcopy(self.report[key])
            with self.subTest(key=key):
                self.report[key].update({n: empty for n in names})
                self.report[key].update(before_sha256=ro.canonical_digest(empty), after_sha256=ro.canonical_digest(empty))
                self.write_report()
                with self.assertRaisesRegex(RuntimeError, 'observations empty'):
                    self.check()
                self.report[key] = original
                self.write_report()

    def test_count_only_registry_or_changed_applied_at_is_rejected(self):
        self.report['registry']['after'] = copy.deepcopy(self.report['registry']['before'])
        self.report['registry']['after'][0]['applied_at'] = '2026-11-26T09:00:00Z'
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'observations empty, changed'):
            self.check()

    def test_application_journal_cannot_replace_migration_execution_record(self):
        files = {'.release-image-recovery/1-1/application-state.json': 'e'*64}
        self.report['migration_state'].update(before_files=files, after_files=files, before_sha256=ro.canonical_digest(files), after_sha256=ro.canonical_digest(files))
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'execution record and plan'):
            self.check()

    def test_future_report_time_failed_step_or_missing_authenticated_write_blocks(self):
        original = copy.deepcopy(self.report)
        mutations = [('tested_at_utc', '2026-11-26T12:00:00Z'), ('authenticated_write', {'authenticated': False, 'status': 201, 'operation': 'x'})]
        for key, value in mutations:
            with self.subTest(key=key):
                self.report[key] = value
                self.write_report()
                with self.assertRaises(RuntimeError):
                    self.check()
                self.report = copy.deepcopy(original)
        self.report['steps'][0]['result'] = 'FAIL'
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'step did not pass'):
            self.check()

    def test_r_source_ancestry_and_manifest_are_verified_from_git_objects(self):
        with mock.patch.object(ro, 'recovery_bundle_metadata'):
            self.binding['recovery_release_sha'] = self.binding['legacy_business_sha']
            self.binding['legacy_business_sha'] = 'e'*40
            self.fence['api_release_sha'] = 'e'*40
            self.report['runtime']['release_sha'] = self.binding['recovery_release_sha']
            self.write_report()
            with self.assertRaisesRegex(RuntimeError, 'source refs differ'):
                self.check()

    def gate_materials(self):
        fence = {'method': 'controlled_old_api_shutdown', 'enabled_at_utc': '2026-11-26T09:50:00Z', 'observed_no_new_writes_utc': '2026-11-26T09:51:00Z', 'api_release_sha': self.fence['api_release_sha'], 'in_flight_settled': True, 'api_service_state': 'stopped', 'stopped_at_utc': '2026-11-26T09:51:00Z'}
        backups = self.evidence/'.release-backups'
        backups.mkdir()
        backup = {}
        for key, name in (('database_dump', 'fixture.dump'), ('attachments_archive', 'fixture.tar')):
            path = backups/name
            path.write_bytes(b'synthetic backup')
            backup[key] = {'file': name, 'sha256': ro.artifact_digest(path), 'captured_at_utc': '2026-11-26T09:52:00Z'}
        backup.update(config_material='AVAILABLE', restore_rehearsal='PASS', rehearsal_report='synthetic only', rpo_statement='fixture', rto_statement='fixture')
        values = {'release_approval': self.approval, 'write_fence': fence, 'backup_restore': backup, 'task_drain': {'background_queues_drained': True, 'external_write_channels_isolated': True, 'drained_at_utc': '2026-11-26T09:52:00Z'}, 'data_preconditions': {'negative_balance_groups': 0, 'over_return_groups': 0, 'orphan_return_movements': 0, 'checked_at_utc': '2026-11-26T09:52:00Z'}}
        for name, value in values.items():
            (self.evidence/(name+'.json')).write_text(json.dumps(value))
        (self.base/'.release-sha').write_text(self.fence['api_release_sha'])
        directory = self.repo/'packages/database/migrations'
        rows = [{'name': '0001_one.sql', 'checksum': self.manifest['0001_one.sql']}]
        return ro.build_plan(directory, self.plan['release_sha'], rows), directory, rows, backups

    def test_gate_selection_and_live_l_cross_check_reach_executor_only_with_explicit_mode(self):
        from release_orchestrator_test import FakeSession
        plan, directory, rows, backups = self.gate_materials()
        session = FakeSession(rows)
        real_run = subprocess.run
        def command(argv, **kwargs):
            if argv[0] != 'docker':
                return real_run(argv, **kwargs)
            if argv[1] == 'compose':
                return mock.Mock(returncode=0, stdout='')
            return mock.Mock(returncode=0, stdout=json.dumps([{'Config': {'Env': ['KINGTURF_RELEASE_SHA='+self.fence['api_release_sha']]}, 'State': {'Running': False, 'Restarting': False}}]))
        with mock.patch.object(ro.subprocess, 'run', side_effect=command):
            state = ro.run_stages(plan, self.evidence, session, directory, self.base/'state', now=self.now, backup_root=backups, release_root=self.base)
        self.assertEqual(state['verdict'], 'COMPLETED')
        self.assertEqual(session.applied, ['0002_two.sql'])
        self.assertIn('recovery_source_cross_check', [s['name'] for s in state['stages']])

    def test_compatible_file_without_approval_mode_stops_before_any_migration_lock(self):
        from release_orchestrator_test import FakeSession
        self.approval.pop('image_compatibility_mode')
        plan, directory, rows, backups = self.gate_materials()
        session = FakeSession(rows)
        with self.assertRaisesRegex(ro.StopError, 'image_compatibility'):
            ro.run_stages(plan, self.evidence, session, directory, self.base/'state', now=self.now, backup_root=backups)
        self.assertEqual(session.lock_attempts, 0)
        self.assertEqual(session.applied, [])

    def test_missing_actual_report_stops_gate_before_any_migration_lock(self):
        from release_orchestrator_test import FakeSession
        plan, directory, rows, backups = self.gate_materials()
        (self.evidence/'report.json').unlink()
        session = FakeSession(rows)
        with self.assertRaisesRegex(ro.StopError, 'compatible_recovery'):
            ro.run_stages(plan, self.evidence, session, directory, self.base/'state', now=self.now, backup_root=backups)
        self.assertEqual(session.lock_attempts, 0)
        self.assertEqual(session.applied, [])

    def test_malformed_approved_tar_stops_before_any_migration_lock(self):
        from release_orchestrator_test import FakeSession
        self.bundle.write_bytes(b'not a tar archive')
        self.binding['recovery_bundle_sha256'] = ro.artifact_digest(self.bundle)
        self.write_report()
        plan, directory, rows, backups = self.gate_materials()
        session = FakeSession(rows)
        with self.assertRaisesRegex(ro.StopError, 'image_compatibility'):
            ro.run_stages(plan, self.evidence, session, directory, self.base/'state', now=self.now, backup_root=backups)
        self.assertEqual(session.lock_attempts, 0)
        self.assertEqual(session.applied, [])

    def test_valid_metadata_cannot_hide_different_actual_git_migration_bytes(self):
        (self.repo/'packages/database/migrations/0002_two.sql').write_text('SELECT 999;\n')
        self.commit('changed source fixture')
        self.git('branch', '-f', 'recovery')
        self.source.unlink()
        self.git('bundle', 'create', str(self.source), '--all')
        self.binding['recovery_release_sha'] = self.git('rev-parse', 'HEAD').strip()
        self.binding['recovery_main_sha'] = self.binding['recovery_release_sha']
        self.report['runtime']['release_sha'] = self.binding['recovery_release_sha']
        self.write_bundle()
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'Git source manifest differs'):
            self.check()

    def test_recovery_commit_outside_approved_main_history_is_rejected(self):
        self.git('checkout', '--quiet', '-b', 'detached-fixture', self.binding['legacy_business_sha'])
        (self.repo/'packages/database/migrations/0002_two.sql').write_text('SELECT 2;\n')
        (self.repo/'fixture.txt').write_text('different commit')
        self.commit('unmerged recovery fixture')
        self.binding['recovery_release_sha'] = self.git('rev-parse', 'HEAD').strip()
        self.report['runtime']['release_sha'] = self.binding['recovery_release_sha']
        self.git('branch', '-f', 'recovery')
        self.source.unlink()
        self.git('bundle', 'create', str(self.source), '--all')
        self.write_bundle()
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'ancestry verification failed'):
            self.check()

    def test_non_utc_time_or_step_order_is_rejected(self):
        self.report['tested_at_utc'] = '2026-11-26T09:30:00+08:00'
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'UTC'):
            self.check()
        self.report['tested_at_utc'] = '2026-11-26T09:30:00Z'
        self.report['steps'].reverse()
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'step did not pass in order'):
            self.check()

    def test_bundle_manifest_must_match_target_despite_valid_tar_hash(self):
        self.write_bundle(manifest={'0001_one.sql': 'f'*64})
        self.write_report()
        with self.assertRaisesRegex(RuntimeError, 'bundle SHA or manifest'):
            self.check()


if __name__ == '__main__':
    unittest.main()
