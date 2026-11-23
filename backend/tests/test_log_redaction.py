"""Log satırlarında token'ların gizlendiğini doğrular."""
import logging
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.lib.log_redaction import RedactSecretsFilter, install_log_redaction, redact  # noqa: E402


class LogRedactionTests(unittest.TestCase):
    def test_redacts_ws_and_download_tokens(self):
        self.assertEqual(redact('"WebSocket /ws?token=eyJhbGc.abc.def&name=Ali" [accepted]'),
                         '"WebSocket /ws?token=<redacted>&name=Ali" [accepted]')
        self.assertEqual(redact("GET /uploads/a.jpg?dl_token=AbC.dEf HTTP/1.1"),
                         "GET /uploads/a.jpg?dl_token=<redacted> HTTP/1.1")
        self.assertEqual(redact("GET /api/tasks?page=2 HTTP/1.1"), "GET /api/tasks?page=2 HTTP/1.1")

    def test_filter_on_uvicorn_style_record(self):
        record = logging.LogRecord("uvicorn.error", logging.INFO, __file__, 1,
                                   '%s - "WebSocket %s" [accepted]', ("1.2.3.4:0", "/ws?token=SECRET.X.Y&room_id=g"), None)
        RedactSecretsFilter().filter(record)
        self.assertNotIn("SECRET", record.getMessage())
        self.assertIn("token=<redacted>", record.getMessage())

    def test_installed_on_uvicorn_loggers(self):
        install_log_redaction()
        for name in ("uvicorn.access", "uvicorn.error"):
            self.assertTrue(any(isinstance(f, RedactSecretsFilter) for f in logging.getLogger(name).filters))


if __name__ == "__main__":
    unittest.main()
