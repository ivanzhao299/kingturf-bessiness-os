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
        forbidden=('CREATE TABLE','ALTER TABLE','INSERT INTO schema_migrations','db:migrate')
        self.assertFalse([(x,f) for x in strings for f in forbidden if f in x])
        # The fourth pinned control may supply metadata verification, never its
        # executor/session. Keep the allowed call surface explicit in the AST.
        self.assertEqual(strings.count('release_orchestrator.py'),1)
        prepare=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='prepare_compatible_target')
        calls={n.func.attr for n in ast.walk(prepare) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='gate'}
        self.assertEqual(calls,{'evidence_file','check_approval','check_compatible_recovery','artifact_digest'})
        self.assertFalse([n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in ('run_stages','migrate','PsqlSession')])
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

    def test_image_evidence_gate_accepts_newer_candidate_via_runner_smoke_only(self):
        evidence=self.root/'.release-migration-evidence';evidence.mkdir()
        compat=lambda body:(evidence/'image_compatibility.json').write_text(json.dumps(body))
        identities={'api':{'approved_digest':'sha256:api'},'web':{'approved_digest':'sha256:web'}}
        approval={'release_sha':'c'*40}
        # Same-candidate rerun keeps byte-strict digests and prior verification.
        compat({'images_built_at':'c'*40,'api_digest':'sha256:api','web_digest':'sha256:web','old_app_on_new_schema':{'verified':True,'evidence':'runner isolation smoke images_run_id=1 bundle=x'}})
        ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})
        compat({'images_built_at':'c'*40,'api_digest':'sha256:other','web_digest':'sha256:web','old_app_on_new_schema':{'verified':True,'evidence':'x'}})
        with self.assertRaisesRegex(RuntimeError,'Digest disagrees'):
            ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})
        compat({'images_built_at':'c'*40,'api_digest':'sha256:api','web_digest':'sha256:web','old_app_on_new_schema':{}})
        with self.assertRaisesRegex(RuntimeError,'Prior schema compatibility evidence missing'):
            ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})
        # Newer candidate: historical file stays on file, acceptance now requires
        # FULLY_MATCHED-isolated smoke; without it the gate must fail closed.
        compat({'images_built_at':'a'*40,'api_digest':'sha256:old','web_digest':'sha256:old','old_app_on_new_schema':{'verified':True,'evidence':'x'}})
        with self.assertRaisesRegex(RuntimeError,'runner isolation smoke'):
            ar.verify_image_evidence(self.root,approval,identities,{'smoke':'FAIL'})
        ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})
        (evidence/'image_compatibility.json').unlink()
        with self.assertRaisesRegex(RuntimeError,'image compatibility evidence missing'):
            ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})

    def test_switch_advances_host_image_evidence_privately_after_deployed(self):
        bundle=self.root/'.release-image-recovery/44284158221-1';bundle.mkdir(parents=True)
        # Host layout (recover_application_images.sh rsync) names the artifact bundle.tar.gz;
        # the runner-side name remains accepted as a fallback (TD-REL-004).
        (bundle/'bundle.tar.gz').write_bytes(b'bundle-bytes')
        evidence=self.root/'.release-migration-evidence';evidence.mkdir()
        (evidence/'image_compatibility.json').write_text(json.dumps({'images_built_at':'a'*40}))
        approval={'release_sha':'c'*40,'migration_manifest_sha256':'e'*64}
        identities={'api':{'approved_digest':'sha256:api'},'web':{'approved_digest':'sha256:web'}}
        import hashlib
        expected_bundle=hashlib.sha256(b'bundle-bytes').hexdigest()
        previous=os.umask(0o022)
        try:
            ar.advance_image_evidence(self.root,bundle,approval,identities)
        finally:
            os.umask(previous)
        path=evidence/'image_compatibility.json'
        body=json.loads(path.read_bytes())
        self.assertEqual(body['images_built_at'],'c'*40)
        self.assertEqual(body['api_digest'],'sha256:api')
        self.assertEqual(body['web_digest'],'sha256:web')
        self.assertNotIn('old_app_on_new_schema',body)
        self.assertTrue(body['candidate_app_on_schema']['verified'])
        self.assertEqual(body['candidate_app_on_schema']['release_sha'],approval['release_sha'])
        self.assertEqual(body['candidate_app_on_schema']['migration_manifest_sha256'],approval['migration_manifest_sha256'])
        self.assertEqual(body['candidate_app_on_schema']['evidence'],'runner isolation smoke images_run_id=44284158221 bundle=sha256:'+expected_bundle)
        ar.verify_image_evidence(self.root,approval,identities,{'smoke':'PASS'})
        with self.assertRaisesRegex(RuntimeError,'candidate schema compatibility binding'):
            ar.verify_image_evidence(self.root,approval|{'migration_manifest_sha256':'f'*64},identities,{'smoke':'PASS'})
        self.assertEqual(path.stat().st_mode & 0o777,0o600)
        (bundle/'bundle.tar.gz').unlink()
        with self.assertRaisesRegex(RuntimeError,'Recovery bundle archive missing'):
            ar.advance_image_evidence(self.root,bundle,approval,identities)
        (bundle/'recovery-bundle.tar.gz').write_bytes(b'bundle-bytes')
        ar.advance_image_evidence(self.root,bundle,approval,identities)
        self.assertEqual(json.loads((evidence/'image_compatibility.json').read_bytes())['images_built_at'],'c'*40)

    def test_switch_wiring_advances_evidence_only_after_deployed_checkpoint(self):
        import ast
        tree=ast.parse((ROOT/'scripts/application_release.py').read_text())
        switch=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='switch')
        markers={}
        for node in ast.walk(switch):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
                if node.func.id=='checkpoint' and any(getattr(a,'value',None)=='DEPLOYED' for a in node.args):
                    markers['deployed']=node.lineno
                if node.func.id=='advance_image_evidence':
                    markers['advance']=node.lineno
        self.assertEqual(sorted(markers),['advance','deployed'])
        self.assertLess(markers['deployed'],markers['advance'])

    def test_handover_state_guard_is_precise(self):
        # Handover: FULLY_MATCHED registry + marker still on the previous release
        # + the api container actually stopped (ruling 9).
        self.assertTrue(ar.handover_state('FULLY_MATCHED', 'a'*40, 'b'*40, True))
        # Same-candidate rerun (marker already advanced): strict semantics retained.
        self.assertFalse(ar.handover_state('FULLY_MATCHED', 'b'*40, 'b'*40, True))
        # Pending migrations: never a handover, stopped api stays an error.
        self.assertFalse(ar.handover_state('MATCHED_PREFIX_PENDING', 'a'*40, 'b'*40, True))
        # Plain application-only release (zero new migrations, api running): the
        # same registry shape must stay strict instead of expecting a stop.
        self.assertFalse(ar.handover_state('FULLY_MATCHED', 'a'*40, 'b'*40, False))

    def test_precheck_wires_handover_branch_and_probe_skips(self):
        import ast as ast_module
        source = (ROOT/'scripts/application_release.py').read_text()
        tree = ast_module.parse(source)
        precheck = next(n for n in tree.body if isinstance(n, ast_module.FunctionDef) and n.name == 'precheck')
        text = ast_module.dump(precheck)
        self.assertIn('allow_stopped_api=handover', source)
        # Baseline probes guarded: both probe calls sit under the not-handover branch.
        body = source.split('def precheck(bundle):',1)[1].split('def private_write',1)[0]
        guard_pos = body.index('if not handover:')
        probe_pos = body.index("probe('http://127.0.0.1:4332', marker)")
        https_pos = body.index("probe('https://erp.kingturf.cn', marker)")
        self.assertLess(guard_pos, probe_pos)
        self.assertLess(probe_pos, https_pos)
        # Container branch: handover allows exactly a stopped api.
        self.assertIn("'Handover state expects the api container to be stopped'", body)
        self.assertIn("'Current recovery container unavailable'", body)
        # Ruling 9: the relaxation additionally requires the observed stopped api.
        self.assertIn("handover_state(classification, marker, approval['release_sha'], api_stopped)", body)

    def test_preflight_handover_guard_is_precise(self):
        import importlib.util as ilu
        spec = ilu.spec_from_file_location('preflight_mod', ROOT/'scripts/production_preflight.py')
        gate = ilu.module_from_spec(spec); spec.loader.exec_module(gate)
        # Handover: candidate given, registry matches candidate, marker on previous, api stopped.
        self.assertTrue(gate.handover_state('FULLY_MATCHED', 'a'*40, 'b'*40, True))
        # No candidate sha (plain rerun semantics) -> never handover.
        self.assertFalse(gate.handover_state('FULLY_MATCHED', 'a'*40, None, True))
        # Marker already on the candidate -> strict rerun, no handover.
        self.assertFalse(gate.handover_state('FULLY_MATCHED', 'b'*40, 'b'*40, True))
        # Pending migrations -> never handover.
        self.assertFalse(gate.handover_state('MATCHED_PREFIX_PENDING', 'a'*40, 'b'*40, True))
        # Running api with the same registry shape -> strict application-only release.
        self.assertFalse(gate.handover_state('FULLY_MATCHED', 'a'*40, 'b'*40, False))

    def test_recovery_shell_passes_candidate_sha_to_preflight(self):
        text = (ROOT/'scripts/recover_application_images.sh').read_text()
        self.assertIn("--require-full --candidate-sha='$RELEASE_SHA'", text)
        self.assertLess(text.index("--candidate-sha='$RELEASE_SHA'"), text.index('.release-image-recovery; mkdir'))


if __name__=='__main__':unittest.main()
