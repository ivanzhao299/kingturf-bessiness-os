import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location('recovery_check', Path(__file__).resolve().parents[2] / 'scripts/recovery_material_check.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NOW = datetime(2026, 10, 9, 0, 0, tzinfo=timezone.utc)
SHA = 'a' * 40


class MaterialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'database.dump').write_bytes(b'PGDMPsynthetic-fixture-not-a-restore')
        for kind in ('attachments', 'configuration'):
            with tarfile.open(self.root / (kind + '.tar'), 'w') as f:
                info = tarfile.TarInfo('synthetic.txt'); info.size = 1
                f.addfile(info, io.BytesIO(b'x'))
        self.data = {'format_version': 1, 'source_sha': SHA,
                     'snapshot_at': '2026-10-08T23:00:00Z', 'artifacts': {}}
        for kind in ('database', 'attachments', 'configuration'):
            name = kind + ('.dump' if kind == 'database' else '.tar')
            b = (self.root / name).read_bytes()
            self.data['artifacts'][kind] = {'path': name, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}

    def verify(self):
        manifest = self.root / 'manifest.json'
        manifest.write_text(json.dumps(self.data))
        return module.verify(self.root, manifest, SHA, 24, NOW)

    def rejected(self):
        with self.assertRaises((ValueError, KeyError, FileNotFoundError)):
            self.verify()

    def test_material_pass_never_means_restore_pass(self):
        self.assertEqual(self.verify()['material_integrity'], 'PASS')
        self.assertFalse(self.verify()['restore_verified'])

    def test_configuration_required(self):
        del self.data['artifacts']['configuration']; self.rejected()

    def test_changed_sha(self):
        self.data['source_sha'] = 'b' * 40; self.rejected()

    def test_stale_snapshot(self):
        self.data['snapshot_at'] = '2026-10-01T00:00:00Z'; self.rejected()

    def test_future_snapshot(self):
        self.data['snapshot_at'] = '2026-10-10T00:00:00Z'; self.rejected()

    def test_checksum_mismatch(self):
        self.data['artifacts']['database']['sha256'] = '0' * 64; self.rejected()

    def test_partial_transfer(self):
        (self.root / 'database.dump').write_bytes(b'PGDMP'); self.rejected()

    def test_traversal(self):
        self.data['artifacts']['database']['path'] = '../other.dump'; self.rejected()

    def test_absolute_path(self):
        self.data['artifacts']['database']['path'] = '/data/kingturf-erp/private.dump'; self.rejected()

    def test_symlink_escape(self):
        (self.root / 'linked').symlink_to(self.root, target_is_directory=True)
        self.data['artifacts']['database']['path'] = 'linked/database.dump'; self.rejected()

    def test_archive_symlink_rejected(self):
        path = self.root / 'configuration.tar'
        with tarfile.open(path, 'w') as f:
            i = tarfile.TarInfo('link'); i.type = tarfile.SYMTYPE; i.linkname = '/etc/passwd'; f.addfile(i)
        b = path.read_bytes(); self.data['artifacts']['configuration'].update(bytes=len(b), sha256=hashlib.sha256(b).hexdigest()); self.rejected()

    def test_infinite_age_rejected(self):
        with self.assertRaises(ValueError):
            module.verify(self.root, self.root / "manifest.json", SHA, float("inf"), NOW)

    def test_age_multiplication_overflow_rejected(self):
        with self.assertRaises(ValueError):
            module.verify(self.root, self.root / "manifest.json", SHA, 1e308, NOW)

    def test_manifest_claims_are_not_provenance(self):
        r = self.verify()
        self.assertFalse(r["provenance_verified"])
        self.assertFalse(r["snapshot_time_verified"])

    def test_duplicate_manifest_keys(self):
        with self.assertRaises(ValueError):
            json.loads('{"source_sha":"a","source_sha":"b"}', object_pairs_hook=module.no_duplicates)


if __name__ == '__main__':
    unittest.main()
