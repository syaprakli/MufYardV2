"""Yerel dosya modu: görev klasörünün oluşturulması ve kod/ad değişince taşınması."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_sync_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.lib import folder_manager as fm  # noqa: E402
from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import files as files_router  # noqa: E402

TASLAK = {"rapor_kodu": "TASLAK-2026-3", "rapor_adi": "Van Il Denetimi", "rapor_turu": "İl Denetimi",
          "baslama_tarihi": "01.03.2026"}
KALICI = {**TASLAK, "rapor_kodu": "S.Y.64/2026-12"}


class SyncTaskFolderTests(unittest.TestCase):
    def setUp(self):
        limiter.enabled = False
        self.tmp = tempfile.mkdtemp(prefix="sync_")
        self.reports = os.path.join(self.tmp, "Raporlar")
        os.makedirs(self.reports)
        self.patches = [
            patch.object(files_router, "LOCAL_FILES_MODE", True),
            patch.object(files_router, "BASE_REPORTS_DIR", self.reports),
            patch.object(files_router, "DATA_DIR", self.tmp),
            patch.object(files_router, "_LOCAL_TASK_FOLDERS_FILE", os.path.join(self.tmp, "local_task_folders.json")),
            patch.object(fm, "BASE_REPORTS_DIR", self.reports),
            patch.object(fm, "PERMISSIONS_FILE", os.path.join(self.tmp, "file_permissions.json")),
        ]
        for p in self.patches:
            p.start()
        fm._perm_cache.update(key=None, data=None, corrupt=False)
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "u1", "email": "u1@gsb.gov.tr", "email_verified": True, "role": "admin", "local": True}
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.dependency_overrides.clear()
        limiter.enabled = True
        fm._perm_cache.update(key=None, data=None, corrupt=False)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _sync(self, meta, task_id="t1"):
        return self.client.post(f"/api/files/sync-task-folder/{task_id}", json=meta)

    def test_creates_folder_with_standard_subfolders(self):
        resp = self._sync(TASLAK)
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        self.assertTrue(body["rel_path"].startswith("Raporlar/2026/"))
        self.assertTrue(os.path.isdir(body["path"]))
        for sub in fm.STANDARD_SUBFOLDERS:
            self.assertTrue(os.path.isdir(os.path.join(body["path"], sub)), sub)
        self.assertFalse(body["renamed"])

    def test_code_change_moves_folder_with_contents_and_permissions(self):
        first = self._sync(TASLAK).json()
        rapor = os.path.join(first["path"], "04_Rapor_ve_Ekleri", "rapor.docx")
        with open(rapor, "w", encoding="utf-8") as f:
            f.write("icerik")
        old_rel = first["rel_path"][len("Raporlar/"):]
        fm.FolderManager.set_permission(old_rel + "/04_Rapor_ve_Ekleri/rapor.docx", "u1")

        second = self._sync(KALICI).json()
        self.assertTrue(second["renamed"])
        self.assertIn("S.Y.64-2026-12", second["rel_path"])
        self.assertFalse(os.path.exists(first["path"]))
        moved = os.path.join(second["path"], "04_Rapor_ve_Ekleri", "rapor.docx")
        with open(moved, encoding="utf-8") as f:
            self.assertEqual(f.read(), "icerik")
        perms = fm.FolderManager.load_permissions()
        new_rel = second["rel_path"][len("Raporlar/"):]
        self.assertIn(new_rel + "/04_Rapor_ve_Ekleri/rapor.docx", perms)
        self.assertFalse(any(k.startswith(old_rel) for k in perms))

    def test_does_not_overwrite_existing_target(self):
        first = self._sync(TASLAK).json()
        target = files_router._sync_local_task_folder  # noqa: F841 (yalnızca varlık kontrolü)
        # Hedef klasör zaten varsa taşıma yapılmaz, iki klasör de korunur.
        other = self._sync(KALICI, task_id="t2").json()
        third = self._sync(KALICI).json()
        self.assertFalse(third["renamed"])
        self.assertTrue(os.path.isdir(first["path"]))
        self.assertEqual(third["path"], other["path"])

    def test_tampered_mapping_cannot_move_outside_reports(self):
        outside = os.path.join(self.tmp, "Disari")
        os.makedirs(outside)
        with open(os.path.join(self.tmp, "local_task_folders.json"), "w", encoding="utf-8") as f:
            json.dump({"t1": "../Disari"}, f)
        resp = self._sync(TASLAK)
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertFalse(resp.json()["renamed"])
        self.assertTrue(os.path.isdir(outside))

    def test_disabled_outside_local_mode(self):
        with patch.object(files_router, "LOCAL_FILES_MODE", False):
            self.assertEqual(self._sync(TASLAK).status_code, 404)


if __name__ == "__main__":
    unittest.main()
