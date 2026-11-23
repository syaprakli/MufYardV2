"""Devre dışı / oturumu iptal edilmiş hesapların ve rol değişikliklerinin hızla etkili olduğunu doğrular."""
import asyncio
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_acct_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402
from firebase_admin import auth as firebase_auth  # noqa: E402

from app.lib import auth  # noqa: E402
from app.lib.auth import ACCOUNT_INACTIVE_DETAIL, invalidate_user_cache, is_account_active  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402

NOW = int(time.time())


def _user(disabled=False, valid_after_s=0):
    return SimpleNamespace(disabled=disabled, tokens_valid_after_timestamp=valid_after_s * 1000)


class AccountStatusTests(unittest.TestCase):
    def setUp(self):
        invalidate_user_cache()
        self.mock_patch = patch.object(auth, "is_mock", False)
        self.mock_patch.start()

    def tearDown(self):
        self.mock_patch.stop()
        invalidate_user_cache()

    def _active(self, decoded, user=None, side_effect=None):
        kw = {"side_effect": side_effect} if side_effect else {"return_value": user}
        with patch.object(firebase_auth, "get_user", **kw) as gu:
            result = asyncio.run(is_account_active(decoded))
        return result, gu

    def test_active_user(self):
        ok, _ = self._active({"uid": "u", "iat": NOW}, _user())
        self.assertTrue(ok)

    def test_disabled_user_rejected(self):
        ok, _ = self._active({"uid": "u", "iat": NOW}, _user(disabled=True))
        self.assertFalse(ok)

    def test_token_issued_before_revocation_rejected(self):
        ok, _ = self._active({"uid": "u", "iat": NOW - 600}, _user(valid_after_s=NOW - 60))
        self.assertFalse(ok)
        invalidate_user_cache()
        ok, _ = self._active({"uid": "u", "iat": NOW}, _user(valid_after_s=NOW - 60))
        self.assertTrue(ok)

    def test_deleted_user_rejected(self):
        ok, _ = self._active({"uid": "u", "iat": NOW}, side_effect=firebase_auth.UserNotFoundError("yok"))
        self.assertFalse(ok)

    def test_auth_outage_fails_open_and_is_not_cached(self):
        ok, _ = self._active({"uid": "u", "iat": NOW}, side_effect=RuntimeError("ağ hatası"))
        self.assertTrue(ok)
        self.assertNotIn("u", auth._STATUS_CACHE)

    def test_status_is_cached(self):
        with patch.object(firebase_auth, "get_user", return_value=_user()) as gu:
            for _ in range(20):
                asyncio.run(is_account_active({"uid": "u", "iat": NOW}))
        self.assertEqual(gu.call_count, 1)

    def test_role_cache_ttl_is_short_and_invalidation_works(self):
        self.assertLessEqual(auth._CACHE_TTL, 60)
        auth._ROLE_CACHE["u"] = ("admin", time.monotonic())
        invalidate_user_cache("u")
        self.assertNotIn("u", auth._ROLE_CACHE)


class AccountStatusEndpointTests(unittest.TestCase):
    def setUp(self):
        invalidate_user_cache()
        limiter.enabled = False
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        limiter.enabled = True
        invalidate_user_cache()

    def test_disabled_account_gets_401_on_api(self):
        decoded = {"uid": "u1", "email": "u1@gsb.gov.tr", "email_verified": True, "iat": NOW}
        with patch.object(auth, "is_mock", False), \
             patch("firebase_admin.auth.verify_id_token", return_value=decoded), \
             patch.object(firebase_auth, "get_user", return_value=_user(disabled=True)), \
             patch("app.lib.auth._get_role_for_uid", new=AsyncMock(return_value="user")):
            resp = self.client.get("/api/contacts/?category=corporate", headers={"Authorization": "Bearer a.b.c"})
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()["detail"], ACCOUNT_INACTIVE_DETAIL)


if __name__ == "__main__":
    unittest.main()
