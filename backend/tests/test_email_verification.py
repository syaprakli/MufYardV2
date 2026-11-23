"""Doğrulanmamış e-postalı hesapların (alan adından bağımsız) hiçbir veriye erişemediğini doğrular."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_ev_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from app.lib.auth import EMAIL_NOT_VERIFIED_DETAIL  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402

HEADERS = {"Authorization": "Bearer x.y.z"}


def _decoded(email, verified):
    return {"uid": "u_" + email.split("@")[0], "email": email, "email_verified": verified}


class EmailVerificationTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        limiter.enabled = False
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        limiter.enabled = True

    def _get(self, decoded, path="/api/contacts/?category=corporate"):
        with patch("firebase_admin.auth.verify_id_token", return_value=decoded), \
             patch("app.lib.auth._get_role_for_uid", new=AsyncMock(return_value="user")):
            return self.client.get(path, headers=HEADERS)

    def test_unverified_gsb_email_is_rejected(self):
        resp = self._get(_decoded("baskasi@gsb.gov.tr", False))
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["detail"], EMAIL_NOT_VERIFIED_DETAIL)

    def test_unverified_other_email_is_rejected(self):
        self.assertEqual(self._get(_decoded("hacker@gmail.com", False)).status_code, 403)

    def test_missing_claim_is_treated_as_unverified(self):
        self.assertEqual(self._get({"uid": "u1", "email": "x@gsb.gov.tr"}).status_code, 403)

    def test_verified_user_passes_auth(self):
        resp = self._get(_decoded("mufettis@gsb.gov.tr", True))
        self.assertNotIn(resp.status_code, (401, 403))

    def test_unverified_chat_websocket_rejected(self):
        with patch("firebase_admin.auth.verify_id_token", return_value=_decoded("baskasi@gsb.gov.tr", False)):
            with self.assertRaises(WebSocketDisconnect):
                with self.client.websocket_connect("/ws?token=t&room_id=genel") as ws:
                    ws.receive_text()

    def test_unverified_notification_websocket_rejected(self):
        d = _decoded("baskasi@gsb.gov.tr", False)
        with patch("firebase_admin.auth.verify_id_token", return_value=d):
            with self.assertRaises(WebSocketDisconnect):
                with self.client.websocket_connect(f"/api/notifications/ws/{d['uid']}?token=t") as ws:
                    ws.receive_text()


if __name__ == "__main__":
    unittest.main()
