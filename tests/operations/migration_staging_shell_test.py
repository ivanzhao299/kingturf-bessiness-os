"""TD-REL-012: execute the actual staging shell with local SSH/rsync substitutes.

Only the fixed production root is mapped into this test's owned temporary tree.
Remote bash, stat, find, mkdir, ownership, modes, checksum and SQL-count checks
execute for real there. No SSH client, network or production directory is used.
"""
import ast
import getpass
import shlex
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = Path(os.environ.get('KINGTURF_STAGING_TEST_WORKFLOW', ROOT/'.github/workflows/release.yml'))
NAME = 'Stage control and candidate migrations on the host'


def staging_body():
    text = WORKFLOW.read_text()
    section = text.split('      - name: '+NAME+'\n', 1)[1].split('\n      - ', 1)[0]
    block = section.split('        run: |\n', 1)[1]
    return '\n'.join(line[10:] if line.startswith('          ') else line for line in block.splitlines())+'\n'


# Functions exist only on the runner. A remote bash subprocess cannot inherit
# stat/find traps, so any accidental runner-side command substitution is caught.
SUBSTITUTES = r'''
stat() { printf 'runner stat\n' >> "$RUNNER_TEMP/runner-probes"; return 91; }
find() { printf 'runner find\n' >> "$RUNNER_TEMP/runner-probes"; return 92; }
ssh() {
  printf '%s\0' "${!#}" >> "$RUNNER_TEMP/ssh-commands"
  bash --noprofile --norc -c "${!#}"
}
rsync() {
  python3 -I -c '
import os,pathlib,shutil,sys
args=sys.argv[1:]; target=pathlib.Path(args[-1].split(":",1)[1])
# Sources follow -e <transport>; ownership flags precede that pair.
for source in args[args.index("-e")+2:-1]:
 p=pathlib.Path(source)
 if p.is_dir(): shutil.copytree(p,target,dirs_exist_ok=True)
 else:
  target.mkdir(parents=True,exist_ok=True)
  shutil.copy2(p,target/p.name)
  if os.environ.get("STAGING_FIXTURE_TAMPER")=="true" and p.name=="apply_migrations.py":
   (target/p.name).write_bytes(b"changed transferred control")
' "$@"
}
'''


class MigrationStagingShellTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='migration-stage-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'scripts').mkdir()
        for name in ('apply_migrations.py', 'release_orchestrator.py', 'production_preflight.py'):
            (self.root/'scripts'/name).write_bytes(('synthetic control '+name).encode())
        sql = self.root/'.candidate/packages/database/migrations'
        sql.mkdir(parents=True)
        for name in ('0001_one.sql', '0002_two.sql'):
            (sql/name).write_text('SELECT 1;\n')
        self.deploy = self.root/'owned-production-root'
        self.deploy.mkdir()
        self.runner = self.root/'runner'
        self.runner.mkdir()
        self.staged = self.deploy/'.staging/wave2-123-1'
        self.environment = dict(os.environ, RUNNER_TEMP=str(self.runner), PROD_DEPLOY_PATH=str(self.deploy), GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', PROD_SSH_HOST='fixture.invalid', PROD_SSH_PORT='22', PROD_SSH_USER=getpass.getuser(), SSH_KNOWN_HOSTS_FILE=str(self.root/'synthetic-known-hosts'), EXPECTED_AFTER='2')

    def execute(self, **changes):
        script = staging_body().replace('/data/kingturf-erp', str(self.deploy))
        result = subprocess.run(['bash', '--noprofile', '--norc', '-c', SUBSTITUTES+script], cwd=self.root, env=self.environment | changes, capture_output=True, text=True, timeout=30)
        self.result = result
        return result

    def test_actual_staging_shell_creates_exact_private_tree_and_runs_checks_remotely(self):
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.staged/'migrations').is_dir())
        self.assertEqual({path.name for path in self.staged.iterdir()}, {'migrations', 'apply_migrations.py', 'release_orchestrator.py', 'production_preflight.py'})
        self.assertEqual({path.name for path in (self.staged/'migrations').iterdir()}, {'0001_one.sql', '0002_two.sql'})
        self.assertEqual(stat.S_IMODE(self.staged.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((self.staged/'migrations').stat().st_mode), 0o700)
        self.assertEqual(self.staged.stat().st_uid, os.geteuid())
        self.assertFalse((self.runner/'runner-probes').exists(), 'stat/find expanded on runner')
        commands = (self.runner/'ssh-commands').read_bytes().split(b'\0')[:-1]
        self.assertEqual(len(commands), 2)
        self.assertTrue(all(command.startswith(b'bash -s -- ') for command in commands))
        self.assertEqual((self.staged/'apply_migrations.py').read_bytes(), (self.root/'scripts/apply_migrations.py').read_bytes())

    def test_non_numeric_run_identity_fails_before_remote_creation(self):
        for name, value in (('GITHUB_RUN_ID', '../escape'), ('GITHUB_RUN_ATTEMPT', '1; true')):
            with self.subTest(variable=name):
                result = self.execute(**{name: value})
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.runner/'ssh-commands').exists())
                self.assertFalse((self.deploy/'.staging').exists())

    def test_symlinked_parent_is_rejected_without_touching_its_target(self):
        outside = self.root/'other-owned-directory'
        outside.mkdir()
        marker = outside/'retained'
        marker.write_bytes(b'retain this data')
        (self.deploy/'.staging').symlink_to(outside, target_is_directory=True)
        result = self.execute()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_bytes(), b'retain this data')
        self.assertEqual({path.name for path in outside.iterdir()}, {'retained'})

    def test_owner_mismatch_fails_before_deleting_existing_stage(self):
        self.staged.mkdir(parents=True)
        marker = self.staged/'retained'
        marker.write_bytes(b'previous run data')
        result = self.execute(PROD_SSH_USER='synthetic_other_user')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_bytes(), b'previous run data')

    def test_transferred_control_tamper_is_detected_before_apply(self):
        result = self.execute(STAGING_FIXTURE_TAMPER='true')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.staged/'apply_migrations.py').read_bytes(), b'changed transferred control')

    def test_sql_count_mismatch_is_rejected(self):
        result = self.execute(EXPECTED_AFTER='3')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.staged/'migrations/0001_one.sql').is_file())

    def test_all_three_rsync_commands_keep_receiver_ownership_including_root(self):
        # Cross-UID behavior is independently reproduced by the coordinator in a
        # root container. This checks actual argv construction, not a same-UID
        # copy substitute claiming to reproduce rsync's owner preservation.
        transfers = [shlex.split(line.strip()) for line in staging_body().splitlines() if line.strip().startswith('rsync ')]
        self.assertEqual(len(transfers), 2)
        source = ast.parse((ROOT/'scripts/stage_recovery_material.py').read_text())
        commands = [node for node in ast.walk(source) if isinstance(node, ast.List) and node.elts and isinstance(node.elts[0], ast.Constant) and node.elts[0].value == 'rsync']
        self.assertEqual(len(commands), 1)
        transfers.append([node.value for node in commands[0].elts if isinstance(node, ast.Constant)])
        for argv in transfers:
            self.assertIn('--no-owner', argv)
            self.assertIn('--no-group', argv)
            self.assertNotIn('--chown', argv)
        helper = (ROOT/'scripts/stage_recovery_material.py').read_text()
        self.assertIn('st_uid==os.geteuid()', helper)
        self.assertIn('path.stat().st_uid == os.geteuid()', helper)

    def test_staging_remains_before_recovery_material_and_apply_in_existing_job(self):
        text = (ROOT/'.github/workflows/release.yml').read_text()
        self.assertLess(text.index(NAME), text.index('Stage approved recovery material under production lock'))
        self.assertLess(text.index('Stage approved recovery material under production lock'), text.index('Apply approved migrations'))
        self.assertIn("if: steps.plan.outputs.has_pending == 'true'", text.split('      - name: '+NAME, 1)[1].split('        run:', 1)[0])
        self.assertIn('    environment: production\n', text)
        self.assertIn('    concurrency:\n      group: kingturf-erp-production\n      cancel-in-progress: false\n', text)
        self.assertEqual(re.findall(r'^  ([a-z_-]+):$', text.split('\njobs:', 1)[1], re.M), ['validate', 'build', 'verify', 'deploy', 'post'])


if __name__ == '__main__':
    unittest.main()
