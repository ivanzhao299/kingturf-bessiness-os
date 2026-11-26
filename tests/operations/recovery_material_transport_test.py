"""Transport tests with real Git/OCI/raw bytes and the actual W4 validation CLI.

All drill reports, OCI layers, publication metadata and SSH identities here are
SYNTHETIC fixtures. No images start, no authenticated business write is made, and
no network/upload/production operation runs. These tests are NOT drill evidence.
The optional test-only dependency root locates fixed W4 code before integration;
production helpers have no dependency override and always execute fixed control C.
"""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest import mock
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DEPENDENCY = Path(os.environ.get('KINGTURF_TRANSPORT_TEST_CONTROL_ROOT', ROOT)).absolute()


def load(name):
    spec = importlib.util.spec_from_file_location('test_'+name, ROOT/'scripts'/(name+'.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


tm = load('recovery_material_transport')
stage = load('stage_recovery_material')


def raw_hash(value):
    return hashlib.sha256(value).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(value, sort_keys=True).encode())


def local_git(root, *args):
    return tm.git(root, *args).decode().strip()


def commit(root, message):
    local_git(root, 'add', '.')
    local_git(root, 'commit', '--quiet', '-m', message)
    return local_git(root, 'rev-parse', 'HEAD')


def synthetic_oci(root, release, manifest):
    """Actual hashed OCI graph; layer data is deliberately not a runnable image."""
    images = {}
    for service in ('api', 'web'):
        blobs = root/service/'blobs/sha256'
        blobs.mkdir(parents=True)
        def blob(value, media):
            raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
            sha = raw_hash(raw)
            (blobs/sha).write_bytes(raw)
            return {'mediaType': media, 'digest': 'sha256:'+sha, 'size': len(raw)}
        layer = blob(b'synthetic-non-runnable-'+service.encode(), 'application/vnd.oci.image.layer.v1.tar+gzip')
        config = blob({'os': 'linux', 'architecture': 'amd64', 'rootfs': {'type': 'layers', 'diff_ids': ['sha256:'+'f'*64]}}, 'application/vnd.oci.image.config.v1+json')
        image = blob({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.manifest.v1+json', 'config': config, 'layers': [layer]}, 'application/vnd.oci.image.manifest.v1+json')
        index = blob({'schemaVersion': 2, 'mediaType': 'application/vnd.oci.image.index.v1+json', 'manifests': [image | {'platform': {'os': 'linux', 'architecture': 'amd64'}}]}, 'application/vnd.oci.image.index.v1+json')
        images[service] = {'source': 'ghcr.io/ivanzhao299/kingturf-erp-'+service, 'digest': index['digest']}
    save(root/'migrations.json', manifest)
    save(root/'release.json', {'release_sha': release, 'migration_manifest_sha256': tm.digest(root/'migrations.json'), 'images': images})
    return images


class RecoveryTransportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = tempfile.TemporaryDirectory(prefix='synthetic-recovery-')
        cls.base = Path(cls.fixture.name)
        repo = cls.base/'control'
        repo.mkdir()
        local_git(repo, 'init', '--quiet', '-b', 'main')
        local_git(repo, 'config', 'user.name', 'Synthetic transport fixture')
        local_git(repo, 'config', 'user.email', 'fixture@example.invalid')
        (repo/'scripts').mkdir()
        for name in tm.CONTROL_FILES:
            source = ROOT if name in ('recovery_material_transport.py', 'stage_recovery_material.py') else DEPENDENCY
            shutil.copyfile(source/'scripts'/name, repo/'scripts'/name)
        shutil.copyfile(ROOT/'scripts/prepare_release_bundle.sh', repo/'scripts/prepare_release_bundle.sh')
        migrations = repo/'packages/database/migrations'
        migrations.mkdir(parents=True)
        for number in range(1, 78):
            (migrations/f'{number:04d}_synthetic.sql').write_text(f'SELECT {number};\n')
        cls.legacy = commit(repo, 'synthetic L with 77 migrations')
        for number in range(78, 82):
            (migrations/f'{number:04d}_synthetic.sql').write_text(f'SELECT {number};\n')
        cls.recovery = commit(repo, 'synthetic R with 81 migrations')
        local_git(repo, 'branch', 'recovery')
        (repo/'export-control').write_text('synthetic fixed export control')
        cls.export_control = commit(repo, 'synthetic immutable export workflow control')
        local_git(repo, 'update-ref', 'refs/remotes/origin/main', cls.export_control)
        tm.command(['git', '-c', 'core.hooksPath='+os.devnull, 'clone', '--quiet', '--no-local', str(repo), str(cls.base/'source')])
        local_git(cls.base/'source', 'checkout', '--quiet', '--detach', cls.recovery)
        cls.manifest = tm.tree_manifest(repo, cls.recovery)
        cls.images = synthetic_oci(cls.base/'oci', cls.recovery, cls.manifest)
        cls.context = {'GITHUB_REPOSITORY': tm.REPOSITORY, 'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REF': 'refs/heads/main', 'GITHUB_RUN_ID': '101', 'GITHUB_RUN_ATTEMPT': '2'}
        real_command = tm.command
        def export_command(argv, **kwargs):
            if argv[0] == 'bash':
                assert Path(argv[1]).read_bytes() == (repo/'scripts/prepare_release_bundle.sh').read_bytes()
                assert Path(argv[1]) != repo/'scripts/prepare_release_bundle.sh'
                assert Path(kwargs['cwd']) != cls.base/'source'
                sql = Path(kwargs['cwd'])/'packages/database/migrations'
                assert {p.name: tm.digest(p) for p in sql.glob('*.sql')} == cls.manifest
                shutil.copytree(cls.base/'oci', argv[-1])
                return b''
            return real_command(argv, **kwargs)
        with mock.patch.dict(os.environ, cls.context), mock.patch.object(tm, 'command', side_effect=export_command):
            tm.export_material(cls.base/'source', repo, cls.export_control, cls.recovery, cls.images['api']['digest'], cls.images['web']['digest'], cls.base/'exported')
        cls.archive = cls.base/'artifact.zip'
        with zipfile.ZipFile(cls.archive, 'w', compression=zipfile.ZIP_STORED) as archive:
            for name in sorted(tm.ARTIFACT_FILES):
                archive.write(cls.base/'exported'/name, name)
        (repo/'business-candidate').write_text('synthetic B')
        cls.candidate = commit(repo, 'synthetic business candidate B')
        selection = repo/'release-materials/compatible-recovery'/cls.candidate
        now = datetime.now(timezone.utc)
        instant = lambda delta: (now+timedelta(microseconds=delta)).isoformat()
        cls.binding = {'legacy_business_sha': cls.legacy, 'recovery_release_sha': cls.recovery, 'recovery_main_sha': cls.export_control, 'api_digest': cls.images['api']['digest'], 'web_digest': cls.images['web']['digest'], 'target_manifest_sha256': tm.canonical(cls.manifest), 'recovery_bundle_sha256': tm.digest(cls.base/'exported/recovery.tar.gz'), 'report_sha256': ''}
        records = [{'name': name, 'checksum': checksum, 'applied_at': (now-timedelta(hours=1)).isoformat()} for name, checksum in sorted(cls.manifest.items())]
        files = {'.release-migration-state/orchestration-state.json': 'e'*64, '.staging/wave2-101-2/plan.json': 'f'*64}
        steps = ('failed_candidate_switch', 'recovery_started_fenced', 'recovery_identity_health_ready_version', 'write_fence_disabled', 'authenticated_write', 'registry_and_state_unchanged')
        report = {'kind': 'compatible_application_recovery_drill_v1', 'isolated': True, 'bindings': {key: value for key, value in cls.binding.items() if key != 'report_sha256'}, 'tested_at_utc': instant(6), 'steps': [{'name': name, 'result': 'PASS', 'at_utc': instant(index)} for index, name in enumerate(steps)], 'runtime': {'release_sha': cls.recovery, 'api_digest': cls.binding['api_digest'], 'web_digest': cls.binding['web_digest']}, 'authenticated_write': {'authenticated': True, 'status': 201, 'operation': 'SYNTHETIC fixture only; never executed'}, 'registry': {'includes_applied_at': True, 'before': records, 'after': records, 'before_sha256': tm.canonical(records), 'after_sha256': tm.canonical(records)}, 'migration_state': {'before_files': files, 'after_files': files, 'before_sha256': tm.canonical(files), 'after_sha256': tm.canonical(files)}}
        save(selection/'report.json', report)
        cls.binding['report_sha256'] = tm.digest(selection/'report.json')
        cls.source = {'kind': 'compatible_recovery_transport_source_v1', 'repository': tm.REPOSITORY, 'workflow': tm.WORKFLOW, 'event': 'workflow_dispatch', 'run_id': 101, 'run_attempt': 2, 'artifact_id': 202, 'artifact_name': 'compatible-recovery-material-'+cls.recovery, 'export_control_sha': cls.export_control, 'provenance_sha256': tm.digest(cls.base/'exported/provenance.json'), 'source_bundle_sha256': tm.digest(cls.base/'exported/source.bundle'), 'artifact_sha256': tm.digest(cls.archive)}
        save(selection/'transport-source.json', cls.source)
        cls.approval = {'release_sha': cls.candidate, 'approved_suffix': [f'{number:04d}_synthetic.sql' for number in range(78, 82)], 'approver': 'SYNTHETIC transport fixture', 'approved_at_utc': instant(7), 'window_end_utc': (now+timedelta(hours=1)).isoformat(), 'image_compatibility_mode': 'compatible_recovery', 'compatible_recovery': cls.binding, 'transport_source_sha256': tm.digest(selection/'transport-source.json')}
        save(selection/'approval.json', cls.approval)
        cls.descriptor = {'kind': 'compatible_application_recovery_v1', 'recovery_bundle_file': 'recovery.tar.gz', 'source_bundle_file': 'source.bundle', 'report_file': 'report.json'}
        save(selection/'compatible_recovery.json', cls.descriptor)
        cls.control = commit(repo, 'synthetic C selects earlier B and successful R artifact')
        local_git(repo, 'update-ref', 'refs/remotes/origin/main', cls.control)
        exported = json.loads((cls.base/'exported/provenance.json').read_bytes())['generated_at_utc']
        cls.publication_run = {'id': 101, 'repository': {'full_name': tm.REPOSITORY}, 'head_repository': {'full_name': tm.REPOSITORY}, 'path': tm.WORKFLOW, 'event': 'workflow_dispatch', 'head_branch': 'main', 'head_sha': cls.export_control, 'run_attempt': 2, 'status': 'completed', 'conclusion': 'success', 'created_at': (now-timedelta(minutes=2)).isoformat(), 'updated_at': exported}
        cls.artifact = {'id': 202, 'name': cls.source['artifact_name'], 'expired': False, 'workflow_run': {'id': 101}, 'digest': 'sha256:'+cls.source['artifact_sha256'], 'created_at': exported}

    @classmethod
    def tearDownClass(cls):
        cls.fixture.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='transport-case-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(self.base/'control', self.root/'control')
        self.repo = self.root/'control'
        self.selection = self.repo/'release-materials/compatible-recovery'/self.candidate
        self.bundle = self.root/'bundle'
        self.bundle.mkdir()
        self.calls = []

    def gh_command(self, argv, **kwargs):
        self.calls.append(argv)
        if argv[:2] == ['gh', 'api']:
            endpoint = argv[2]
            if endpoint.endswith('/runs/101'):
                return json.dumps(self.publication_run).encode()
            if endpoint.endswith('/artifacts/202'):
                return json.dumps(self.artifact).encode()
            if endpoint.endswith('/artifacts/202/zip'):
                shutil.copyfile(self.archive, kwargs['output'])
                return b''
            raise AssertionError('unexpected endpoint '+endpoint)
        return self.real_command(argv, **kwargs)

    def prepare(self):
        self.real_command = tm.command
        with mock.patch.object(tm, 'command', side_effect=self.gh_command):
            result = tm.prepare_material(self.repo, self.control, self.repo, self.candidate, self.bundle)
        self.material = self.bundle/'compatible-recovery'
        self.plan = self.material/'validation-plan.json'
        return result

    def selection_commit(self):
        self.selected_control = commit(self.repo, 'synthetic changed C selection')
        local_git(self.repo, 'update-ref', 'refs/remotes/origin/main', self.selected_control)
        return self.selected_control

    def stage_environment(self):
        known = self.root/'known_hosts'
        known.write_text('synthetic pinned key fixture')
        return {'PROD_SSH_HOST': 'fixture.invalid', 'PROD_SSH_USER': 'fixture', 'PROD_SSH_PORT': '22', 'PROD_DEPLOY_PATH': '/data/kingturf-erp', 'SSH_KNOWN_HOSTS_FILE': str(known), 'GITHUB_RUN_ID': '303', 'GITHUB_RUN_ATTEMPT': '1'}

    def payload(self):
        self.prepare()
        env = self.stage_environment()
        self.remote_calls = []
        real = stage.transport.command
        def transfer(argv, **kwargs):
            if argv[0] == 'ssh':
                self.remote_calls.append(argv)
                return b''
            if argv[0] == 'rsync':
                self.remote_calls.append(argv)
                shutil.copytree(Path(argv[-2].rstrip('/')), self.root/'incoming')
                return b''
            return real(argv, **kwargs)
        with mock.patch.object(stage.transport, 'command', side_effect=transfer):
            self.stage_result = stage.stage_material(self.repo, self.control, self.bundle, self.plan, self.candidate, env)
        incoming = self.root/'incoming'
        return incoming, tm.digest(incoming/'transfer.json')

    def alternative_material(self):
        """A different actual R2 Git/tar/OCI set that the strict CLI accepts alone."""
        (self.repo/'alternative-recovery').write_text('synthetic R2; same 81 SQL bytes')
        recovery = commit(self.repo, 'synthetic alternative internally consistent R2')
        local_git(self.repo, 'update-ref', 'refs/remotes/origin/main', recovery)
        images = synthetic_oci(self.root/'r2-oci', recovery, self.manifest)
        real = tm.command
        def exported(argv, **kwargs):
            if argv[0] == 'bash':
                shutil.copytree(self.root/'r2-oci', argv[-1])
                return b''
            return real(argv, **kwargs)
        with mock.patch.dict(os.environ, self.context), mock.patch.object(tm, 'command', side_effect=exported):
            tm.export_material(self.repo, self.repo, recovery, recovery, images['api']['digest'], images['web']['digest'], self.root/'r2-export')
        local_git(self.repo, 'checkout', '--quiet', '--detach', self.control)
        local_git(self.repo, 'update-ref', 'refs/remotes/origin/main', self.control)
        alternate = self.root/'alternative-material'
        shutil.copytree(self.material, alternate)
        for name in tm.ARTIFACT_FILES:
            shutil.copyfile(self.root/'r2-export'/name, alternate/name)
        archive = self.root/'r2.zip'
        with zipfile.ZipFile(archive, 'w') as writer:
            for name in sorted(tm.ARTIFACT_FILES):
                writer.write(alternate/name, name)
        binding = copy.deepcopy(self.binding)
        binding.update(recovery_release_sha=recovery, recovery_main_sha=recovery, api_digest=images['api']['digest'], web_digest=images['web']['digest'], recovery_bundle_sha256=tm.digest(alternate/'recovery.tar.gz'))
        source = copy.deepcopy(self.source)
        source.update(artifact_name='compatible-recovery-material-'+recovery, export_control_sha=recovery, provenance_sha256=tm.digest(alternate/'provenance.json'), source_bundle_sha256=tm.digest(alternate/'source.bundle'), artifact_sha256=tm.digest(archive))
        save(alternate/'transport-source.json', source)
        report = json.loads((alternate/'report.json').read_bytes())
        now = datetime.now(timezone.utc)
        report.update(bindings={key: value for key, value in binding.items() if key != 'report_sha256'}, tested_at_utc=now.isoformat(), runtime={'release_sha': recovery, 'api_digest': binding['api_digest'], 'web_digest': binding['web_digest']})
        for index, step in enumerate(report['steps']):
            step['at_utc'] = (now-timedelta(microseconds=6-index)).isoformat()
        save(alternate/'report.json', report)
        binding['report_sha256'] = tm.digest(alternate/'report.json')
        body = copy.deepcopy(self.approval)
        body.update(compatible_recovery=binding, transport_source_sha256=tm.digest(alternate/'transport-source.json'), approved_at_utc=now.isoformat(), window_end_utc=(now+timedelta(hours=1)).isoformat())
        save(alternate/'migration-recovery-approval.json', body)
        exported_at = json.loads((alternate/'provenance.json').read_bytes())['generated_at_utc']
        run = copy.deepcopy(self.publication_run)
        run.update(head_sha=recovery, updated_at=exported_at)
        artifact = copy.deepcopy(self.artifact)
        artifact.update(name=source['artifact_name'], digest='sha256:'+source['artifact_sha256'], created_at=exported_at)
        save(alternate/'run.json', run)
        save(alternate/'artifact.json', artifact)
        accepted = tm.validate_material(self.repo, alternate, self.plan)
        self.assertEqual(accepted['release_sha'], self.candidate)
        self.assertNotEqual(accepted['compatible_recovery']['recovery_release_sha'], self.recovery)
        self.assertEqual(len(json.loads(self.plan.read_bytes())['manifest']), 81)
        return alternate

    def test_pre_copy_self_consistent_r2_replacement_cannot_reach_first_ssh(self):
        self.prepare()
        alternate = self.alternative_material()
        original_copy = shutil.copytree
        original_command = stage.transport.command
        ssh_calls = []
        replaced = []
        def race(source, destination, *args, **kwargs):
            if Path(source) == self.material and not replaced:
                replaced.append(True)
                shutil.rmtree(self.material)
                original_copy(alternate, self.material)
            return original_copy(source, destination, *args, **kwargs)
        def command(argv, **kwargs):
            if argv[0] in ('ssh', 'rsync'):
                print('SYNTHETIC replacement reached '+argv[0]+' substitute', file=sys.stderr)
                ssh_calls.append(argv)
                return b''
            return original_command(argv, **kwargs)
        with mock.patch.object(stage.shutil, 'copytree', side_effect=race), mock.patch.object(stage.transport, 'command', side_effect=command):
            with self.assertRaisesRegex(RuntimeError, 'private snapshot selection differs'):
                stage.stage_material(self.repo, self.control, self.bundle, self.plan, self.candidate, self.stage_environment())
        self.assertEqual(replaced, [True])
        self.assertEqual(ssh_calls, [])

    def test_download_time_c_selection_replacement_never_supplies_prepared_bytes(self):
        self.prepare()
        alternate = self.root/'unapproved-selection'
        shutil.copytree(self.material, alternate)
        report = json.loads((alternate/'report.json').read_bytes())
        report['authenticated_write']['operation'] = 'SYNTHETIC internally valid but unapproved replacement'
        save(alternate/'report.json', report)
        approval = copy.deepcopy(self.approval)
        approval['approver'] = 'SYNTHETIC approver absent from C'
        approval['compatible_recovery']['report_sha256'] = tm.digest(alternate/'report.json')
        save(alternate/'migration-recovery-approval.json', approval)
        tm.validate_material(self.repo, alternate, self.plan)
        second = self.root/'second-bundle'
        second.mkdir()
        original_download = tm.download_approved
        def race(source, destination):
            result = original_download(source, destination)
            for original, name in (('migration-recovery-approval.json', 'approval.json'), ('compatible_recovery.json', 'compatible_recovery.json'), ('transport-source.json', 'transport-source.json'), ('report.json', 'report.json')):
                shutil.copyfile(alternate/original, self.selection/name)
            return result
        self.real_command = tm.command
        with mock.patch.object(tm, 'command', side_effect=self.gh_command), mock.patch.object(tm, 'download_approved', side_effect=race):
            with self.assertRaisesRegex(RuntimeError, 'selection bytes differ from fixed control C'):
                tm.prepare_material(self.repo, self.control, self.repo, self.candidate, second)
        raw = (second/'compatible-recovery/migration-recovery-approval.json').read_bytes()
        self.assertEqual(raw, tm.git(self.repo, 'show', self.control+':'+self.selection.relative_to(self.repo).as_posix()+'/approval.json'))
        self.assertNotEqual(raw, (alternate/'migration-recovery-approval.json').read_bytes())

    def test_export_invokes_fixed_prepare_once_and_preserves_original_tar_and_two_refs(self):
        local_git(self.repo, 'checkout', '--quiet', '--detach', self.export_control)
        real = tm.command
        calls = []
        def export(argv, **kwargs):
            if argv[0] == 'bash':
                calls.append((argv, kwargs))
                self.assertEqual(Path(argv[1]).read_bytes(), tm.git(self.repo, 'show', self.export_control+':scripts/prepare_release_bundle.sh'))
                self.assertNotEqual(Path(kwargs['cwd']), self.base/'source')
                shutil.copytree(self.base/'oci', argv[-1])
                return b''
            return real(argv, **kwargs)
        with mock.patch.dict(os.environ, self.context), mock.patch.object(tm, 'command', side_effect=export), mock.patch.object(tm.tarfile, 'open', wraps=tarfile.open) as opened:
            result = tm.export_material(self.base/'source', self.repo, self.export_control, self.recovery, self.images['api']['digest'], self.images['web']['digest'], self.root/'export')
        self.assertEqual(len(calls), 1)
        self.assertEqual(Path(calls[0][0][1]).name, 'prepare_release_bundle.sh')
        self.assertEqual(sum(call.args[1:] == ('w:gz',) for call in opened.call_args_list), 1)
        self.assertEqual(set(result['files']), tm.ARTIFACT_FILES)
        self.assertEqual((self.root/'export/migrations.json').read_bytes(), (self.base/'oci/migrations.json').read_bytes())
        refs = set(local_git(self.repo, 'bundle', 'list-heads', str(self.root/'export/source.bundle')).splitlines())
        self.assertEqual(refs, {self.control+' refs/heads/main', self.recovery+' refs/heads/recovery'})
        self.assertNotEqual(self.export_control, self.control)

    def test_export_never_imports_python_code_from_the_r_checkout(self):
        local_git(self.repo, 'checkout', '--quiet', '--detach', self.export_control)
        source = self.root/'r-source'
        shutil.copytree(self.base/'source', source)
        sentinel = self.root/'r-python-module-executed'
        (source/'json.py').write_text('from pathlib import Path\nPath('+repr(str(sentinel))+').touch()\nraise RuntimeError("synthetic R code imported")\n')
        real = tm.command
        def export(argv, **kwargs):
            if argv[0] == 'bash':
                # Reproduce the fixed prepare script's ordinary stdin Python
                # import behavior, without registry access or changing its pin.
                real([sys.executable, '-B', '-c', 'import json'], cwd=kwargs['cwd'])
                sql = Path(kwargs['cwd'])/'packages/database/migrations'
                self.assertEqual({path.name: tm.digest(path) for path in sql.glob('*.sql')}, self.manifest)
                self.assertEqual(len(list(Path(kwargs['cwd']).rglob('*.py'))), 0)
                shutil.copytree(self.base/'oci', argv[-1])
                return b''
            return real(argv, **kwargs)
        with mock.patch.dict(os.environ, self.context), mock.patch.object(tm, 'command', side_effect=export):
            tm.export_material(source, self.repo, self.export_control, self.recovery, self.images['api']['digest'], self.images['web']['digest'], self.root/'export')
        self.assertFalse(sentinel.exists())

    def test_export_refuses_untrusted_context_before_any_external_command(self):
        with mock.patch.dict(os.environ, self.context | {'GITHUB_REPOSITORY': 'other/repo'}), mock.patch.object(tm, 'command') as called:
            with self.assertRaisesRegex(RuntimeError, 'workflow context'):
                tm.export_material(self.base/'source', self.repo, self.control, self.recovery, self.images['api']['digest'], self.images['web']['digest'], self.root/'export')
            called.assert_not_called()

    def test_export_does_not_copy_runtime_or_auth_configuration(self):
        local_git(self.repo, 'checkout', '--quiet', '--detach', self.export_control)
        real = tm.command
        def polluted(argv, **kwargs):
            if argv[0] == 'bash':
                shutil.copytree(self.base/'oci', argv[-1])
                Path(argv[-1], 'api/runtime.env').write_text('SYNTHETIC_CONFIG=not-a-secret')
                return b''
            return real(argv, **kwargs)
        with mock.patch.dict(os.environ, self.context), mock.patch.object(tm, 'command', side_effect=polluted):
            with self.assertRaisesRegex(RuntimeError, 'configuration or credential'):
                tm.export_material(self.base/'source', self.repo, self.export_control, self.recovery, self.images['api']['digest'], self.images['web']['digest'], self.root/'export')
        self.assertFalse((self.root/'export/recovery.tar.gz').exists())

    def test_prepare_uses_successful_exact_artifact_with_historical_r_and_real_cli(self):
        result = self.prepare()
        self.assertEqual(result['mode'], 'compatible_recovery')
        self.assertEqual(len(result['files']), 12)
        self.assertEqual(tm.digest(self.material/'recovery.tar.gz'), self.binding['recovery_bundle_sha256'])
        self.assertEqual((self.material/'recovery.tar.gz').read_bytes(), (self.base/'exported/recovery.tar.gz').read_bytes())
        self.assertTrue(any('check-compatible-recovery' in argv for argv in self.calls))
        self.assertTrue(any(argv[:2] == ['gh', 'api'] and argv[2].endswith('/artifacts/202/zip') for argv in self.calls))
        self.assertNotEqual(self.publication_run['head_sha'], self.recovery)
        self.assertNotEqual(self.publication_run['head_sha'], self.control)
        self.assertFalse(list(self.material.rglob('__pycache__')))

    def test_absent_c_selection_keeps_legacy_and_creates_no_material(self):
        shutil.rmtree(self.selection)
        c = self.selection_commit()
        (self.bundle/'compatible_recovery.json').write_text('{}')
        with mock.patch.object(tm, 'download_approved') as called:
            self.assertEqual(tm.prepare_material(self.repo, c, self.repo, self.candidate, self.bundle), {'mode': 'legacy'})
            called.assert_not_called()
        with mock.patch.object(stage.transport, 'command', wraps=stage.transport.command) as commands:
            result = stage.stage_material(self.repo, c, self.bundle, self.root/'missing-plan', self.candidate, {})
        self.assertEqual(result, {'mode': 'legacy', 'host_writes': False})
        self.assertFalse(any(call.args[0][0] in ('ssh', 'rsync') for call in commands.call_args_list))
        self.assertFalse((self.bundle/'compatible-recovery').exists())

    def test_missing_selected_directory_or_deleted_c_approval_never_falls_back(self):
        with mock.patch.object(stage.transport, 'command', wraps=stage.transport.command) as commands:
            with self.assertRaisesRegex(RuntimeError, 'selected compatible material'):
                stage.stage_material(self.repo, self.control, self.bundle, self.root/'no-plan', self.candidate, {})
        self.assertFalse(any(call.args[0][0] == 'ssh' for call in commands.call_args_list))
        (self.selection/'approval.json').unlink()
        with self.assertRaisesRegex(RuntimeError, 'approval is missing'):
            tm.prepare_material(self.repo, self.control, self.repo, self.candidate, self.bundle)

    def test_modified_or_malformed_existing_selection_fails_before_download(self):
        approval = self.selection/'approval.json'
        original = approval.read_bytes()
        with mock.patch.object(tm, 'download_approved') as called:
            approval.write_bytes(original+b' ')
            with self.assertRaisesRegex(RuntimeError, 'fixed control C'):
                tm.prepare_material(self.repo, self.control, self.repo, self.candidate, self.bundle)
            approval.write_text('{malformed')
            c = self.selection_commit()
            with self.assertRaises(ValueError):
                tm.prepare_material(self.repo, c, self.repo, self.candidate, self.bundle)
            called.assert_not_called()

    def test_wrong_candidate_and_unselected_mode_fail_without_download(self):
        for field, value in (('release_sha', 'b'*40), ('image_compatibility_mode', 'legacy')):
            with self.subTest(field=field):
                body = copy.deepcopy(self.approval)
                body[field] = value
                save(self.selection/'approval.json', body)
                c = self.selection_commit()
                with mock.patch.object(tm, 'download_approved') as called:
                    with self.assertRaises(RuntimeError):
                        tm.prepare_material(self.repo, c, self.repo, self.candidate, self.bundle)
                    called.assert_not_called()

    def test_control_byte_mismatch_or_missing_dependency_blocks(self):
        for name in tm.CONTROL_FILES:
            with self.subTest(name=name):
                path = self.repo/'scripts'/name
                raw = path.read_bytes()
                path.write_bytes(raw+b'\n# changed\n')
                with self.assertRaisesRegex(RuntimeError, 'fixed commit'):
                    tm.control_identity(self.repo, self.control)
                path.unlink()
                with self.assertRaisesRegex(RuntimeError, 'missing'):
                    tm.control_identity(self.repo, self.control)
                path.write_bytes(raw)

    def test_wrong_run_repository_workflow_event_attempt_or_conclusion_blocks(self):
        changes = [('id', 999), ('repository', {'full_name': 'other/repo'}), ('head_repository', {'full_name': 'other/repo'}), ('path', '.github/workflows/release.yml'), ('event', 'push'), ('head_branch', 'other'), ('status', 'in_progress'), ('conclusion', 'failure'), ('head_sha', self.recovery), ('run_attempt', 1)]
        for key, value in changes:
            with self.subTest(key=key):
                run = copy.deepcopy(self.publication_run)
                run[key] = value
                with self.assertRaises(RuntimeError):
                    tm.publication_metadata(self.source, run, self.artifact)

    def test_artifact_must_be_exact_successful_run_output_and_unexpired(self):
        for key, value in (('id', 999), ('name', 'other'), ('expired', True), ('workflow_run', {'id': 999}), ('digest', 'sha256:'+'f'*64)):
            with self.subTest(key=key):
                artifact = copy.deepcopy(self.artifact)
                artifact[key] = value
                with self.assertRaises(RuntimeError):
                    tm.publication_metadata(self.source, self.publication_run, artifact)

    def test_downloaded_zip_bytes_cannot_disagree_with_approved_archive_hash(self):
        with mock.patch.object(tm, 'gh_json', side_effect=[self.publication_run, self.artifact]), mock.patch.object(tm, 'command', side_effect=lambda argv, **kwargs: Path(kwargs['output']).write_bytes(b'changed zip')):
            with self.assertRaisesRegex(RuntimeError, 'downloaded artifact bytes'):
                tm.download_approved(self.source, self.root/'bad.zip')

    def test_actual_b_sql_bytes_must_match_the_approved_git_target(self):
        (self.repo/'packages/database/migrations/0001_synthetic.sql').write_text('SELECT 999;\n')
        with self.assertRaisesRegex(RuntimeError, 'target manifest must equal all 81 B Git SQL files'):
            self.prepare()

    def test_raw_tar_bundle_provenance_report_and_metadata_tampering_blocks(self):
        self.prepare()
        for name in ('recovery.tar.gz', 'source.bundle', 'provenance.json', 'report.json', 'migrations.json', 'release.json', 'transport-source.json'):
            with self.subTest(name=name):
                path = self.material/name
                original = path.read_bytes()
                path.write_bytes(original+b' ')
                with self.assertRaises(RuntimeError):
                    tm.validate_material(self.repo, self.material, self.plan)
                path.write_bytes(original)
        (self.material/'report.json').unlink()
        with self.assertRaises(RuntimeError):
            tm.validate_material(self.repo, self.material, self.plan)

    def test_expired_approval_is_rejected_by_actual_cli_before_any_ssh(self):
        self.prepare()
        body = copy.deepcopy(self.approval)
        now = datetime.now(timezone.utc)
        body.update(approved_at_utc=(now-timedelta(hours=3)).isoformat(), window_end_utc=(now-timedelta(hours=1)).isoformat())
        save(self.selection/'approval.json', body)
        c = self.selection_commit()
        save(self.material/'migration-recovery-approval.json', body)
        with mock.patch.object(stage.transport, 'command', wraps=stage.transport.command) as commands:
            with self.assertRaisesRegex(RuntimeError, 'required command failed'):
                stage.stage_material(self.repo, c, self.bundle, self.plan, self.candidate, {})
        self.assertTrue(any('check-compatible-recovery' in call.args[0] for call in commands.call_args_list))
        self.assertFalse(any(call.args[0][0] in ('ssh', 'rsync') for call in commands.call_args_list))

    def test_wrong_root_r_target_and_failed_drill_still_fail_when_report_hash_reapproved(self):
        self.prepare()
        for key, value in (('api_digest', 'sha256:'+'f'*64), ('web_digest', 'sha256:'+'f'*64), ('recovery_release_sha', self.legacy), ('target_manifest_sha256', 'f'*64)):
            with self.subTest(key=key):
                body = copy.deepcopy(self.approval)
                body['compatible_recovery'][key] = value
                save(self.material/'migration-recovery-approval.json', body)
                with self.assertRaises(RuntimeError):
                    tm.validate_material(self.repo, self.material, self.plan)
        body = copy.deepcopy(self.approval)
        report = json.loads((self.material/'report.json').read_bytes())
        report['steps'][2]['result'] = 'FAIL'
        save(self.material/'report.json', report)
        body['compatible_recovery']['report_sha256'] = tm.digest(self.material/'report.json')
        save(self.material/'migration-recovery-approval.json', body)
        with self.assertRaisesRegex(RuntimeError, 'required command failed'):
            tm.validate_material(self.repo, self.material, self.plan)

    def test_untrusted_archive_paths_links_devices_duplicates_and_collisions_block(self):
        for index, (name, kind) in enumerate((('../escape', 'file'), ('/absolute', 'file'), ('a/../../escape', 'file'), ('a\\b', 'file'), ('link', 'sym'), ('hard', 'hard'), ('device', 'device'), ('duplicate', 'duplicate'), ('collision', 'collision'))):
            with self.subTest(name=name):
                archive = self.root/f'bad-{index}.tar'
                with tarfile.open(archive, 'w') as writer:
                    info = tarfile.TarInfo(name)
                    if kind == 'sym': info.type, info.linkname = tarfile.SYMTYPE, '../outside'
                    if kind == 'hard': info.type, info.linkname = tarfile.LNKTYPE, 'outside'
                    if kind == 'device': info.type = tarfile.CHRTYPE
                    writer.addfile(info, io.BytesIO(b''))
                    if kind == 'duplicate': writer.addfile(info, io.BytesIO(b''))
                    if kind == 'collision': writer.addfile(tarfile.TarInfo('collision/child'), io.BytesIO(b''))
                with self.assertRaises((RuntimeError, OSError)):
                    tm.safe_archive(archive, self.root/f'out-{index}')
        with zipfile.ZipFile(self.root/'link.zip', 'w') as writer:
            info = zipfile.ZipInfo('link')
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            writer.writestr(info, '../outside')
        with self.assertRaisesRegex(RuntimeError, 'link/device'):
            tm.safe_archive(self.root/'link.zip', self.root/'zip-out', zipped=True)
        self.assertFalse((self.root/'escape').exists())

    def test_selection_and_material_nested_symlinks_never_escape(self):
        original = (self.selection/'approval.json').read_bytes()
        outside = self.root/'outside'
        outside.mkdir()
        (outside/'approval.json').write_bytes(original)
        shutil.rmtree(self.selection)
        self.selection.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            tm.approved_selection(self.repo, self.candidate)
        nested = self.root/'ordinary'
        nested.mkdir()
        (nested/'linked').symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            tm.ordinary(nested, 'linked/approval.json')

    def test_stage_transfers_only_private_fixed_c_files_after_actual_plan_validation(self):
        incoming, expected = self.payload()
        self.assertEqual([argv[0] for argv in self.remote_calls], ['ssh', 'rsync', 'ssh'])
        self.assertIn('/.staging/wave2-303-1/compatible-recovery-303-1', self.stage_result['remote'])
        self.assertIn('StrictHostKeyChecking=yes', self.remote_calls[0])
        self.assertNotIn('--delete', self.remote_calls[1])
        self.assertIn('--no-owner', self.remote_calls[1])
        self.assertIn('--no-group', self.remote_calls[1])
        self.assertIn('python3 -I', self.remote_calls[2][-1])
        verified = stage.validate_payload(incoming, expected, self.candidate, self.control)
        self.assertEqual(set(verified['controls']), set(tm.CONTROL_FILES))
        self.assertFalse(list(incoming.rglob('__pycache__')))
        for name, sha in verified['controls'].items():
            self.assertEqual(sha, raw_hash(tm.git(self.repo, 'show', self.control+':scripts/'+name)))

    def test_remote_bootstrap_blocks_changed_controls_and_private_mode_failures(self):
        incoming, expected = self.payload()
        script = incoming/'scripts/release_orchestrator.py'
        original = script.read_bytes()
        for raw, mode in ((original+b'\n# replaced', 0o600), (original, 0o666)):
            script.write_bytes(raw)
            script.chmod(mode)
            result = subprocess.run([sys.executable, '-I', '-B', '-c', stage.BOOTSTRAP, 'verify', str(incoming), expected], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
        script.write_bytes(original)
        script.chmod(0o600)
        result = subprocess.run([sys.executable, '-I', '-B', '-c', stage.BOOTSTRAP, 'verify', str(incoming), expected], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((incoming/'transfer.json').read_bytes())
        manifest['run'] = '../escape'
        save(incoming/'transfer.json', manifest)
        with self.assertRaisesRegex(RuntimeError, 'transfer run identity malformed'):
            stage.install_material(incoming, self.root/'.release-migration-evidence', tm.digest(incoming/'transfer.json'), self.candidate, self.control)
        self.assertFalse((self.root/'.release-migration-evidence').exists())

    def test_install_actual_subprocess_archives_old_material_and_activates_approval_last(self):
        incoming, expected = self.payload()
        canonical = self.root/'.release-migration-evidence'
        canonical.mkdir(mode=0o700)
        old = {'migration-recovery-approval.json': b'{"old":"approval"}', 'compatible_recovery.json': b'{"old":"descriptor"}'}
        for name, raw in old.items():
            (canonical/name).write_bytes(raw)
        previous = canonical/('a'*40)
        previous.mkdir()
        (previous/'retained').write_bytes(b'old material')
        foreign = self.root/'foreign-data'
        foreign.mkdir()
        sentinel = self.root/'planted-import-ran'
        (foreign/'json.py').write_text('from pathlib import Path\nPath('+repr(str(sentinel))+').touch()\nraise RuntimeError("untrusted cwd imported")\n')
        result = subprocess.run([sys.executable, '-I', '-B', str(incoming/'scripts/stage_recovery_material.py'), 'install', '--incoming', str(incoming), '--canonical-root', str(canonical), '--transfer-sha256', expected, '--candidate-sha', self.candidate, '--control-sha', self.control], cwd=foreign, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIs(json.loads(result.stdout)['live_fence_verified'], False)
        self.assertFalse(sentinel.exists())
        self.assertEqual((canonical/'migration-recovery-approval.json').read_bytes(), (self.selection/'approval.json').read_bytes())
        for name, raw in old.items():
            self.assertEqual((canonical/'archive/material-303-1'/name).read_bytes(), raw)
        self.assertEqual((previous/'retained').read_bytes(), b'old material')
        descriptor = json.loads((canonical/'compatible_recovery.json').read_bytes())
        self.assertEqual(descriptor['recovery_bundle_file'], self.candidate+'/recovery.tar.gz')
        self.assertEqual(tm.digest(canonical/self.candidate/'recovery.tar.gz'), self.binding['recovery_bundle_sha256'])
        self.assertFalse((canonical/'migration-recovery-approval.json').is_symlink())

    def test_interruption_before_final_approval_preserves_old_approval_and_recovery_assets(self):
        incoming, expected = self.payload()
        canonical = self.root/'.release-migration-evidence'
        canonical.mkdir(mode=0o700)
        (canonical/'migration-recovery-approval.json').write_bytes(b'{"old":"approval"}')
        real = stage.atomic_file
        def interrupt(root, name, raw, nonce):
            if name == 'migration-recovery-approval.json':
                raise RuntimeError('synthetic interruption before activation')
            return real(root, name, raw, nonce)
        with mock.patch.object(stage, 'atomic_file', side_effect=interrupt):
            with self.assertRaisesRegex(RuntimeError, 'synthetic interruption'):
                stage.install_material(incoming, canonical, expected, self.candidate, self.control)
        self.assertEqual((canonical/'migration-recovery-approval.json').read_bytes(), b'{"old":"approval"}')
        self.assertEqual(tm.digest(canonical/self.candidate/'recovery.tar.gz'), self.binding['recovery_bundle_sha256'])
        with self.assertRaisesRegex(RuntimeError, 'required command failed'):
            tm.command([sys.executable, '-I', '-B', str(incoming/'scripts/release_orchestrator.py'), 'check-compatible-recovery', str(incoming/'plan.json'), str(canonical/'migration-recovery-approval.json'), str(canonical), self.legacy])

    def test_existing_b_directory_and_canonical_symlink_are_never_overwritten(self):
        incoming, expected = self.payload()
        canonical = self.root/'.release-migration-evidence'
        canonical.mkdir(mode=0o700)
        version = canonical/self.candidate
        version.mkdir(mode=0o700)
        (version/'retained').write_bytes(b'previous bytes')
        (version/'retained').chmod(0o600)
        with self.assertRaisesRegex(RuntimeError, 'immutable'):
            stage.install_material(incoming, canonical, expected, self.candidate, self.control)
        self.assertEqual((version/'retained').read_bytes(), b'previous bytes')
        renamed = self.root/'real-evidence'
        canonical.rename(renamed)
        canonical.symlink_to(renamed, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            stage.install_material(incoming, canonical, expected, self.candidate, self.control)


class RecoveryWorkflowContract(unittest.TestCase):
    def test_inputs_permissions_job_graph_and_production_approval_lock_stay_fixed(self):
        contracts = {
            'release-images.yml': ('5e0b2f229fee0c57c2cbab75adb7b04bcd384dd6c218119ec08a831ad6609bc7', [('publish', None)]),
            'release.yml': ('774e121d4dd05c8f9a4939040e6729e24e37d4165c6127f65f9453b93e4d3e93', [('validate', None), ('build', 'validate'), ('verify', '[validate, build]'), ('deploy', '[validate, build, verify]'), ('post', '[validate, build, verify, deploy]')]),
            'recover-application-images.yml': ('d9964a1daf3c8ee14644f13b8aa239f7716f2a47598af21c2eee0cceeb3cbd7c', [('validate', None), ('verify', 'validate'), ('deploy', '[validate, verify]')]),
            'release-rollback.yml': ('08194512bbc712db0e3ca8e26b2db5875bdb8e7bd231288c345b76a0c8b2aee0', [('validate', None), ('restore', 'validate'), ('deploy', '[validate, restore]')]),
        }
        for name, (prefix, graph) in contracts.items():
            with self.subTest(workflow=name):
                text = (ROOT/'.github/workflows'/name).read_text()
                self.assertEqual(raw_hash(text.split('\njobs:', 1)[0].encode()), prefix)
                sections = re.split(r'^  ([a-z_-]+):\n', text.split('\njobs:', 1)[1], flags=re.M)
                self.assertEqual(sections[1::2], [job for job, _ in graph])
                for (job, needs), body in zip(graph, sections[2::2]):
                    match = re.search(r'^    needs: (.+)$', body, re.M)
                    self.assertEqual(match.group(1) if match else None, needs, job)
                    if job == 'deploy':
                        self.assertIn('    environment: production\n', body)
                        self.assertIn('    concurrency:\n      group: kingturf-erp-production\n      cancel-in-progress: false\n', body)

    def test_recovery_and_rollback_receive_only_fourth_control_list_entry(self):
        expected = {'recover-application-images.yml': '2e5ce3bb37c9c5f2d556ff8465155491ce11f626383f56f2ab19546bea700a36', 'release-rollback.yml': 'dbd661774e9252f3ae2f3d5570a13f80fa9c892d0690cb75542ec42deedcabf4'}
        for name, sha in expected.items():
            text = (ROOT/'.github/workflows'/name).read_text()
            normalized = text.replace(',release_orchestrator}.py', '}.py').replace(' production_preflight release_orchestrator; do', ' production_preflight; do')
            self.assertEqual(raw_hash(normalized.encode()), sha)

    def test_export_prepare_and_stage_use_fixed_control_before_any_apply(self):
        images = (ROOT/'.github/workflows/release-images.yml').read_text()
        release = (ROOT/'.github/workflows/release.yml').read_text()
        self.assertLess(images.index('Scan Web image'), images.index('Emit immutable digests'))
        self.assertLess(images.index('Emit immutable digests'), images.index('Export original recovery bytes'))
        self.assertIn('ref: ${{ github.workflow_sha }}\n          path: .recovery-export-control\n          fetch-depth: 0', images)
        self.assertIn('python3 -I .recovery-export-control/scripts/recovery_material_transport.py export', images)
        self.assertIn('name: compatible-recovery-material-${{ inputs.commit_sha }}', images)
        self.assertIn('      actions: read\n', release)
        self.assertEqual(release.count('GH_TOKEN:'), 1)
        self.assertIn('--control-root .release-control --control-sha "$CONTROL_SHA"', release)
        self.assertLess(release.index('Prepare explicitly approved compatible'), release.index('Bind fixed control scripts'))
        self.assertLess(release.index('Stage control and candidate migrations'), release.index('Stage approved recovery material'))
        self.assertLess(release.index('Stage approved recovery material'), release.index('Apply approved migrations'))
        readonly = release.split('      - name: Plan (read-only)', 1)[1].split('      - name: Stage control', 1)[0]
        self.assertNotIn('recovery_material', readonly)
        self.assertNotIn('rsync', readonly)
        for token in ('DATABASE_URL', 'SSH_PRIVATE_KEY', 'GH_TOKEN'):
            self.assertNotIn(token, (ROOT/'scripts/recovery_material_transport.py').read_text())


if __name__ == '__main__':
    unittest.main()
