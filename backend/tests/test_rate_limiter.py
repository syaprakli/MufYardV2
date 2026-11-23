"""Rate limit anahtarının kullanıcı bazlı ve X-Forwarded-For sahteciliğine dayanıklı olduğunu doğrular."""
import base64
import json
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from starlette.requests import Request  # noqa: E402

from app.lib.rate_limiter import rate_limit_key  # noqa: E402


def _b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")


def _token(payload) -> str:
    return f"{_b64({'alg': 'RS256'})}.{_b64(payload)}.signature"


def _request(headers=None, client=("10.0.0.9", 1234)) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "method": "GET", "path": "/", "headers": raw, "client": client})


class RateLimitKeyTests(unittest.TestCase):
    def test_authenticated_requests_keyed_by_uid_regardless_of_ip(self):
        tok = _token({"user_id": "uid_123", "sub": "uid_123"})
        a = rate_limit_key(_request({"Authorization": f"Bearer {tok}", "X-Forwarded-For": "1.1.1.1"}))
        b = rate_limit_key(_request({"Authorization": f"Bearer {tok}", "X-Forwarded-For": "2.2.2.2"}))
        self.assertEqual(a, "uid:uid_123")
        self.assertEqual(a, b)

    def test_sub_claim_fallback(self):
        self.assertEqual(rate_limit_key(_request({"Authorization": f"Bearer {_token({'sub': 'u9'})}"})), "uid:u9")

    def test_spoofed_leftmost_forwarded_for_is_ignored(self):
        a = rate_limit_key(_request({"X-Forwarded-For": "6.6.6.6, 203.0.113.5"}))
        b = rate_limit_key(_request({"X-Forwarded-For": "7.7.7.7, 203.0.113.5"}))
        self.assertEqual(a, "ip:203.0.113.5")
        self.assertEqual(a, b)

    def test_malformed_tokens_fall_back_to_ip(self):
        for header in ["Bearer", "Bearer abc", "Bearer a.b.c", "Basic xyz", f"Bearer {_token(['x'])}",
                       f"Bearer {_token({'user_id': 'x' * 500})}"]:
            with self.subTest(header=header):
                self.assertEqual(rate_limit_key(_request({"Authorization": header})), "ip:10.0.0.9")

    def test_no_headers_uses_client_address(self):
        self.assertEqual(rate_limit_key(_request()), "ip:10.0.0.9")


if __name__ == "__main__":
    unittest.main()
