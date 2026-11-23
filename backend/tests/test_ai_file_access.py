"""AI araçlarının ve mevzuat analizinin dosya izinlerini atlamadığını doğrular."""
import asyncio
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Her zaman mock Firebase: yereldeki firebase-credentials.json / .env gerçek projeye bağlanmasın.
_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_ai_test_")
os.environ["DATA_DIR"] = _TEST_DATA_DIR
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"] = os.path.join(_TEST_DATA_DIR, "missing-firebase.json")
os.environ["FIREBASE_PRIVATE_KEY"] = ""

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import ai_actions  # noqa: E402
from app.services.ai_actions import execute_action  # noqa: E402
from app.services import ai_service as ai_service_mod  # noqa: E402
from app.services.ai_service import _can_read_legislation, _resolve_legislation_local_path  # noqa: E402

REPORTS = ai_actions.BASE_REPORTS_DIR
MEVZUAT = ai_service_mod.MEVZUAT_DIR
USER = {"uid": "alice", "email": "alice@example.com", "role": "user"}
ADMIN = {"uid": "root", "email": "root@example.com", "role": "admin"}


def _write(path: str, text: str = "gizli"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


class AIReportFileAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = os.path.join(REPORTS, "_ai_test")
        _write(os.path.join(cls.root, "alice", "kendi.txt"), "ALICE_ICERIK")
        _write(os.path.join(cls.root, "bob", "Bob Yilmaz Inceleme", "gizli.txt"), "BOB_GIZLI")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.root, ignore_errors=True)

    @staticmethod
    def _perm(rel, uid, action):
        return uid == "alice" and rel.startswith("_ai_test/alice")

    def _run(self, name, args, user=USER):
        with patch.object(ai_actions.FolderManager, "check_permission_or_ancestor", side_effect=self._perm):
            return asyncio.run(execute_action(name, args, user))

    def test_cannot_read_other_users_file(self):
        res = self._run("read_file_content", {"file_path": "_ai_test/bob/Bob Yilmaz Inceleme/gizli.txt"})
        self.assertFalse(res["success"])
        self.assertNotIn("BOB_GIZLI", res["message"])

    def test_can_read_own_file(self):
        res = self._run("read_file_content", {"file_path": "_ai_test/alice/kendi.txt"})
        self.assertTrue(res["success"], res)
        self.assertIn("ALICE_ICERIK", res["message"])

    def test_admin_can_read_any_file(self):
        res = self._run("read_file_content", {"file_path": "_ai_test/bob/Bob Yilmaz Inceleme/gizli.txt"}, ADMIN)
        self.assertTrue(res["success"], res)

    def test_traversal_and_sibling_prefix_blocked(self):
        sibling = REPORTS.rstrip("/\\") + "2"
        _write(os.path.join(sibling, "x.txt"), "SIBLING")
        try:
            for path in ["../x.txt", "../../etc/passwd", f"../{os.path.basename(sibling)}/x.txt"]:
                with self.subTest(path=path):
                    res = self._run("read_file_content", {"file_path": path}, ADMIN)
                    self.assertFalse(res["success"])
                    self.assertNotIn("SIBLING", res["message"])
        finally:
            shutil.rmtree(sibling, ignore_errors=True)

    def test_listing_hides_other_users_files_and_folder_names(self):
        res = self._run("list_files", {"path": "_ai_test"})
        self.assertTrue(res["success"], res)
        self.assertIn("alice", res["message"])
        self.assertNotIn("bob", res["message"])
        self.assertNotIn("Bob Yilmaz", res["message"])

    def test_listing_outside_reports_blocked(self):
        res = self._run("list_files", {"path": "../"})
        self.assertFalse(res["success"])


class LegislationAccessTests(unittest.TestCase):
    def test_private_legislation_only_for_owner_or_admin(self):
        leg = {"is_public": False, "owner_id": "bob"}
        self.assertFalse(_can_read_legislation(leg, USER))
        self.assertTrue(_can_read_legislation(leg, {"uid": "bob", "role": "user"}))
        self.assertTrue(_can_read_legislation(leg, ADMIN))
        self.assertTrue(_can_read_legislation({"is_public": True}, USER))

    def test_local_path_cannot_escape_mevzuat_dir(self):
        for lp in ["/Raporlar/bob/rapor.docx", "/Mevzuat/../Raporlar/bob/rapor.docx",
                   "../../proc/self/environ", "/Mevzuat/../../etc/passwd", ""]:
            with self.subTest(lp=lp):
                self.assertIsNone(_resolve_legislation_local_path(lp, "alice"))

    def test_local_path_cannot_point_to_other_users_private_folder(self):
        self.assertIsNone(_resolve_legislation_local_path("/Mevzuat/Kisisel/bob/Kanun/x.pdf", "alice"))
        ok = _resolve_legislation_local_path("/Mevzuat/Kisisel/alice/Kanun/x.pdf", "alice")
        self.assertEqual(os.path.realpath(ok), os.path.realpath(os.path.join(MEVZUAT, "Kisisel", "alice", "Kanun", "x.pdf")))

    def test_public_local_path_resolves_inside_mevzuat(self):
        p = _resolve_legislation_local_path("/Mevzuat/Kanun/Yonetmelik/a.pdf", None)
        self.assertEqual(os.path.realpath(p), os.path.realpath(os.path.join(MEVZUAT, "Kanun", "Yonetmelik", "a.pdf")))


if __name__ == "__main__":
    unittest.main()
