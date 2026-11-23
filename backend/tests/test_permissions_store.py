"""file_permissions.json deposunun bozulmaya ve eşzamanlı yazmaya dayanıklı olduğunu doğrular."""
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_perm_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.lib import folder_manager as fm  # noqa: E402
from app.lib.folder_manager import FolderManager, PermissionsCorruptError  # noqa: E402
from app.services.task_service import _rename_permission_prefix  # noqa: E402


class PermissionsStoreTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="perm_store_")
        self.path = os.path.join(self.dir, "file_permissions.json")
        self.patch = patch.object(fm, "PERMISSIONS_FILE", self.path)
        self.patch.start()
        fm._perm_cache.update(key=None, data=None, corrupt=False)

    def tearDown(self):
        self.patch.stop()
        fm._perm_cache.update(key=None, data=None, corrupt=False)

    def _write_raw(self, text, path=None):
        with open(path or self.path, "w", encoding="utf-8") as f:
            f.write(text)
        fm._perm_cache.update(key=None, data=None, corrupt=False)

    def test_roundtrip_and_backup_created(self):
        FolderManager.set_permission("a/x.docx", "u1")
        FolderManager.set_permission("b/y.docx", "u2")
        perms = FolderManager.load_permissions()
        self.assertEqual(set(perms), {"a/x.docx", "b/y.docx"})
        self.assertTrue(os.path.exists(self.path + ".bak"))
        self.assertTrue(FolderManager.check_permission("a/x.docx", "u1", "read"))
        self.assertFalse(FolderManager.check_permission("a/x.docx", "u2", "read"))
        leftovers = [f for f in os.listdir(self.dir) if f.endswith(".tmp")]
        self.assertEqual(leftovers, [])

    def test_corrupt_file_falls_back_to_backup(self):
        FolderManager.set_permission("a/x.docx", "u1")
        FolderManager.set_permission("b/y.docx", "u2")  # .bak = yalnızca a/x.docx
        self._write_raw('{"yarım json": ')
        perms = FolderManager.load_permissions()
        self.assertIn("a/x.docx", perms)

    def test_refuses_to_overwrite_when_file_and_backup_unreadable(self):
        self._write_raw("bozuk")
        self._write_raw("bozuk", self.path + ".bak")
        self.assertEqual(FolderManager.load_permissions(), {})  # erişim reddedilir (fail closed)
        with self.assertRaises(PermissionsCorruptError):
            FolderManager.set_permission("c/z.docx", "u3")
        with open(self.path, encoding="utf-8") as f:
            self.assertEqual(f.read(), "bozuk")  # bozuk dosyanın üzerine boş içerik yazılmadı

    def test_failed_write_leaves_original_intact(self):
        FolderManager.set_permission("a/x.docx", "u1")
        with patch.object(fm.json, "dump", side_effect=RuntimeError("disk dolu")):
            with self.assertRaises(RuntimeError):
                FolderManager.set_permission("b/y.docx", "u2")
        with open(self.path, encoding="utf-8") as f:
            self.assertEqual(set(json.load(f)), {"a/x.docx"})
        self.assertEqual([f for f in os.listdir(self.dir) if f.endswith(".tmp")], [])

    def test_concurrent_updates_are_not_lost(self):
        def worker(i):
            FolderManager.set_permission(f"d/{i}.docx", f"u{i}")
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(40)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(len(FolderManager.load_permissions()), 40)

    def test_reads_are_cached_until_file_changes(self):
        FolderManager.set_permission("a/x.docx", "u1")
        fm._perm_cache.update(key=None, data=None)
        real_read = fm._read_permissions_file
        with patch.object(fm, "_read_permissions_file", side_effect=real_read) as spy:
            for _ in range(50):
                FolderManager.check_permission_or_ancestor("a/x.docx", "u1", "read")
            self.assertEqual(spy.call_count, 1)

    def test_returned_dict_mutation_does_not_corrupt_cache(self):
        FolderManager.set_permission("a/x.docx", "u1")
        perms = FolderManager.load_permissions()
        perms.clear()
        self.assertIn("a/x.docx", FolderManager.load_permissions())

    def test_rename_prefix(self):
        perms = {"R/A": 1, "R/A/f.docx": 2, "R/AB/g.docx": 3, "X": 4}
        self.assertEqual(_rename_permission_prefix(perms, "R/A", "R/Z"),
                         {"R/Z": 1, "R/Z/f.docx": 2, "R/AB/g.docx": 3, "X": 4})


if __name__ == "__main__":
    unittest.main()
