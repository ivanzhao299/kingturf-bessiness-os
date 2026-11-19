from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / '.github/workflows/release.yml'
ROLLBACK = ROOT / '.github/workflows/release-rollback.yml'
LEGACY_CHANNELS = (
    'release-images.yml',
    'recover-application-images.yml',
    'apply-migrations.yml',
    'ops-maintenance.yml',
)


class ReleasePipelineContract(unittest.TestCase):
    def test_release_yml_single_input_job_chain_and_internal_digest_passing(self):
        text = RELEASE.read_text()
        for contract in (
            'workflow_dispatch:',
            'commit_sha:',
            'github.workflow_sha',
            'node scripts/validate_release.mjs',
            'pnpm ci:local',
            'needs: [validate, build]',
            'needs: [validate, build, verify]',
            'needs: [validate, build, verify, deploy]',
            'needs.build.outputs.api_digest',
            'needs.build.outputs.web_digest',
            'api_digest=${{ steps.api.outputs.digest }}',
            'web_digest=${{ steps.web.outputs.digest }}',
            'packages: write',
            'prepare_release_bundle.sh "$RELEASE_SHA" "$API_DIGEST" "$WEB_DIGEST"',
            'smoke_release_images.sh',
            'oci_image_transport.py import',
            'release_orchestrator.py plan',
            '--approved-suffixes',
            '--expected-before',
            '--expected-after',
            'environment: production',
            'group: kingturf-erp-production',
            'cancel-in-progress: false',
            'production_known_hosts',
            'persist-credentials: false',
            'recover_application_images.sh',
            'verify_public_https.py',
            'retention-days: 90',
            'retention-days: 30',
            "jsonb_agg(jsonb_build_object('name',name,'checksum',checksum)",
        ):
            self.assertIn(contract, text)
        # D1 kills the manual stitching seam: no human digest/run-id dispatch
        # inputs and no references to them (the bundle's internal images_run_id
        # binding is this run's own id, not a human input).
        for absent in ('images_run_id: ${{', 'Previously approved GHCR'):
            self.assertNotIn(absent, text)
        # Build is inlined: the pipeline never references the legacy build workflow.
        self.assertNotIn('release-images.yml', text)
        # Exactly one production lock acquisition point (the locked deploy job
        # carries the conditional migrate inline) — the Wave2 migration-to-deploy
        # seam must not reopen between two separately locked jobs.
        self.assertEqual(text.count('group: kingturf-erp-production'), 1)

    def test_rollback_yml_is_application_only_with_self_resolved_digests(self):
        text = ROLLBACK.read_text()
        for contract in (
            'workflow_dispatch:',
            'commit_sha:',
            'github.workflow_sha',
            'node scripts/validate_release.mjs',
            'imagetools inspect --raw',
            'prepare_release_bundle.sh',
            'smoke_release_images.sh',
            'recover_application_images.sh',
            'environment: production',
            'group: kingturf-erp-production',
            'cancel-in-progress: false',
            'production_known_hosts',
            'persist-credentials: false',
            'verify_public_https.py',
            'needs: [validate, restore]',
        ):
            self.assertIn(contract, text)
        # Rollback never touches the schema tooling and never re-runs full CI:
        # its target is a historical, already-verified candidate and the rollback
        # path must stay fast; preflight fail-closed guards schema compatibility.
        for absent in ('apply_migrations.py', 'release_orchestrator.py', 'pnpm ci:local'):
            self.assertNotIn(absent, text)

    def test_legacy_channels_remain_for_emergency_and_maintenance_use(self):
        for name in LEGACY_CHANNELS:
            self.assertTrue((ROOT / '.github/workflows' / name).is_file(), name)

    def test_workflow_yaml_parses_with_expected_job_graph_and_single_input(self):
        import yaml

        release = yaml.safe_load(RELEASE.read_text())
        self.assertEqual(list(release['jobs'].keys()), ['validate', 'build', 'verify', 'deploy', 'post'])
        self.assertEqual(release['jobs']['build']['needs'], 'validate')
        self.assertEqual(release['jobs']['verify']['needs'], ['validate', 'build'])
        self.assertEqual(release['jobs']['deploy']['needs'], ['validate', 'build', 'verify'])
        self.assertEqual(release['jobs']['post']['needs'], ['validate', 'build', 'verify', 'deploy'])
        on_release = release[True]  # YAML 1.1 parses the bare `on:` key as boolean True
        self.assertEqual(list(on_release['workflow_dispatch']['inputs'].keys()), ['commit_sha'])

        rollback = yaml.safe_load(ROLLBACK.read_text())
        self.assertEqual(list(rollback['jobs'].keys()), ['validate', 'restore', 'deploy'])
        self.assertEqual(rollback['jobs']['restore']['needs'], 'validate')
        self.assertEqual(rollback['jobs']['deploy']['needs'], ['validate', 'restore'])
        on_rollback = rollback[True]
        self.assertEqual(list(on_rollback['workflow_dispatch']['inputs'].keys()), ['commit_sha'])

    def test_deploy_job_keeps_conditional_migrate_inline_before_the_deploy_steps(self):
        text = RELEASE.read_text()
        deploy = text.split('  deploy:', 1)[1].split('\n  post:', 1)[0]
        self.assertIn("release_orchestrator.py plan", deploy)
        # CLI argv order is fixed by release_orchestrator.py main:
        # build_plan(args[1], args[2], registry) -> plan <migrations_dir> <release_sha> <registry>.
        plan_line = next(line for line in deploy.splitlines() if 'release_orchestrator.py plan' in line)
        self.assertLess(plan_line.index('.candidate/packages/database/migrations'), plan_line.index('$RELEASE_SHA'))
        self.assertLess(plan_line.index('$RELEASE_SHA'), plan_line.index('registry.json'))
        plan_pos = deploy.index('release_orchestrator.py plan')
        apply_pos = deploy.index("python3 '$STAGED/apply_migrations.py'")
        transfer_pos = deploy.index('Transfer and recover application only')
        # The gated apply runs only when the read-only plan found pending work,
        # and always precedes the application switch inside the same lock.
        self.assertIn("if: steps.plan.outputs.has_pending == 'true'", deploy)
        self.assertLess(plan_pos, apply_pos)
        self.assertLess(apply_pos, transfer_pos)
        # The pinned control bundle still carries the application release gate.
        self.assertIn('for script in oci_image_transport application_release production_preflight', deploy)


if __name__ == '__main__':
    unittest.main()
