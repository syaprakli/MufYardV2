"""Kurucu yetki kontrolü, sabit kimlik bypass'ları ve canlı rapor WebSocket yetkilendirmesi testleri."""
import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_sec_test2_")
os.environ["DATA_DIR"] = _TEST_DATA_DIR
os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"] = os.path.join(_TEST_DATA_DIR, "missing-firebase.json")
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from app.config import get_founder_emails  # noqa: E402
from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.routers.audit import _resolve_audit_role  # noqa: E402
from app.routers.collaboration import is_yjs_document_write, resolve_report_collab_access  # noqa: E402

FOUNDER_EMAIL = sorted(get_founder_emails())[0]
AUDIT = {
    "id": "audit_1",
    "owner_id": "owner_uid",
    "shared_roles": {"viewer_uid": "view", "editor@example.com": "edit"},
}


def _user(uid, email, verified, role):
    return lambda: {"uid": uid, "email": email, "email_verified": verified, "role": role}


class FounderEndpointTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        limiter.enabled = False
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.clear()
        limiter.enabled = True

    def test_unverified_founder_email_cannot_use_backup_or_role_settings(self):
        app.dependency_overrides[get_current_user] = _user("attacker", FOUNDER_EMAIL, False, "user")
        self.assertEqual(self.client.post("/api/backup/export").status_code, 403)
        self.assertEqual(self.client.post("/api/backup/drive-backup").status_code, 403)
        self.assertEqual(
            self.client.post("/api/backup/import", files={"file": ("b.json", b"{}", "application/json")}).status_code,
            403,
        )
        self.assertEqual(self.client.get("/api/settings/roles").status_code, 403)
        self.assertEqual(
            self.client.patch("/api/settings/roles", json={"moderator_permissions": []}).status_code, 403
        )

    def test_regular_admin_without_founder_email_is_rejected(self):
        app.dependency_overrides[get_current_user] = _user("admin2", "admin2@example.com", True, "admin")
        self.assertEqual(self.client.get("/api/settings/roles").status_code, 403)

    def test_verified_founder_admin_passes_role_settings(self):
        app.dependency_overrides[get_current_user] = _user("founder", FOUNDER_EMAIL, True, "admin")
        self.assertEqual(self.client.get("/api/settings/roles").status_code, 200)


class AuditRoleTests(unittest.TestCase):
    def test_hardcoded_founder_email_no_longer_grants_edit(self):
        self.assertEqual(_resolve_audit_role(AUDIT, "attacker", "sefa.yaprakli@gsb.gov.tr", "user"), "none")

    def test_literal_admin_identity_no_longer_grants_edit(self):
        self.assertEqual(_resolve_audit_role(AUDIT, "admin", None, "user"), "none")

    def test_owner_shared_and_admin_roles(self):
        self.assertEqual(_resolve_audit_role(AUDIT, "owner_uid", None, "user"), "edit")
        self.assertEqual(_resolve_audit_role(AUDIT, "viewer_uid", None, "user"), "view")
        self.assertEqual(_resolve_audit_role(AUDIT, "x", "editor@example.com", "user"), "edit")
        self.assertEqual(_resolve_audit_role(AUDIT, "someone", None, "admin"), "edit")

    def test_missing_owner_does_not_match_missing_identity(self):
        self.assertEqual(_resolve_audit_role({"owner_id": None}, "u1", None, "user"), "none")


class HardcodedBypassRemovalTests(unittest.TestCase):
    def test_no_hardcoded_privileged_uid_or_founder_email_in_access_code(self):
        files = [
            "app/services/profile_service.py",
            "app/services/collaboration_service.py",
            "app/services/contact_service.py",
            "app/routers/audit.py",
            "app/routers/notes.py",
            "app/routers/backup.py",
            "app/routers/settings.py",
        ]
        for rel in files:
            src = (BACKEND_ROOT / rel).read_text(encoding="utf-8")
            with self.subTest(file=rel):
                self.assertNotIn("VKV8SfuNkWf9WeTYeSCTizd4oG83", src)
                self.assertNotIn("sefa.yaprakli@gsb.gov.tr", src)
                self.assertNotIn("_ensure_founder", src)


class ReportCollabWebSocketTests(unittest.TestCase):
    def _access(self, token, decoded, user_role="user", audit=AUDIT):
        async def run():
            with patch("firebase_admin.auth.verify_id_token", return_value=decoded), \
                 patch("app.lib.auth._get_role_for_uid", new=AsyncMock(return_value=user_role)), \
                 patch("app.services.audit_service.AuditService.get_audit", new=AsyncMock(return_value=audit)):
                return await resolve_report_collab_access(token, "audit_1")
        return asyncio.run(run())

    def test_access_levels(self):
        self.assertIsNone(self._access(None, {"uid": "owner_uid"}))
        self.assertIsNone(self._access("t", {"uid": "outsider", "email": "o@example.com"}))
        self.assertEqual(self._access("t", {"uid": "owner_uid"}), "edit")
        self.assertEqual(self._access("t", {"uid": "viewer_uid"}), "read")
        self.assertEqual(self._access("t", {"uid": "mod"}, user_role="moderator"), "read")
        self.assertEqual(self._access("t", {"uid": "adm"}, user_role="admin"), "edit")
        self.assertIsNone(self._access("t", {"uid": "owner_uid"}, audit=None))

    def test_invalid_token_rejected(self):
        async def run():
            with patch("firebase_admin.auth.verify_id_token", side_effect=ValueError("bad")):
                return await resolve_report_collab_access("bad", "audit_1")
        self.assertIsNone(asyncio.run(run()))

    def test_outsider_websocket_is_closed(self):
        client = TestClient(app)
        with patch("app.routers.collaboration.resolve_report_collab_access", new=AsyncMock(return_value=None)):
            with self.assertRaises(WebSocketDisconnect):
                with client.websocket_connect("/api/collaboration/report/audit_1?token=t") as ws:
                    ws.receive_bytes()

    def test_yjs_write_detection(self):
        self.assertFalse(is_yjs_document_write(bytes([0, 0, 1])))  # sync step1 (istek)
        self.assertTrue(is_yjs_document_write(bytes([0, 1, 1])))   # sync step2
        self.assertTrue(is_yjs_document_write(bytes([0, 2, 1])))   # update
        self.assertFalse(is_yjs_document_write(bytes([1, 2, 1])))  # awareness
        self.assertFalse(is_yjs_document_write(b""))

    def test_read_only_client_cannot_push_updates(self):
        client = TestClient(app)
        with patch("app.routers.collaboration.resolve_report_collab_access", new=AsyncMock(side_effect=["edit", "read"])):
            with client.websocket_connect("/api/collaboration/report/audit_1?token=e") as editor, \
                 client.websocket_connect("/api/collaboration/report/audit_1?token=v") as viewer:
                viewer.send_bytes(bytes([0, 2, 9, 9]))   # engellenmeli
                viewer.send_bytes(bytes([0, 0, 7]))      # step1 iletilmeli
                self.assertEqual(editor.receive_bytes(), bytes([0, 0, 7]))
                editor.send_bytes(bytes([0, 2, 5]))      # editörün güncellemesi izleyiciye ulaşmalı
                self.assertEqual(viewer.receive_bytes(), bytes([0, 2, 5]))


if __name__ == "__main__":
    unittest.main()
