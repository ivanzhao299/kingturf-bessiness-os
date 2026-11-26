"""TD-REL-011 control tests. Docker/HTTP are substitutes, never real image proof.

Real filesystem snapshots, source parsing/binding, CLI control flow and fence text
are exercised. PostgreSQL/migration drills remain in their separate real suites.
"""
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('forward_application', ROOT / 'scripts/application_release.py')
ar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ar)


class ForwardRecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / '.release-image-recovery/123-1'
        self.bundle.mkdir(parents=True)
        self.old, self.sha, self.control = 'a'*40, 'b'*40, 'c'*40
        self.expected = {f'{n:04d}_fixture.sql': 'd'*64 for n in range(1, 78)}
        self.rows = [{'name': n, 'checksum': h} for n, h in self.expected.items()]
        self.gate = ar.load_gate()
        (self.root / '.release-sha').write_text(self.old)
        self.env_path = self.root / '.env.production'
        self.env_path.write_bytes(b'PRIVATE_TEST_VALUE=not-public\nKINGTURF_WRITE_FENCE=disabled\n')
        self.env_path.chmod(0o600)
        state = self.root / '.release-migration-state/history.json'
        state.parent.mkdir()
        state.write_text('{"historical":"untouched"}')
        (self.root / '.release-migration-evidence').mkdir()
        (self.bundle / 'bundle.tar.gz').write_bytes(b'fixture archive')
        (self.bundle / 'migrations.json').write_text(json.dumps(self.expected, sort_keys=True))
        self.approval = {'release_sha': self.sha, 'migration_manifest_sha256': hashlib.sha256((self.bundle / 'migrations.json').read_bytes()).hexdigest()}
        self.identities = {s: {'approved_digest': 'sha256:'+d*64, 'local_ref': f'local/{s}@sha256:{d*64}'} for s, d in (('api', '1'), ('web', '2'))}
        now = datetime.now(timezone.utc)
        auth = {'kind': 'delegated_application_recovery', 'authorization_source_thread': '01a1c9d5-653a-7bf0-a627-c2eab5ac0834', 'release_sha': self.sha, 'control_sha': self.control, 'operator': 'codex', 'migration_execution': 'forbidden', 'started_at_utc': (now-timedelta(minutes=1)).isoformat(), 'window_end_utc': (now+timedelta(hours=2)).isoformat(), 'smoke': 'PASS'}
        (self.bundle / 'authorization.json').write_text(json.dumps(auth))
        self.containers = {}
        for service, digit in (('api', '3'), ('web', '4'), ('postgres', '5')):
            mounts = []
            if service != 'web':
                target = '/var/lib/postgresql/data' if service == 'postgres' else '/var/lib/kingturf/attachments'
                source = self.root / ('postgres' if service == 'postgres' else 'attachments')
                source.mkdir()
                mounts = [{'Type': 'bind', 'Source': str(source), 'Destination': target}]
            self.containers[service] = {'Id': digit*64, 'Name': '/'+ar.PROJECT+'-'+service+'-1', 'Image': 'sha256:'+digit*64, 'RestartCount': 3 if service == 'api' else 0, 'Config': {'Image': 'retained/'+service+'@sha256:'+digit*64, 'Labels': {'com.docker.compose.project': ar.PROJECT, 'com.docker.compose.service': service}, 'Env': ['KINGTURF_RELEASE_SHA='+self.old, 'KINGTURF_WRITE_FENCE=disabled', 'PRIVATE_TEST_VALUE=not-public']}, 'State': {'Status': 'restarting' if service == 'api' else 'running', 'Running': True, 'Restarting': service == 'api', 'ExitCode': 1 if service == 'api' else 0, 'StartedAt': (now-timedelta(seconds=30)).isoformat(), 'FinishedAt': now.isoformat(), 'OOMKilled': False, 'Health': {'Status': 'healthy' if service == 'postgres' else 'unhealthy'}}, 'Mounts': mounts}
        self.logs = 'Error: Migration compatibility check failed: 0077_fixture.sql:drifted\nPRIVATE_TEST_VALUE=not-public'
        self.events = []
        self.active_connections = 0
        self.stop_still_restarting = False
        self.fail_probe_fence = None
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        patches = [mock.patch.object(ar, 'ROOT', self.root), mock.patch.object(self.gate, 'RELEASE', self.root), mock.patch.object(self.gate, 'POSTGRES', self.root/'postgres'), mock.patch.object(self.gate, 'ATTACHMENTS', self.root/'attachments'), mock.patch.object(ar, 'load_gate', return_value=self.gate), mock.patch.object(self.gate, 'inventory', side_effect=self.inventory), mock.patch.object(self.gate, 'command', side_effect=self.read_command), mock.patch.object(ar, 'command', side_effect=self.app_command), mock.patch.object(ar, 'compose', side_effect=self.compose), mock.patch.object(ar, 'verify_write_channels', return_value={}), mock.patch.object(ar.images, 'load_bundle', side_effect=lambda _: (self.approval, self.identities, {})), mock.patch.object(ar.images, 'check_image', side_effect=lambda i: self.events.append(('check-image', i['approved_digest']))), mock.patch.object(ar.images, 'verify_runtime', side_effect=self.runtime), mock.patch.object(ar, 'probe', side_effect=self.probe), mock.patch.object(ar.time, 'sleep'), mock.patch.dict(os.environ, RELEASE_SHA=self.sha, RELEASE_CONTROL_SHA=self.control)]
        for patch in patches:
            self.stack.enter_context(patch)

    def inventory(self, root, expected):
        self.assertEqual(root, str(self.root))
        classification, pending = self.gate.classify_registry(self.rows, expected)
        return {}, self.rows, classification, pending

    def lookup(self, key):
        return next(c for s, c in self.containers.items() if key in (s, c['Id'], ar.PROJECT+'-'+s+'-1'))

    def read_command(self, argv, **kwargs):
        self.events.append(('read', tuple(argv)))
        if argv[1:3] == ['container', 'ls']:
            service = argv[-1].split('=')[-1]
            return self.containers[service]['Id']
        if argv[1] == 'inspect':
            return json.dumps([self.lookup(k) for k in argv[2:]])
        if argv[1] == 'logs':
            return self.logs
        if argv[1:3] == ['image', 'inspect']:
            return '[]'
        self.fail('Unexpected read-only command')

    def app_command(self, argv, **kwargs):
        self.events.append(('command', tuple(argv)))
        if argv[1] == 'inspect':
            return json.dumps([self.lookup(k) for k in argv[2:]]).encode()
        if argv[1:3] == ['image', 'inspect']:
            return b'[]'
        if argv[1] == 'exec':
            self.assertIn('BEGIN READ ONLY', kwargs['data'].decode())
            if 'pg_stat_activity' in kwargs['data'].decode():
                return str(self.active_connections).encode()
            return json.dumps([r | {'applied_at': 'original-time'} for r in self.rows]).encode()
        self.fail('Unexpected application command')

    def compose(self, *args, env=None):
        self.events.append(('compose', args, self.fence()))
        api = self.containers['api']
        if args[0] == 'stop' and not self.stop_still_restarting:
            api['State'].update(Status='exited', Running=False, Restarting=False)
        if args[0] == 'up':
            self.assertNotIn('build', args)
            self.assertEqual(env['KINGTURF_RELEASE_SHA'], self.sha)
            api['State'].update(Status='running', Running=True, Restarting=False, ExitCode=0, Health={'Status': 'healthy'})
            api['Config']['Env'] = ['KINGTURF_RELEASE_SHA='+self.sha, 'KINGTURF_WRITE_FENCE='+env['KINGTURF_WRITE_FENCE']]
        return b''

    def fence(self):
        return 'enabled' if b'KINGTURF_WRITE_FENCE=enabled' in self.env_path.read_bytes() else 'disabled'

    def runtime(self, bundle):
        self.events.append(('runtime', self.fence()))
        return {'images': self.identities, 'release_sha': self.sha}

    def probe(self, base, sha):
        self.events.append(('probe', base, self.fence()))
        self.assertEqual(sha, self.sha)
        if self.fail_probe_fence == self.fence():
            raise RuntimeError('synthetic failed candidate probe')

    def source(self):
        return self.gate.inspect_forward_recovery(str(self.root), self.expected, self.sha)

    def save_source(self, source=None):
        path = self.bundle / 'forward-source.json'
        path.write_text(json.dumps(source or self.source(), sort_keys=True))
        path.chmod(0o600)
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def prepare(self):
        return ar.prepare_forward_recovery(self.bundle, self.save_source())

    def stops(self):
        return [e for e in self.events if e[0] == 'compose' and e[1][0] == 'stop']

    def switch_cli(self):
        before = {'registry': ar.registry_snapshot(), 'migration_state_hashes': ar.state_hashes(), 'recovery_images': [], 'isolated_restore': 'PASS', 'backup': {}}
        (self.bundle / 'before.json').write_text(json.dumps(before))
        with mock.patch.object(sys, 'argv', ['application_release.py', 'switch', str(self.bundle)]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            ar.main()

    def test_source_binds_identity_schema_marker_and_time_without_log_or_secret_contents(self):
        source = self.source()
        self.assertEqual(source['api_container_id'], '3'*64)
        self.assertEqual(source['api_image_id'], 'sha256:'+'3'*64)
        self.assertEqual(source['old_release_sha'], self.old)
        self.assertEqual(source['candidate_sha'], self.sha)
        self.assertEqual(source['manifest_sha256'], self.approval['migration_manifest_sha256'])
        self.assertEqual(source['failure']['migrations'], ['0077_fixture.sql'])
        self.assertNotIn('not-public', json.dumps(source))
        self.assertNotIn('preflight', source)
        self.gate.validate_forward_source(source, self.expected, self.sha)
        self.assertEqual(self.stops(), [])

    def test_healthy_or_merely_unhealthy_or_unproven_failed_api_cannot_prepare(self):
        api = self.containers['api']
        for state, logs in (({'Status': 'running', 'Running': True, 'Restarting': False, 'ExitCode': 0, 'Health': {'Status': 'healthy'}}, self.logs), ({'Status': 'running', 'Running': True, 'Restarting': False, 'ExitCode': 0, 'Health': {'Status': 'unhealthy'}}, self.logs), ({'Status': 'restarting', 'Restarting': True, 'ExitCode': 1, 'Health': {'Status': 'unhealthy'}}, 'unrelated startup error')):
            with self.subTest(state=state):
                api['State'].update(state)
                self.logs = logs
                with self.assertRaises(RuntimeError):
                    self.prepare()
                self.assertEqual(self.stops(), [])
                self.assertEqual(self.fence(), 'disabled')

    def test_pending_drift_or_wrong_target_never_stops_or_changes_fence(self):
        original = copy.deepcopy(self.rows)
        for rows in (original[:-1], original[:-1]+[original[-1] | {'checksum': 'e'*64}], original+[{'name': '9999_unknown.sql', 'checksum': 'e'*64}]):
            with self.subTest(rows=len(rows)):
                self.rows = rows
                with self.assertRaises(RuntimeError):
                    self.prepare()
                self.assertEqual(self.stops(), [])
                self.assertEqual(self.fence(), 'disabled')

    def test_old_record_source_container_image_marker_or_candidate_changes_are_rejected(self):
        original = self.source()
        mutations = [('api_container_id', 'f'*64), ('api_image_id', 'sha256:'+'f'*64), ('old_release_sha', 'f'*40), ('marker', 'f'*40), ('candidate_sha', 'f'*40), ('manifest_sha256', 'f'*64), ('restart_count', 2)]
        for key, value in mutations:
            with self.subTest(key=key):
                checksum = self.save_source(original | {key: value})
                with self.assertRaises(RuntimeError):
                    ar.prepare_forward_recovery(self.bundle, checksum)
                self.assertEqual(self.stops(), [])
        expired = original | {'observed_at_utc': (datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat(), 'expires_at_utc': (datetime.now(timezone.utc)-timedelta(minutes=5)).isoformat()}
        with self.assertRaisesRegex(RuntimeError, 'expired'):
            ar.prepare_forward_recovery(self.bundle, self.save_source(expired))
        self.assertEqual(self.stops(), [])

    def test_source_byte_tamper_or_candidate_approval_tamper_is_rejected_before_stop(self):
        checksum = self.save_source()
        with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
            ar.prepare_forward_recovery(self.bundle, 'f'*64)
        self.approval['migration_manifest_sha256'] = 'f'*64
        with self.assertRaisesRegex(RuntimeError, 'manifest binding'):
            ar.prepare_forward_recovery(self.bundle, checksum)
        self.assertEqual(self.stops(), [])

    def test_prepare_takes_private_exclusive_snapshots_and_stops_without_starting_old_api(self):
        previous = os.umask(0o022)
        try:
            result = self.prepare()
        finally:
            os.umask(previous)
        self.assertEqual(result['forward_recovery'], 'PREPARED')
        self.assertEqual(self.fence(), 'enabled')
        self.assertEqual(len(self.stops()), 1)
        self.assertFalse(any(e[0] == 'compose' and e[1][0] == 'up' for e in self.events))
        for name in ('forward-before.json', 'forward-containers.json', 'forward-env', 'forward-preparation.json'):
            self.assertEqual((self.bundle/name).stat().st_mode & 0o777, 0o600)
        ar.verify_forward_unchanged(self.bundle)
        self.assertTrue(ar.forward_prepared(self.bundle, self.approval))
        with self.assertRaises(RuntimeError):
            self.prepare()
        self.assertEqual(len(self.stops()), 1)

    def test_still_restarting_after_stop_fails_and_keeps_persisted_fence(self):
        self.stop_still_restarting = True
        with self.assertRaisesRegex(RuntimeError, 'not truly stopped'):
            self.prepare()
        self.assertEqual(self.fence(), 'enabled')
        self.assertEqual(json.loads((self.bundle/'forward-preparation.json').read_bytes())['phase'], 'FAILED')

    def test_database_not_drained_keeps_stop_fence_and_does_not_restart_old_api(self):
        self.active_connections = 1
        with self.assertRaisesRegex(RuntimeError, 'activity remained'):
            self.prepare()
        self.assertEqual(self.fence(), 'enabled')
        self.assertFalse(self.containers['api']['State']['Running'])
        self.assertFalse(any(e[0] == 'compose' and e[1][0] == 'up' for e in self.events))

    def test_registry_applied_at_or_historical_state_change_after_stop_fails(self):
        original = ar.verify_forward_unchanged
        calls = []
        def check(bundle):
            calls.append(True)
            if len(calls) == 2:
                (self.root/'.release-migration-state/history.json').write_text('changed')
            return original(bundle)
        with mock.patch.object(ar, 'verify_forward_unchanged', side_effect=check):
            with self.assertRaisesRegex(RuntimeError, 'historical migration state changed'):
                self.prepare()
        self.assertEqual(self.fence(), 'enabled')

    def test_success_unfences_only_after_fenced_identity_and_internal_public_probes(self):
        self.prepare()
        self.events.clear()
        self.switch_cli()
        unfenced_up = next(i for i, e in enumerate(self.events) if e[0] == 'compose' and e[1][0] == 'up' and e[2] == 'disabled')
        self.assertTrue(any(e[0] == 'runtime' and e[1] == 'enabled' for e in self.events[:unfenced_up]))
        gated_probes = [e[1] for e in self.events[:unfenced_up] if e[0] == 'probe' and e[2] == 'enabled']
        self.assertEqual(gated_probes, ['http://127.0.0.1:4332', 'https://erp.kingturf.cn'])
        self.assertEqual(self.fence(), 'disabled')
        self.assertEqual((self.root/'.release-sha').read_text(), self.sha)
        body = json.loads((self.root/'.release-migration-evidence/image_compatibility.json').read_bytes())
        self.assertIn('candidate_app_on_schema', body)
        self.assertNotIn('old_app_on_new_schema', body)

    def test_failure_before_gated_success_never_unfences_or_revives_old_image(self):
        self.prepare()
        self.events.clear()
        self.fail_probe_fence = 'enabled'
        with self.assertRaisesRegex(RuntimeError, 'no previous-image restart'):
            self.switch_cli()
        self.assertEqual(self.fence(), 'enabled')
        self.assertFalse(any(e[0] == 'compose' and e[1][0] == 'up' and e[2] == 'disabled' for e in self.events))
        self.assertEqual((self.root/'.release-sha').read_text(), self.old)

    def test_failure_after_unfence_reenables_fence_and_stops_candidate(self):
        self.prepare()
        self.fail_probe_fence = 'disabled'
        with self.assertRaisesRegex(RuntimeError, 'no previous-image restart'):
            self.switch_cli()
        self.assertEqual(self.fence(), 'enabled')
        self.assertFalse(self.containers['api']['State']['Running'])
        self.assertEqual((self.root/'.release-sha').read_text(), self.old)

    def test_normal_switch_keeps_original_single_unfenced_start_sequence(self):
        # Normal backup has already stopped the API before switch is invoked.
        self.containers['api']['State'].update(Status='exited', Running=False, Restarting=False)
        self.switch_cli()
        starts = [e for e in self.events if e[0] == 'compose' and e[1][0] == 'up']
        self.assertEqual(len(starts), 1)
        self.assertEqual(starts[0][2], 'disabled')
        self.assertFalse((self.bundle/'forward-preparation.json').exists())

    def test_precheck_failure_on_changed_source_does_not_stop_an_unrelated_healthy_api(self):
        self.prepare()
        self.events.clear()
        self.containers['api']['Id'] = '9'*64
        self.containers['api']['State'].update(Status='running', Running=True, Restarting=False, ExitCode=0, Health={'Status': 'healthy'})
        with mock.patch.object(ar, 'precheck', side_effect=RuntimeError('changed source')), mock.patch.object(sys, 'argv', ['application_release.py', 'precheck', str(self.bundle)]), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'no previous-image restart'):
                ar.main()
        self.assertEqual(self.stops(), [])
        self.assertEqual(self.fence(), 'enabled')

    def test_metadata_failure_after_verified_switch_also_reenables_fence(self):
        self.prepare()
        with mock.patch.object(ar, 'advance_image_evidence', side_effect=RuntimeError('synthetic evidence write failure')):
            with self.assertRaisesRegex(RuntimeError, 'no previous-image restart'):
                self.switch_cli()
        self.assertEqual(self.fence(), 'enabled')
        self.assertFalse(self.containers['api']['State']['Running'])

    def test_docker_stderr_startup_proof_is_read_without_disclosing_logs(self):
        spec = importlib.util.spec_from_file_location('stderr_preflight', ROOT/'scripts/production_preflight.py')
        gate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gate)
        result = mock.Mock(returncode=0, stdout='', stderr=self.logs)
        with mock.patch.object(gate.subprocess, 'run', return_value=result):
            proof = gate.failed_startup_proof(self.containers['api'], self.expected)
        self.assertEqual(proof['reason'], 'startup_migration_compatibility')
        self.assertNotIn('not-public', json.dumps(proof))


if __name__ == '__main__':
    unittest.main()
