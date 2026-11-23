"""Yerel dosya modu ve görev klasörü uç noktalarındaki sahiplik açığının kapatılması."""
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_local_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.lib import auth  # noqa: E402
from app.lib.auth import get_current_user  # noqa: E402
from app.lib.folder_manager import FolderManager  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402

META = {"rapor_kodu": "S.Y.64/2026-7", "rapor_adi": "Baskasinin Gorevi", "rapor_turu": "İl Denetimi",
        "baslama_tarihi": "01.03.2026"}


class TaskFolderOwnershipTests(unittest.TestCase):
    """Sunucuda istemcinin gönderdiği görev bilgisiyle başkasının klasörüne sahip olunamamalı."""

    def setUp(self):
        limiter.enabled = False
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "saldirgan", "email": "s@example.com", "email_verified": True, "role": "user"}
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.clear()
        limiter.enabled = True

    def _fake_db(self, task):
        doc = MagicMock()
        doc.exists = task is not None
        doc.to_dict.return_value = task or {}
        db = MagicMock()
        db.collection.return_value.document.return_value.get.return_value = doc
        return db

    def test_metadata_cannot_claim_someone_elses_task_folder(self):
        task = {**META, "owner_id": "gercek_sahip", "assigned_to": ["gercek_sahip"]}
        with patch("app.lib.firebase_admin.db", self._fake_db(task)), \
             patch.object(FolderManager, "set_permission") as set_perm:
            for ep in ("create-task-folder", "open-task-folder"):
                with self.subTest(ep=ep):
                    resp = self.client.post(f"/api/files/{ep}/gorev123", json=META)
                    self.assertEqual(resp.status_code, 403, resp.text)
            set_perm.assert_not_called()

    def test_metadata_for_unknown_task_is_rejected(self):
        with patch("app.lib.firebase_admin.db", self._fake_db(None)), \
             patch.object(FolderManager, "set_permission") as set_perm:
            resp = self.client.post("/api/files/create-task-folder/yok", json=META)
            self.assertEqual(resp.status_code, 404, resp.text)
            set_perm.assert_not_called()


class LocalModeAuthTests(unittest.TestCase):
    def test_local_mode_verifies_token_without_admin_and_grants_local_owner(self):
        claims = {"sub": "u1", "user_id": "u1", "email": "u1@gsb.gov.tr", "email_verified": True,
                  "iss": "https://securetoken.google.com/mufyardv2"}
        with patch.object(auth, "LOCAL_FILES_MODE", True), \
             patch("google.oauth2.id_token.verify_firebase_token", return_value=claims), \
             patch("firebase_admin.auth.verify_id_token", side_effect=AssertionError("yönetici doğrulaması kullanılmamalı")):
            user = asyncio.run(get_current_user(authorization="Bearer a.b.c", x_user_id=None, x_user_email=None))
        self.assertEqual(user["uid"], "u1")
        self.assertEqual(user["role"], "admin")
        self.assertTrue(user.get("local"))

    def test_local_mode_rejects_other_project_and_unverified(self):
        cases = [
            {"sub": "u1", "email_verified": True, "iss": "https://securetoken.google.com/baska-proje"},
            {"sub": "u1", "email_verified": False, "iss": "https://securetoken.google.com/mufyardv2"},
        ]
        for claims in cases:
            with self.subTest(claims=claims), patch.object(auth, "LOCAL_FILES_MODE", True), \
                 patch("google.oauth2.id_token.verify_firebase_token", return_value=claims):
                with self.assertRaises(HTTPException) as ctx:
                    asyncio.run(get_current_user(authorization="Bearer a.b.c", x_user_id=None, x_user_email=None))
                self.assertIn(ctx.exception.status_code, (401, 403))

    def test_local_mode_disables_x_user_id_backdoor(self):
        with patch.object(auth, "LOCAL_FILES_MODE", True), patch.object(auth, "is_mock", True):
            with self.assertRaises(HTTPException) as ctx:
                asyncio.run(get_current_user(authorization=None, x_user_id="biri", x_user_email=None))
        self.assertEqual(ctx.exception.status_code, 401)


class LocalModeAppTests(unittest.TestCase):
    """Uygulamayı yerel modda ayrı bir süreçte açar: anahtar okunmamalı, yalnızca dosya uç noktaları olmalı."""

    def test_local_mode_process(self):
        script = (
            "import json, logging\n"
            "logging.disable(logging.CRITICAL)\n"
            "from app.lib import firebase_admin as fa\n"
            "from app.main import app\n"
            "paths = sorted({r.path for r in app.routes if hasattr(r, 'path')})\n"
            "print(json.dumps({'is_mock': fa.is_mock, 'paths': paths}))\n"
        )
        tmp = tempfile.mkdtemp(prefix="mufyard_localproc_")
        env = {**os.environ,
               "MUFYARD_LOCAL_FILES": "1",
               "DATA_DIR": tmp,
               # Yanlışlıkla okunursa başlatmayı bozacak sahte kimlik bilgileri:
               "FIREBASE_SERVICE_ACCOUNT_JSON": json.dumps({"type": "service_account", "project_id": "x",
                                                            "private_key": "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n",
                                                            "client_email": "x@x.iam.gserviceaccount.com"}),
               "FIREBASE_SERVICE_ACCOUNT_PATH": os.path.join(tmp, "yok.json"),
               "PYTHONIOENCODING": "utf-8"}
        out = subprocess.run([sys.executable, "-c", script], cwd=str(BACKEND_ROOT), env=env,
                             capture_output=True, text=True, timeout=120)
        self.assertEqual(out.returncode, 0, out.stderr[-2000:])
        data = json.loads(out.stdout.strip().splitlines()[-1])
        self.assertTrue(data["is_mock"])
        api = [p for p in data["paths"] if p.startswith("/api/")]
        self.assertTrue(api, data["paths"])
        self.assertTrue(all(p.startswith("/api/files/") for p in api), [p for p in api if not p.startswith("/api/files/")])
        for p in ("/api/tasks/", "/api/profiles/{uid}", "/api/backup/export", "/api/ai/chat"):
            self.assertNotIn(p, data["paths"])


if __name__ == "__main__":
    unittest.main()
