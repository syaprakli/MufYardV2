import asyncio
import base64
import inspect
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_sec_test_")
os.environ["DATA_DIR"] = _TEST_DATA_DIR
os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"] = os.path.join(_TEST_DATA_DIR, "missing-firebase.json")
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
os.environ["MUFYARD_SIGNING_SECRET"] = "unit-test-signing-secret-0123456789abcdef"

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from app.main import app  # noqa: E402
from app.lib.auth import get_current_user  # noqa: E402
from app.lib.folder_manager import BASE_REPORTS_DIR, FolderManager  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.lib.security import create_signed_token, verify_signed_token  # noqa: E402
from app.routers import files as files_router  # noqa: E402
from app.schemas.profile import PRIVILEGED_PROFILE_FIELDS, ProfileSelfUpdate  # noqa: E402
from app.services.legislation_crawler import LegislationCrawlerService  # noqa: E402
from app.services.profile_service import ProfileService  # noqa: E402


class SecurityFixesTestCase(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        limiter.enabled = False
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.clear()
        limiter.enabled = True

    # 1. Debug endpoint removal (#4)
    def test_debug_logs_endpoint_removed(self):
        resp = self.client.get("/api/debug/logs?key=antigravity")
        self.assertEqual(resp.status_code, 404)

    # 2. Privilege escalation via PATCH /api/profiles/{uid} (#2)
    def test_profile_privileged_fields_blocked_for_regular_user(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "user_regular",
            "email": "user@example.com",
            "email_verified": True,
            "role": "user",
        }
        for payload in [
            {"has_premium_ai": True},
            {"premium_type": "Sınırsız", "premium_until": "2099-01-01"},
            {"verified": True},
            {"two_factor_enabled": False},
            {"role": "admin"},
        ]:
            with self.subTest(payload=payload):
                with patch.object(ProfileService, "update_profile", new_callable=AsyncMock) as mock_update:
                    resp = self.client.patch("/api/profiles/user_regular", json=payload)
                    self.assertEqual(resp.status_code, 403)
                    mock_update.assert_not_awaited()

    def test_profile_self_update_allows_safe_fields(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "user_regular",
            "email": "user@example.com",
            "email_verified": True,
            "role": "user",
        }
        fake_profile = {
            "uid": "user_regular",
            "full_name": "Deneme Müfettiş",
            "title": "Müfettiş",
            "institution": "GSB",
            "email": "user@example.com",
            "emails": ["user@example.com"],
            "theme": "dark",
            "ai_enabled": True,
            "has_premium_ai": False,
            "notifications_enabled": True,
            "role": "user",
            "two_factor_enabled": False,
            "verified": False,
            "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-01T00:00:00",
        }
        with patch.object(ProfileService, "update_profile", new=AsyncMock(return_value=fake_profile)) as mock_update:
            resp = self.client.patch("/api/profiles/user_regular", json={"full_name": "Deneme Müfettiş", "theme": "dark"})
            self.assertEqual(resp.status_code, 200)
            mock_update.assert_awaited_once()
            _, kwargs = mock_update.call_args
            self.assertFalse(kwargs.get("allow_privileged"))
            for priv_field in PRIVILEGED_PROFILE_FIELDS:
                self.assertNotIn(priv_field, ProfileSelfUpdate.model_fields)

    # 3. Unauthenticated static routes, signed URLs, IS_DESKTOP bypass, path traversal (#5, #11, #12)
    def test_static_routes_require_authentication(self):
        for route in [
            "/uploads/profiles/u1/avatar.png",
            "/Raporlar/2026/gizli.pdf",
            "/Mevzuat/genel.pdf",
            "/Diğer İşlem ve Belgeler/belge.docx",
        ]:
            with self.subTest(route=route):
                resp = self.client.get(route)
                self.assertEqual(resp.status_code, 401)

    def test_signed_file_token_serves_file_and_rejects_tamper(self):
        report_dir = Path(BASE_REPORTS_DIR) / "2026"
        report_dir.mkdir(parents=True, exist_ok=True)
        target_file = report_dir / "rapor.txt"
        target_file.write_text("gizli icerik", encoding="utf-8")

        signed_url = files_router._build_signed_file_url("Raporlar", "2026/rapor.txt")
        resp_ok = self.client.get(signed_url)
        self.assertEqual(resp_ok.status_code, 200)
        self.assertEqual(resp_ok.text, "gizli icerik")

        resp_bad = self.client.get("/Raporlar/2026/rapor.txt?dl_token=tampered.token")
        self.assertEqual(resp_bad.status_code, 401)

        other_signed = files_router._build_signed_file_url("Raporlar", "2026/baska.txt")
        other_token = other_signed.split("dl_token=")[1]
        resp_mismatch = self.client.get(f"/Raporlar/2026/rapor.txt?dl_token={other_token}")
        self.assertEqual(resp_mismatch.status_code, 401)

    def test_is_desktop_does_not_bypass_permissions_and_share_checks_source(self):
        owner_dir = Path(BASE_REPORTS_DIR) / "2026"
        owner_dir.mkdir(parents=True, exist_ok=True)
        secret_file = owner_dir / "kurum_gizli.txt"
        secret_file.write_text("gizli veri", encoding="utf-8")
        FolderManager.set_permission(
            file_id="2026/kurum_gizli.txt",
            owner_id="owner_uid",
            allowed_users=["owner_uid"],
            permissions={"read": ["owner_uid"], "write": ["owner_uid"], "delete": ["owner_uid"]},
        )

        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "stranger_uid",
            "email": "stranger@example.com",
            "email_verified": True,
            "role": "user",
        }
        with patch.object(files_router, "IS_DESKTOP", True):
            self.assertEqual(
                self.client.get("/Raporlar/2026/kurum_gizli.txt", headers={"X-User-Id": "stranger_uid"}).status_code,
                403,
            )
            self.assertEqual(self.client.delete("/api/files/delete-item/2026/kurum_gizli.txt").status_code, 403)
            self.assertEqual(
                self.client.post(
                    "/api/files/share-to-user",
                    json={"file_id": "2026/kurum_gizli.txt", "recipient_id": "stranger_uid"},
                ).status_code,
                403,
            )

    def test_commonpath_blocks_sibling_prefix_and_traversal(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "user_a",
            "email": "a@example.com",
            "email_verified": True,
            "role": "user",
        }
        with self.assertRaises(Exception):
            files_router._resolve_safe_path(BASE_REPORTS_DIR, "../Raporlar2/secret.txt")
        with self.assertRaises(Exception):
            files_router._resolve_safe_path(BASE_REPORTS_DIR, "../../etc/passwd")

        resp = self.client.post("/api/files/create-folder", json={"parentId": "../Raporlar2", "name": "hack"})
        self.assertEqual(resp.status_code, 400)

    def test_make_public_removed_from_storage_uploads(self):
        files_src = Path(files_router.__file__).read_text(encoding="utf-8")
        self.assertNotIn("make_public", files_src)
        leg_src = (BACKEND_ROOT / "app" / "services" / "legislation_service.py").read_text(encoding="utf-8")
        self.assertNotIn("make_public", leg_src)

    # 4. WebSocket DM membership (#6)
    def test_websocket_dm_rejects_outsider_and_allows_participant(self):
        with patch("app.main._authenticate_websocket_identity", new=AsyncMock(return_value=("outsider", "o@ex.com", "O", True))):
            with self.assertRaises(WebSocketDisconnect) as ctx:
                with self.client.websocket_connect("/ws?room_id=dm_userA_userB&token=tok"):
                    pass
            self.assertEqual(ctx.exception.code, 1008)

        with patch("app.main._authenticate_websocket_identity", new=AsyncMock(return_value=("userA", "a@ex.com", "A", True))):
            with self.client.websocket_connect("/ws?room_id=dm_userB_userA&token=tok") as ws:
                presence = json.loads(ws.receive_text())
                self.assertEqual(presence.get("type"), "presence")
                ws.send_text(json.dumps({"type": "ping"}))
                pong = json.loads(ws.receive_text())
                self.assertEqual(pong, {"type": "pong"})

    # 5. Google OAuth signed state (#7)
    def test_oauth_callback_rejects_unsigned_state(self):
        forged_state = base64.urlsafe_b64encode(json.dumps({"uid": "victim_uid"}).encode("utf-8")).decode("utf-8")
        resp = self.client.get(f"/api/calendar/callback?code=fake_code&state={forged_state}")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("error=invalid_state", resp.text)

        valid_token = create_signed_token({"purpose": "google_oauth", "uid": "real_uid", "nonce": "abc"}, ttl_seconds=60)
        parsed = verify_signed_token(valid_token)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["uid"], "real_uid")

    # 6. Founder email_verified + centralized list (#8, #15)
    def test_licenses_founder_requires_verified_email_and_canonical_list(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "f1",
            "email": "sefa.yaprakli@gsb.gov.tr",
            "email_verified": False,
            "role": "admin",
        }
        self.assertEqual(self.client.get("/api/licenses/list").status_code, 403)

        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "f2",
            "email": "yapraklisefa@gmail.com",
            "email_verified": True,
            "role": "admin",
        }
        self.assertEqual(self.client.get("/api/licenses/list").status_code, 403)

        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "f3",
            "email": "sefa.yaprakli@gsb.gov.tr",
            "email_verified": True,
            "role": "admin",
        }
        with patch.object(ProfileService, "get_all_license_keys", new=AsyncMock(return_value=[])):
            self.assertEqual(self.client.get("/api/licenses/list").status_code, 200)

    # 7. SSRF protection in legislation crawler (#9)
    def test_legislation_crawler_blocks_ssrf_urls(self):
        unsafe_urls = [
            "http://169.254.169.254/latest/meta-data/?mevzuat.gov.tr",
            "https://evil.example/mevzuat.gov.tr",
            "https://mevzuat.gov.tr@127.0.0.1/admin",
            "file:///etc/passwd?mevzuat.gov.tr",
        ]
        for bad_url in unsafe_urls:
            with self.subTest(bad_url=bad_url):
                self.assertFalse(LegislationCrawlerService.is_allowed_mevzuat_url(bad_url))
                with patch("app.services.legislation_crawler.httpx.AsyncClient") as mock_client:
                    res = asyncio.run(LegislationCrawlerService.fetch_from_mevzuat_gov_tr(bad_url))
                    self.assertIsNone(res)
                    mock_client.assert_not_called()

        self.assertTrue(LegislationCrawlerService.is_allowed_mevzuat_url("https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5326.pdf"))
        self.assertTrue(LegislationCrawlerService.is_allowed_mevzuat_url("https://mevzuat.gov.tr/"))

    # 8. Cryptographic license key generation (#10) & str(e) leak prevention (#13)
    def test_license_key_uses_secrets(self):
        src = inspect.getsource(ProfileService.generate_license_key)
        self.assertIn("secrets.choice", src)
        self.assertNotIn("random.choices", src)
        key = asyncio.run(ProfileService.generate_license_key(duration_months=1))
        self.assertIsNotNone(key)
        self.assertRegex(key, r"^MUFYARD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")

    def test_internal_exception_details_not_leaked(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "u1",
            "email": "u1@example.com",
            "email_verified": True,
            "role": "user",
        }
        secret_err = RuntimeError("SecretDbPasswordLeak123")
        with patch.object(ProfileService, "activate_premium", new=AsyncMock(side_effect=secret_err)):
            resp = self.client.post("/api/licenses/activate", json={"key": "MUFYARD-1111-2222-3333"})
            self.assertEqual(resp.status_code, 500)
            self.assertNotIn("SecretDbPasswordLeak123", resp.text)

        with patch.object(FolderManager, "check_permission_or_ancestor", side_effect=secret_err):
            resp2 = self.client.delete("/api/files/delete-item/2026/any.txt")
            self.assertEqual(resp2.status_code, 500)
            self.assertNotIn("SecretDbPasswordLeak123", resp2.text)


if __name__ == "__main__":
    unittest.main()
