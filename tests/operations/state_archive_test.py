import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('apply_migrations', ROOT / 'scripts/apply_migrations.py')
am = importlib.util.module_from_spec(spec)
spec.loader.exec_module(am)

CANDIDATE = 'a' * 40
PRIOR = 'b' * 40


class TerminalStateArchiveTest(unittest.TestCase):
    """Ruling 11: terminal states of prior releases archive before a new
    candidate's execute; RUNNING states refuse and same-candidate states stay."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.state_dir = self.root / '.release-migration-state'
        self.state_file = self.state_dir / 'orchestration-state.json'
        os.chmod(self.state_dir.parent, 0o755)

    def tearDown(self):
        self.temp.cleanup()

    def write_state(self, release_sha: str, verdict: str) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps({'release_sha': release_sha, 'verdict': verdict}))

    def run_archive(self) -> list[dict]:
        captured: list[dict] = []
        real_emit = am.emit
        with mock.patch.object(am, 'emit', lambda step, payload, status='PASS': (
            captured.append({'step': step, **payload}),
            real_emit(step, payload, status),
        )):
            with redirect_stdout(io.StringIO()):
                am.archive_terminal_state(self.root, CANDIDATE)
        return captured

    def test_missing_state_file_is_a_noop(self):
        self.run_archive()
        self.assertFalse(self.state_file.exists())

    def test_same_candidate_state_is_left_untouched(self):
        self.write_state(CANDIDATE, 'RUNNING')
        before = self.state_file.read_text()
        self.run_archive()
        self.assertTrue(self.state_file.exists())
        self.assertEqual(self.state_file.read_text(), before)

    def test_prior_terminal_completed_state_archives_privately(self):
        self.write_state(PRIOR, 'COMPLETED')
        captured = self.run_archive()
        self.assertFalse(self.state_file.exists())
        archives = list((self.state_dir / 'archive').glob(f'{PRIOR}-*.json'))
        self.assertEqual(len(archives), 1)
        archived = archives[0]
        self.assertEqual(archived.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(archived.read_text())['release_sha'], PRIOR)
        self.assertEqual(captured, [{'step': 'state-archive', 'archived_sha': PRIOR,
                                     'verdict': 'COMPLETED', 'archive': str(archived)}])

    def test_prior_terminal_stopped_state_archives_too(self):
        self.write_state(PRIOR, 'STOPPED')
        self.run_archive()
        self.assertFalse(self.state_file.exists())
        self.assertEqual(len(list((self.state_dir / 'archive').glob(f'{PRIOR}-*.json'))), 1)

    def test_prior_non_terminal_state_refuses_without_touching_anything(self):
        self.write_state(PRIOR, 'RUNNING')
        before = self.state_file.read_text()
        with self.assertRaisesRegex(RuntimeError, 'not terminal'):
            self.run_archive()
        self.assertTrue(self.state_file.exists())
        self.assertEqual(self.state_file.read_text(), before)
        self.assertFalse((self.state_dir / 'archive').exists())

    def test_archive_directory_mode_is_private(self):
        self.write_state(PRIOR, 'COMPLETED')
        self.run_archive()
        self.assertEqual((self.state_dir / 'archive').stat().st_mode & 0o777, 0o700)


if __name__ == '__main__':
    unittest.main()
