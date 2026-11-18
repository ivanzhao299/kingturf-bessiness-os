from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
YML = ROOT / '.github/workflows/apply-migrations.yml'
SCRIPT = ROOT / 'scripts/apply_migrations.py'


class MigrationWorkflowContract(unittest.TestCase):
    def test_yaml_parses_and_pins_inputs_and_contracts(self):
        text = YML.read_text()
        for contract in (
            'workflow_dispatch:',
            'commit_sha:',
            'approved_suffixes:',
            'github.workflow_sha',
            'node scripts/validate_release.mjs',
            'environment: production',
            'group: kingturf-erp-production',
            'cancel-in-progress: false',
            'production_known_hosts',
            'persist-credentials: false',
            'path: .candidate',
            'sha256sum apply_migrations.py',
            'apply_migrations.py',
            '--approved-suffixes',
            "retention-days: 90",
        ):
            self.assertIn(contract, text)
        # The migration path must never deploy applications or push images.
        for forbidden in ('recover-application-images', 'docker push', 'release-images.yml', 'compose up -d api web'):
            self.assertNotIn(forbidden, text)
        self.assertEqual(text.count('group: kingturf-erp-production'), 1)

    def test_control_script_keeps_orchestrator_delegation_and_fail_closed_semantics(self):
        text = SCRIPT.read_text()
        for contract in (
            "require_registry",
            "MATCHED_PREFIX_PENDING",
            "build_release_approval",
            "controlled_old_api_shutdown",
            "'--psql-argv-file'",
            "sys.exit(1)",
            'rehearsal',  # isolated restore rehearsal is mandatory evidence
        ):
            self.assertIn(contract, text)
        # The script delegates the gated apply to the orchestrator; it never re-implements it.
        self.assertIn("'execute'", text)
        self.assertIn("'check-evidence'", text)
        self.assertIn("'postcheck'", text)
        self.assertNotIn('CREATE TABLE', text)
        self.assertNotIn('INSERT INTO schema_migrations', text)


if __name__ == '__main__':
    unittest.main()
