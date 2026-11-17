import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
from datetime import datetime,timedelta,timezone

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('application_release',ROOT/'scripts/application_release.py')
ar=importlib.util.module_from_spec(spec);spec.loader.exec_module(ar)


class ApplicationRecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.sha='a'*40;self.control='b'*40
        now=datetime.now(timezone.utc)
        self.auth={'kind':'delegated_application_recovery','authorization_source_thread':'01a1c9d5-653a-7bf0-a627-c2eab5ac0834','release_sha':self.sha,'control_sha':self.control,'operator':'codex','migration_execution':'forbidden','started_at_utc':now.isoformat(),'window_end_utc':(now+timedelta(hours=2)).isoformat(),'smoke':'PASS'}
        self.write_auth()
        self.env=mock.patch.dict(os.environ,RELEASE_SHA=self.sha,RELEASE_CONTROL_SHA=self.control);self.env.start()

    def tearDown(self):
        self.env.stop();self.temp.cleanup()

    def write_auth(self):
        (self.root/'authorization.json').write_text(json.dumps(self.auth))

    def test_delegated_authorization_is_exact_current_control_and_candidate(self):
        ar.authorize(self.root,{'release_sha':self.sha})
        with mock.patch.dict(os.environ,RELEASE_CONTROL_SHA='c'*40):
            with self.assertRaisesRegex(RuntimeError,'SHA mismatch'):
                ar.authorize(self.root,{'release_sha':self.sha})
        with mock.patch.dict(os.environ,RELEASE_SHA='c'*40):
            with self.assertRaisesRegex(RuntimeError,'SHA mismatch'):
                ar.authorize(self.root,{'release_sha':self.sha})

    def test_stale_or_future_or_non_utc_window_rejected(self):
        for start,end in ((-4,-1),(1,3),(-1,14)):
            now=datetime.now(timezone.utc)
            self.auth.update(started_at_utc=(now+timedelta(hours=start)).isoformat(),window_end_utc=(now+timedelta(hours=end)).isoformat())
            self.write_auth()
            with self.assertRaisesRegex(RuntimeError,'window'):
                ar.authorize(self.root,{'release_sha':self.sha})
        self.auth['started_at_utc']='2026-11-17T12:00:00+08:00';self.write_auth()
        with self.assertRaisesRegex(RuntimeError,'UTC'):
            ar.authorize(self.root,{'release_sha':self.sha})

    def test_smoke_failure_or_migration_scope_cannot_authorize_switch(self):
        for key,value in (('smoke','FAIL'),('migration_execution','allowed')):
            original=self.auth[key];self.auth[key]=value;self.write_auth()
            with self.assertRaisesRegex(RuntimeError,'scope'):
                ar.authorize(self.root,{'release_sha':self.sha})
            self.auth[key]=original

    def test_unchanged_checks_include_applied_at_and_execution_state_bytes(self):
        before={'registry':[{'name':'one','checksum':'c','applied_at':'original'}],'migration_state_hashes':{'state':'old'},'recovery_images':[{'id':'config'}]}
        (self.root/'before.json').write_text(json.dumps(before))
        with mock.patch.object(ar,'registry_snapshot',return_value=before['registry']),mock.patch.object(ar,'state_hashes',return_value=before['migration_state_hashes']),mock.patch.object(ar,'command'):
            ar.verify_unchanged(self.root)
        changed=[before['registry'][0]|{'applied_at':'rerun'}]
        with mock.patch.object(ar,'registry_snapshot',return_value=changed):
            with self.assertRaisesRegex(RuntimeError,'applied_at'):
                ar.verify_unchanged(self.root)
        with mock.patch.object(ar,'registry_snapshot',return_value=before['registry']),mock.patch.object(ar,'state_hashes',return_value={'state':'reset'}):
            with self.assertRaisesRegex(RuntimeError,'state changed'):
                ar.verify_unchanged(self.root)

    def test_running_api_or_database_activity_prevents_backup(self):
        with mock.patch.object(ar,'command',return_value=json.dumps([{'State':{'Running':True}}]).encode()):
            with self.assertRaisesRegex(RuntimeError,'shutdown fence'):
                ar.assert_drained()
        with mock.patch.object(ar,'verify_write_channels'),mock.patch.object(ar,'command',side_effect=[json.dumps([{'State':{'Running':False}}]).encode(),b'1']):
            with self.assertRaisesRegex(RuntimeError,'activity'):
                ar.assert_drained()

    def test_write_channels_reject_ports_other_network_clients_and_attachment_writers(self):
        ids=['api-id','web-id','pg-id']
        project=[{'Id':i,'Config':{'Labels':{'com.docker.compose.service':s}},'HostConfig':{'PortBindings':{},'NetworkMode':ar.PROJECT+'_default'},'NetworkSettings':{'Networks':{ar.PROJECT+'_default':{}}},'Mounts':[]} for i,s in zip(ids,('api','web','postgres'))]
        network={'Containers':{i:{'Name':i} for i in ids}}
        def replies(p=project,n=network,r=project):
            return [' '.join(ids).encode(),json.dumps(p).encode(),json.dumps([n]).encode(),' '.join(ids).encode(),json.dumps(r).encode()]
        with mock.patch.object(ar,'command',side_effect=replies()):
            self.assertFalse(ar.verify_write_channels()['database_host_ports'])
        import copy
        changed=copy.deepcopy(project);changed[2]['HostConfig']['PortBindings']={'5432/tcp':[{'HostPort':'5432'}]}
        with mock.patch.object(ar,'command',side_effect=replies(p=changed)):
            with self.assertRaisesRegex(RuntimeError,'publish host ports'):
                ar.verify_write_channels()
        changed_network=copy.deepcopy(network);changed_network['Containers']['unknown']={'Name':'external-writer'}
        with mock.patch.object(ar,'command',side_effect=replies(n=changed_network)):
            with self.assertRaisesRegex(RuntimeError,'Other container'):
                ar.verify_write_channels()
        changed=copy.deepcopy(project);changed[1]['Mounts']=[{'Type':'bind','Source':'/data','RW':True}]
        with mock.patch.object(ar,'command',side_effect=replies(r=changed)):
            with self.assertRaisesRegex(RuntimeError,'attachments'):
                ar.verify_write_channels()

    def test_application_path_contains_no_migration_executor_or_ddl(self):
        import ast
        tree=ast.parse((ROOT/'scripts/application_release.py').read_text())
        strings=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)]
        forbidden=('CREATE TABLE','ALTER TABLE','INSERT INTO schema_migrations','release_orchestrator.py','db:migrate')
        self.assertFalse([(x,f) for x in strings for f in forbidden if f in x])
        self.assertTrue(ar.REGISTRY_SQL.startswith('BEGIN READ ONLY;'))

    def test_archive_is_private_during_writing_even_under_public_parent_and_default_umask(self):
        # Exercise the real CLI entry and tar writer with an initially public
        # parent/default process mask. Observe mode before archive completion.
        import contextlib,io,tarfile
        bundle=self.root/'.release-image-recovery/1-1';bundle.mkdir(parents=True)
        public=self.root/'backups';public.mkdir(mode=0o755)
        archive_path=public/'config.tar'
        observed=[]
        def write_archive(_bundle):
            with tarfile.open(archive_path,'x'):
                observed.append(archive_path.stat().st_mode & 0o777)
            return {}
        previous=os.umask(0o022)
        try:
            with mock.patch.object(ar,'ROOT',self.root),mock.patch.object(ar,'precheck',side_effect=write_archive),mock.patch.object(sys,'argv',['application_release.py','precheck',str(bundle)]),contextlib.redirect_stdout(io.StringIO()):
                ar.main()
        finally:
            os.umask(previous)
        self.assertEqual(observed,[0o600])

    def test_private_recovery_snapshot_is_exclusive_and_private(self):
        path=self.root/'private'
        ar.private_write(path,b'private test fixture')
        self.assertEqual(path.stat().st_mode & 0o777,0o600)
        with self.assertRaises(FileExistsError):
            ar.private_write(path,b'cannot overwrite')


if __name__=='__main__':unittest.main()
