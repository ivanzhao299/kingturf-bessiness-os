from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]


class ApplicationWorkflowContract(unittest.TestCase):
    def test_retired_migration_entry_stops_before_all_host_access(self):
        text=(ROOT/'.github/workflows/deploy-production.yml').read_text()
        first=text.split('    steps:\n',1)[1].split('      - name:',2)
        self.assertIn('Reject retired migration release entry',first[1])
        self.assertIn('exit 1',first[1])

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


if __name__=='__main__':unittest.main()
