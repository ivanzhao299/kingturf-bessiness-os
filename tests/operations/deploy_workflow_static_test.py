"""Static regression guards for the deploy workflow's controlled-migration step.

The GitHub workflow cannot be executed locally; these string-level invariants pin
the exact defect classes found by independent review (quoted-port SSH word
splitting, unauthenticated in-container psql, post-execution manifest binding,
automatic deploy retry) so they cannot silently reappear.
"""
from pathlib import Path
import re
import unittest

WORKFLOW = Path(__file__).resolve().parents[2] / '.github/workflows/deploy-production.yml'
RELEASE_IMAGES = Path(__file__).resolve().parents[2] / '.github/workflows/release-images.yml'


def step_names(text):
    return [match.group(1) for match in re.finditer(r'^\s*-\s+name:\s*(.+?)\s*$', text, re.MULTILINE)]


class DeployWorkflowStaticTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text()
        start = cls.text.index('Controlled migration (evidence-gated, fail-closed)')
        end = cls.text.index('- name: Deploy and verify')
        cls.step = cls.text[start:end]

    def test_migration_step_uses_quoting_safe_ssh_function(self):
        self.assertIn('run_ssh() {', self.step)
        self.assertNotIn("-p '", self.step.replace("-p \"$PROD_SSH_PORT_VALUE\"", ''), 'quoted-port literal must not be interpolated into ssh args')

    def test_migration_step_psql_argv_expands_container_credentials(self):
        self.assertIn('--username=\\"$POSTGRES_USER\\"', self.step)
        self.assertIn('--dbname=\\"$POSTGRES_DB\\"', self.step)
        self.assertIn('"exec","-T","postgres","sh","-c"', self.step)

    def test_manifest_binding_precedes_execution(self):
        self.assertLess(self.step.index('Stage 2 (pre-execution binding)'), self.step.index('Stage 3: execute'))

    def test_state_directory_is_release_scoped(self):
        self.assertIn('.release-migration-state/$2', self.step)

    def test_no_automatic_deploy_retry_remains(self):
        self.assertNotIn('up -d --build))', self.text)
        self.assertNotIn('up -d --build', self.text)

    def test_stage_a_digest_verification_precedes_all_writes(self):
        self.assertIn('Stage A read-only verify image digests', self.text)
        self.assertLess(self.text.index('Stage A read-only verify image digests'), self.text.index('Create production recovery point'))

    def test_stage_b_first_write_gate_precedes_recovery_point_and_writes(self):
        self.assertIn('Stage B first-write authorization', self.text)
        self.assertLess(self.text.index('Stage B first-write authorization'), self.text.index('Create production recovery point'))
        self.assertLess(self.text.index('Stage B first-write authorization'), self.text.index('Synchronize configured website ingest secret'))

    def test_all_step_names_are_colon_free(self):
        # A colon forces YAML to quote the name, which defeats the stepRun
        # exact-line extractor used by the release simulation.
        for path in (WORKFLOW, RELEASE_IMAGES):
            for name in step_names(path.read_text()):
                self.assertNotIn(':', name, f'{path.name}: step name contains a colon: {name}')

    def test_digest_pinned_pull_deploy(self):
        self.assertIn('docker pull "$api_image"', self.text)
        self.assertIn('docker pull "$web_image"', self.text)
        self.assertIn('docker save "$api_image" "$web_image" | run_ssh "docker load"', self.text)
        self.assertIn("grep -q '@sha256:'", self.text)

    def test_image_load_step_sits_between_migration_and_deploy(self):
        self.assertLess(self.text.index('Controlled migration'), self.text.index('Load digest-pinned images onto the production host'))
        self.assertLess(self.text.index('Load digest-pinned images onto the production host'), self.text.index('- name: Deploy and verify'))

    def test_runner_only_registry_credentials(self):
        # The host never receives registry credentials; only image bytes cross the link.
        deploy_job = self.text[self.text.index('  deploy:'):]
        self.assertIn('packages: read', deploy_job)
        self.assertNotIn('docker login', deploy_job.replace('docker/login-action', ''))

    def test_preflight_window_mode_is_explicit(self):
        # The 13F write fence stops the old api before dispatch; the preflight must
        # acknowledge it explicitly rather than by silent tolerance.
        self.assertIn('--allow-stopped-api', self.text)

    def test_rsync_preserves_migration_evidence_and_state(self):
        self.assertIn("--exclude '.release-migration-evidence/'", self.text)
        self.assertIn("--exclude '.release-migration-state/'", self.text)


class ReleaseImagesWorkflowStaticTest(unittest.TestCase):
    def test_dispatch_only_and_ghcr_scoped(self):
        text = RELEASE_IMAGES.read_text()
        self.assertIn('workflow_dispatch', text)
        self.assertNotIn('push:', text.split('jobs:')[0].replace('packages: write', ''))
        self.assertIn('ghcr.io/ivanzhao299/kingturf-erp-api', text)
        self.assertIn('ghcr.io/ivanzhao299/kingturf-erp-web', text)
        self.assertIn('digest', text)

    def test_main_history_membership_is_enforced(self):
        text = RELEASE_IMAGES.read_text()
        self.assertIn('git merge-base --is-ancestor', text)
        self.assertLess(text.index('Verify commit is in main history'), text.index('Build and push API image'))

    def test_digest_outputs_are_machine_consumable(self):
        text = RELEASE_IMAGES.read_text()
        self.assertIn('id: digests', text)
        self.assertIn('api_digest=${{ steps.api.outputs.digest }}', text)
        self.assertIn('web_digest=${{ steps.web.outputs.digest }}', text)
        self.assertIn('api_digest: ${{ steps.digests.outputs.api_digest }}', text)
        self.assertIn('web_digest: ${{ steps.digests.outputs.web_digest }}', text)
        self.assertNotIn('|| true', text)
        self.assertIn('docker buildx imagetools inspect --raw', text)


if __name__ == '__main__':
    unittest.main()
