"""İstek gövdesi boyut sınırının yüklemeleri belleğe alınmadan reddettiğini doğrular."""
import os
import sys
import tempfile
import unittest
from pathlib import Path

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_body_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi import FastAPI, File, UploadFile  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.lib.body_limit import BodySizeLimitMiddleware  # noqa: E402
from app.main import app as main_app  # noqa: E402


def _make_app(limit=1000, path_limits=(("/big", 5000),)):
    app = FastAPI()
    app.state.handler_calls = 0

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        app.state.handler_calls += 1
        return {"size": len(await file.read())}

    @app.post("/big")
    async def big(file: UploadFile = File(...)):
        return {"size": len(await file.read())}

    @app.post("/raw")
    async def raw(payload: dict):
        return {"ok": True}

    app.add_middleware(BodySizeLimitMiddleware, max_body_bytes=limit, path_limits=path_limits)
    return app


class BodyLimitTests(unittest.TestCase):
    def setUp(self):
        self.app = _make_app()
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def test_small_upload_passes(self):
        resp = self.client.post("/upload", files={"file": ("a.txt", b"x" * 100)})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["size"], 100)

    def test_large_upload_rejected_before_handler(self):
        resp = self.client.post("/upload", files={"file": ("a.txt", b"x" * 5000)})
        self.assertEqual(resp.status_code, 413)
        self.assertEqual(self.app.state.handler_calls, 0)

    def test_lying_content_length_is_caught_while_streaming(self):
        def gen():
            for _ in range(20):
                yield b"y" * 200
        resp = self.client.post("/raw", content=gen(), headers={"content-type": "application/json"})
        self.assertEqual(resp.status_code, 413)

    def test_path_specific_limit(self):
        self.assertEqual(self.client.post("/big", files={"file": ("a", b"x" * 3000)}).status_code, 200)
        self.assertEqual(self.client.post("/big", files={"file": ("a", b"x" * 6000)}).status_code, 413)

    def test_main_app_has_middleware_and_get_requests_unaffected(self):
        self.assertTrue(any(m.cls is BodySizeLimitMiddleware for m in main_app.user_middleware))
        self.assertEqual(TestClient(main_app).get("/health").status_code, 200)


if __name__ == "__main__":
    unittest.main()
