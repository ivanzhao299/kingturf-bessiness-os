from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]


class ApplicationWorkflowContract(unittest.TestCase):
    # A-F1（A3-P2-9）：deploy-production.yml 已删除，其「首步骤封闭」测试随文件退役（历史见 git）。

    def test_new_entry_keeps_fixed_history_concurrency_approval_and_full_ci(self):
        text=(ROOT/'.github/workflows/recover-application-images.yml').read_text()
        for contract in ('github.workflow_sha','node scripts/validate_release.mjs','pnpm ci:local','environment: production','group: kingturf-erp-production','cancel-in-progress: false','production_known_hosts','persist-credentials: false'):
            self.assertIn(contract,text)
        self.assertNotIn('release_orchestrator.py execute',text)

    def test_current_public_https_is_required_before_any_application_stop(self):
        text=(ROOT/'scripts/application_release.py').read_text()
        precheck=text.split('def precheck(bundle):',1)[1].split('def private_write',1)[0]
        self.assertIn("probe('https://erp.kingturf.cn', marker)",precheck)
        backup=text.split('def backup(bundle):',1)[1].split('def verify_unchanged',1)[0]
        self.assertLess(backup.index('precheck(bundle)'),backup.index("compose('stop'"))

    def test_all_transfer_and_import_failures_precede_api_stop(self):
        text=(ROOT/'scripts/recover_application_images.sh').read_text()
        self.assertLess(text.index(' --require-full'),text.index('mkdir -p /data'))
        self.assertLess(text.index(" import '$remote'"),text.index(" backup '$remote'"))
        self.assertLess(text.index(" backup '$remote'"),text.index(" switch '$remote'"))
        self.assertIn("RELEASE_CONTROL_SHA='$RELEASE_CONTROL_SHA'",text)
        self.assertNotIn('--delete',text.replace('# A unique run directory is retained on failure; no --delete and no source rsync.',''))

    def test_forward_source_branch_imports_before_preparing_then_repeats_strict_gate(self):
        text=(ROOT/'scripts/recover_application_images.sh').read_text()
        self.assertIn('--inspect-forward-recovery',text)
        self.assertNotIn('--allow-stopped-api',text)
        branch=text.split('if "$forward_recovery"; then',1)[1].split('\nfi',1)[0]
        self.assertLess(branch.index(" import '$remote'"),branch.index(' prepare-forward-recovery '))
        self.assertLess(branch.index(' prepare-forward-recovery '),branch.index(' --require-full'))
        self.assertIn('--source-sha256',branch)
        normal=text.split('if ! "$forward_recovery"; then',1)[1].split('\nfi',1)[0]
        self.assertIn(" import '$remote'",normal)
        self.assertLess(text.index(" precheck '$remote'"),text.index('if ! "$forward_recovery"; then'))
        self.assertLess(text.index('if ! "$forward_recovery"; then'),text.index(" backup '$remote'"))

    def test_forward_recovery_never_changes_workflow_input_or_lock_contract(self):
        import yaml
        workflow=yaml.safe_load((ROOT/'.github/workflows/recover-application-images.yml').read_text())
        self.assertEqual(list(workflow[True]['workflow_dispatch']['inputs']),['commit_sha','api_digest','web_digest','images_run_id'])
        self.assertEqual(list(workflow['jobs']),['validate','verify','deploy'])
        self.assertEqual(workflow['jobs']['deploy']['environment'],'production')
        self.assertEqual(workflow['jobs']['deploy']['concurrency'],{'group':'kingturf-erp-production','cancel-in-progress':False})


if __name__=='__main__':unittest.main()
