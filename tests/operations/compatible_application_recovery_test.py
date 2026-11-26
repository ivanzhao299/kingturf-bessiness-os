"""Ordinary B failure -> explicit R control flow. Real Git/tar/report validation;
Docker images, HTTP probes and previously-verified backup are synthetic substitutes.
L/B/R have distinct container, image and configured-reference identities.
"""
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import unittest
from unittest import mock

import forward_recovery_test as fixtures
ar = fixtures.ar


class CompatibleApplicationRecoveryTest(unittest.TestCase):
    def setUp(self):
        self.host = fixtures.ForwardRecoveryTest('runTest')
        self.host.setUp()
        self.addCleanup(self.host.doCleanups)
        h = self.host
        self.events = h.events
        repo = h.root/'git-source'
        repo.mkdir()
        def git(*args):
            p = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, timeout=60)
            self.assertEqual(p.returncode, 0, p.stderr)
            return p.stdout.strip()
        git('init', '--quiet', '-b', 'main')
        git('config', 'user.name', 'Synthetic compatible runtime fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        directory = repo/'packages/database/migrations'
        directory.mkdir(parents=True)
        self.expected = {}
        for n in range(1, 78):
            name, raw = f'{n:04d}_fixture.sql', f'SELECT {n};\n'.encode()
            self.expected[name] = hashlib.sha256(raw).hexdigest()
            if n < 77:
                (directory/name).write_bytes(raw)
        git('add', '.')
        git('commit', '--quiet', '-m', 'L fixture')
        h.old = git('rev-parse', 'HEAD')
        (directory/'0077_fixture.sql').write_bytes(b'SELECT 77;\n')
        git('add', '.')
        git('commit', '--quiet', '-m', 'R fixture')
        self.rsha = git('rev-parse', 'HEAD')
        git('branch', 'recovery')
        h.expected = self.expected
        h.rows = [{'name': n, 'checksum': d} for n, d in self.expected.items()]
        (h.root/'.release-sha').write_text(h.old)
        for c in h.containers.values():
            c['Config']['Env'] = ['KINGTURF_RELEASE_SHA='+h.old, 'KINGTURF_WRITE_FENCE=enabled']
        h.containers['api']['State'].update(Status='exited', Running=False, Restarting=False)
        h.env_path.write_text('KINGTURF_RELEASE_SHA='+h.old+'\nKINGTURF_WRITE_FENCE=enabled\n')
        (h.bundle/'migrations.json').write_text(json.dumps(self.expected, sort_keys=True))
        h.approval['migration_manifest_sha256'] = hashlib.sha256((h.bundle/'migrations.json').read_bytes()).hexdigest()
        (h.bundle/'release.json').write_text(json.dumps(h.approval))
        self.ridentities = {s: {'approved_digest': 'sha256:'+d*64, 'local_ref': 'local/recovery-'+s+'@sha256:'+d*64} for s, d in (('api', '8'), ('web', '9'))}
        self.rrelease = {'release_sha': self.rsha, 'migration_manifest_sha256': h.approval['migration_manifest_sha256'], 'images': {s: {'source': 'ghcr.io/ivanzhao299/kingturf-erp-'+s, 'digest': i['approved_digest']} for s, i in self.ridentities.items()}}
        root = h.root/'.release-migration-evidence'
        self.material_root = root
        source = root/'source.bundle'
        git('bundle', 'create', str(source), '--all')
        archive = root/'R.tar.gz'
        with tarfile.open(archive, 'w:gz') as stream:
            for name, value in (('release.json', self.rrelease), ('migrations.json', self.expected)):
                data = json.dumps(value, sort_keys=True).encode()
                item = tarfile.TarInfo(name)
                item.size = len(data)
                stream.addfile(item, io.BytesIO(data))
        digest = lambda v: hashlib.sha256(json.dumps(v, sort_keys=True).encode()).hexdigest()
        binding = {'legacy_business_sha': h.old, 'recovery_release_sha': self.rsha, 'recovery_main_sha': self.rsha, 'api_digest': self.ridentities['api']['approved_digest'], 'web_digest': self.ridentities['web']['approved_digest'], 'target_manifest_sha256': digest(self.expected), 'recovery_bundle_sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}
        now = datetime.now(timezone.utc)
        records = [{'name': n, 'checksum': d, 'applied_at': (now-timedelta(hours=1)).isoformat()} for n, d in self.expected.items()]
        files = {'.release-migration-state/orchestration-state.json': 'e'*64, '.staging/wave2-123-1/plan.json': 'f'*64}
        names = ('failed_candidate_switch', 'recovery_started_fenced', 'recovery_identity_health_ready_version', 'write_fence_disabled', 'authenticated_write', 'registry_and_state_unchanged')
        report = {'kind': 'compatible_application_recovery_drill_v1', 'isolated': True, 'bindings': binding.copy(), 'tested_at_utc': (now-timedelta(seconds=10)).isoformat(), 'steps': [{'name': n, 'result': 'PASS', 'at_utc': (now-timedelta(seconds=50-i)).isoformat()} for i, n in enumerate(names)], 'runtime': {'release_sha': self.rsha, 'api_digest': binding['api_digest'], 'web_digest': binding['web_digest']}, 'authenticated_write': {'authenticated': True, 'status': 201, 'operation': 'synthetic-only'}, 'registry': {'includes_applied_at': True, 'before': records, 'after': records, 'before_sha256': digest(records), 'after_sha256': digest(records)}, 'migration_state': {'before_files': files, 'after_files': files, 'before_sha256': digest(files), 'after_sha256': digest(files)}}
        (root/'report.json').write_text(json.dumps(report))
        binding['report_sha256'] = hashlib.sha256((root/'report.json').read_bytes()).hexdigest()
        approved = {'release_sha': h.sha, 'approved_suffix': ['0077_fixture.sql'], 'approver': 'synthetic fixture', 'approved_at_utc': (now-timedelta(seconds=5)).isoformat(), 'window_end_utc': (now+timedelta(hours=2)).isoformat(), 'image_compatibility_mode': 'compatible_recovery', 'compatible_recovery': binding}
        (root/'migration-recovery-approval.json').write_text(json.dumps(approved))
        (root/'compatible_recovery.json').write_text(json.dumps({'kind': 'compatible_application_recovery_v1', 'recovery_bundle_file': archive.name, 'source_bundle_file': source.name, 'report_file': 'report.json'}))
        self.fail_b = True
        self.fail_b_fence = None
        self.fail_r_fence = None
        self.sequence = 0
        self.restore_command = h.app_command
        ar.images.load_bundle.side_effect = self.load_bundle
        ar.images.check_image.side_effect = self.check_image
        ar.images.verify_runtime.side_effect = self.runtime
        self.importer = h.stack.enter_context(mock.patch.object(ar.images, 'import_bundle', side_effect=self.import_bundle))
        ar.compose.side_effect = self.compose
        ar.command.side_effect = self.command
        ar.probe.side_effect = self.probe

    def load_bundle(self, root):
        if Path(root).name == 'compatible-target':
            return self.rrelease, self.ridentities, {}
        return self.host.approval, self.host.identities, {}

    def check_image(self, identity):
        self.events.append(('image-check', identity['local_ref']))
        d = identity['approved_digest'][7]
        return {'image_id': 'sha256:'+{'1': '6', '2': '7', '8': 'a', '9': 'b'}[d]*64}

    def import_bundle(self, root):
        self.events.append(('import', str(root)))
        return {'release_sha': self.rsha, 'images': self.ridentities, 'registry_stopped': True}

    def compose(self, *args, env=None):
        h = self.host
        self.assertEqual(args[0], 'up', 'Forward paths must stop by immutable ID')
        sha = env['KINGTURF_RELEASE_SHA']
        self.assertIn(sha, (h.sha, self.rsha), 'Old L must never be started')
        identities = self.ridentities if sha == self.rsha else h.identities
        self.sequence += 1
        for service in ('api', 'web') if 'web' in args else ('api',):
            old = h.containers[service]
            h.retired[old['Id']] = copy.deepcopy(old)
            current = copy.deepcopy(old)
            current['Id'] = hashlib.sha256((sha+service+str(self.sequence)).encode()).hexdigest()
            current['Image'] = self.check_image(identities[service])['image_id']
            current['Config']['Image'] = identities[service]['local_ref']
            current['Config']['Env'] = ['KINGTURF_RELEASE_SHA='+sha, 'KINGTURF_WRITE_FENCE='+env['KINGTURF_WRITE_FENCE']]
            current['State'].update(Status='running', Running=True, Restarting=False, ExitCode=0, Health={'Status': 'healthy'})
            h.containers[service] = current
        self.events.append(('up', sha, h.containers['api']['Id'], h.containers['api']['Image'], h.containers['api']['Config']['Image'], h.fence()))
        return b''

    def command(self, argv, **kwargs):
        if argv[1] == 'compose':
            # Existing exact-ID legacy recovery of the actual healthy R snapshot.
            recipe = json.loads((self.host.bundle/'recovery-compose.json').read_bytes())
            env = recipe['services']['api']['environment']
            return self.compose('up', '-d', '--no-deps', '--pull', 'never', 'api', 'web', env=env)
        return self.restore_command(argv, **kwargs)

    def runtime(self, root):
        sha = self.rsha if Path(root).name == 'compatible-target' else self.host.sha
        expected = self.ridentities if sha == self.rsha else self.host.identities
        for service in ('api', 'web'):
            current = self.host.containers[service]
            self.assertEqual(current['Image'], self.check_image(expected[service])['image_id'])
            self.assertEqual(current['Config']['Image'], expected[service]['local_ref'])
        self.events.append(('identity', sha, self.host.fence()))
        return {'release_sha': sha, 'images': expected}

    def probe(self, base, sha):
        self.events.append(('probe', sha, base, self.host.fence()))
        if sha == self.host.sha and self.fail_b and self.fail_b_fence in (None, self.host.fence()) or sha == self.rsha and self.fail_r_fence == self.host.fence():
            raise RuntimeError('synthetic HTTP probe failure')

    def before(self, handover=True):
        h = self.host
        before = {'previous_sha': (h.root/'.release-sha').read_text(), 'registry': ar.registry_snapshot(), 'migration_state_hashes': ar.state_hashes(), 'recovery_images': [{'name': c['Name'], 'container_id': c['Id'], 'id': c['Image'], 'ref': c['Config']['Image']} for c in (h.containers['api'], h.containers['web'])], 'isolated_restore': 'PASS', 'backup': {}}
        if handover:
            before['handover_state'] = True
        return before

    def stage(self, handover=True):
        h = self.host
        before = self.before(handover)
        target = ar.prepare_compatible_target(h.bundle, before)
        if target:
            before['compatible_recovery'] = target
        (h.bundle/'before.json').write_text(json.dumps(before))
        (h.bundle/'recovery-env').write_bytes(h.env_path.read_bytes())
        recipe = {'services': {s: {'image': h.containers[s]['Image'], 'environment': dict(v.split('=', 1) for v in h.containers[s]['Config']['Env'])} for s in ('api', 'web')}}
        (h.bundle/'recovery-compose.json').write_text(json.dumps(recipe))
        # The expensive backup/isolated restore is an explicit fixture boundary;
        # its established postcondition is a stopped API before switch.
        h.containers['api']['State'].update(Status='exited', Running=False, Restarting=False)
        return before

    def switch(self):
        h = self.host
        with mock.patch.object(sys, 'argv', ['application_release.py', 'switch', str(h.bundle)]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            ar.main()

    def test_ordinary_b_failure_selects_imported_r_and_never_calls_l_start(self):
        h = self.host
        before = self.stage()
        self.assertIn('compatible_recovery', before)
        self.assertFalse((h.bundle/'forward-preparation.json').exists())
        with mock.patch.object(ar, 'recover_previous_application', side_effect=AssertionError('L recovery forbidden')) as legacy:
            with self.assertRaisesRegex(RuntimeError, 'approved compatible application R recovered'):
                self.switch()
        legacy.assert_not_called()
        starts = [e for e in self.events if e[0] == 'up']
        self.assertEqual([e[1] for e in starts], [h.sha, self.rsha, self.rsha])
        self.assertEqual([e[-1] for e in starts], ['enabled', 'enabled', 'disabled'])
        self.assertNotEqual(starts[0][2:5], starts[1][2:5])
        self.assertEqual((h.root/'.release-sha').read_text(), self.rsha)
        self.assertEqual(h.fence(), 'disabled')
        self.assertEqual(json.loads((h.bundle/'application-state.json').read_bytes())['phase'], 'RECOVERED_COMPATIBLE_APPLICATION')
        ar.verify_unchanged(h.bundle)

    def test_b_failure_after_unfence_still_recovers_r_without_starting_l(self):
        self.stage()
        self.fail_b_fence = 'disabled'
        with self.assertRaisesRegex(RuntimeError, 'approved compatible application R recovered'):
            self.switch()
        starts = [(e[1], e[-1]) for e in self.events if e[0] == 'up']
        self.assertEqual(starts, [(self.host.sha, 'enabled'), (self.host.sha, 'disabled'), (self.rsha, 'enabled'), (self.rsha, 'disabled')])
        self.assertEqual((self.host.root/'.release-sha').read_text(), self.rsha)

    def test_source_replacement_during_r_import_is_rejected_before_backup_stop(self):
        before = self.before()
        original = self.import_bundle
        def replace_after_import(root):
            result = original(root)
            self.host.replace_api()
            return result
        self.importer.side_effect = replace_after_import
        with mock.patch.object(ar, 'precheck', return_value=before):
            with self.assertRaisesRegex(RuntimeError, 'source changed during target import'):
                ar.backup(self.host.bundle)
        self.assertEqual(self.host.stops(), [])
        self.assertTrue(self.host.containers['api']['State']['Running'])
        self.assertFalse(any(e[0] == 'up' for e in self.events))

    def test_r_fenced_probe_failure_keeps_fence_and_does_not_try_l(self):
        self.stage()
        self.fail_r_fence = 'enabled'
        with mock.patch.object(ar, 'recover_previous_application', side_effect=AssertionError('L forbidden')):
            with self.assertRaisesRegex(RuntimeError, 'old L was not restarted'):
                self.switch()
        h = self.host
        self.assertEqual(h.fence(), 'enabled')
        self.assertFalse(h.containers['api']['State']['Running'])
        self.assertFalse(any(e[0] == 'up' and e[1] == self.rsha and e[-1] == 'disabled' for e in self.events))
        self.assertEqual((h.root/'.release-sha').read_text(), h.old)

    def test_r_probe_failure_after_unfence_stops_r_and_retains_fence(self):
        self.stage()
        self.fail_r_fence = 'disabled'
        with self.assertRaisesRegex(RuntimeError, 'old L was not restarted'):
            self.switch()
        self.assertEqual(self.host.fence(), 'enabled')
        self.assertFalse(self.host.containers['api']['State']['Running'])
        stopped = [e[1] for e in self.events if e[0] == 'stopped-id']
        self.assertIn(self.host.containers['api']['Id'], stopped)
        self.assertNotIn('3'*64, stopped)

    def test_missing_real_r_report_prevents_target_import_and_b_switch(self):
        (self.material_root/'report.json').unlink()
        with self.assertRaises(RuntimeError):
            self.stage()
        self.importer.assert_not_called()
        self.assertFalse(any(e[0] == 'up' for e in self.events))
        self.assertEqual(self.host.stops(), [])

    def test_actual_healthy_r_retry_keeps_legacy_source_without_consuming_stale_l_approval(self):
        self.stage()
        with self.assertRaisesRegex(RuntimeError, 'approved compatible application R recovered'):
            self.switch()
        h = self.host
        old_bundle = h.bundle
        h.bundle = old_bundle.parent/'123-2'
        h.bundle.mkdir()
        for name in ('authorization.json', 'release.json', 'migrations.json', 'bundle.tar.gz'):
            (h.bundle/name).write_bytes((old_bundle/name).read_bytes())
        (self.material_root/'migration-recovery-approval.json').write_text('stale invalid L approval')
        with mock.patch.object(ar, 'load_recovery_gate', side_effect=AssertionError('healthy path must not consume stale L evidence')):
            before = self.stage(handover=False)
        self.assertNotIn('compatible_recovery', before)
        with mock.patch.object(ar, 'recover_previous_application', wraps=ar.recover_previous_application) as legacy:
            with self.assertRaisesRegex(RuntimeError, 'previous application recovery attempted'):
                self.switch()
        legacy.assert_called_once()
        self.assertEqual(h.fence(), 'disabled')
        self.assertEqual((h.root/'.release-sha').read_text(), self.rsha)
        self.assertTrue(h.containers['api']['State']['Running'])


if __name__ == '__main__':
    unittest.main()
