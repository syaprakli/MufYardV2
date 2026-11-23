"""Event loop'u bloklayan kalıpların geri gelmediğini ve ses deşifresinin async çalıştığını doğrular."""
import ast
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_loop_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402

APP_DIR = BACKEND_ROOT / "app"


def _py_files():
    return [p for p in APP_DIR.rglob("*.py") if "__pycache__" not in p.parts]


class StaticPatternTests(unittest.TestCase):
    def test_no_lazy_stream_inside_to_thread(self):
        # to_thread(q.stream) ve to_thread(lambda: q.stream()) yalnızca generator döndürür;
        # Firestore ağ trafiği yine event loop'ta yapılır. Sonuç thread içinde list() ile alınmalı.
        def is_stream_call(node):
            return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "stream"

        offenders = []
        for p in _py_files():
            for n in ast.walk(ast.parse(p.read_text(encoding="utf-8"))):
                if not (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "to_thread" and n.args):
                    continue
                target = n.args[0]
                if isinstance(target, ast.Attribute) and target.attr == "stream":
                    offenders.append(f"{p.name}:{n.lineno}")
                elif isinstance(target, ast.Lambda) and is_stream_call(target.body):
                    offenders.append(f"{p.name}:{n.lineno}")
        self.assertEqual(offenders, [])

    def test_no_js_style_trim(self):
        offenders = [f"{p.name}:{i}" for p in _py_files()
                     for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1) if ".trim()" in line]
        self.assertEqual(offenders, [])

    def test_no_sync_firestore_or_gemini_calls_directly_in_async_routes(self):
        # Doğrudan async fonksiyon gövdesinde (iç içe sync fonksiyonlar hariç) senkron ağ çağrısı olmamalı.
        risky = (".stream()", ").get()", ".commit()", "generate_content(", "upload_file(")
        offenders = []
        for p in _py_files():
            src = p.read_text(encoding="utf-8")
            lines = src.splitlines()

            def walk(node):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                    return
                yield node
                for c in ast.iter_child_nodes(node):
                    yield from walk(c)

            for fn in ast.walk(ast.parse(src)):
                if not isinstance(fn, ast.AsyncFunctionDef):
                    continue
                for stmt in fn.body:
                    for n in walk(stmt):
                        if isinstance(n, ast.Call):
                            line = lines[n.lineno - 1]
                            seg = ast.get_source_segment(src, n) or ""
                            if "await" in line or "to_thread" in line or "lambda" in line or seg.count("\n") > 2:
                                continue
                            if any(r in seg for r in risky):
                                offenders.append(f"{p.relative_to(APP_DIR)}:{n.lineno}")
        self.assertEqual(sorted(set(offenders)), [])


class TranscribeTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": "u1", "email": "u1@example.com", "email_verified": True, "role": "user"}
        limiter.enabled = False
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        app.dependency_overrides.clear()
        limiter.enabled = True

    def test_transcribe_uses_async_inline_audio(self):
        model = MagicMock()
        model.generate_content_async = AsyncMock(return_value=MagicMock(text="  merhaba dunya "))
        model.generate_content = MagicMock(side_effect=AssertionError("senkron çağrı kullanılmamalı"))
        with patch("app.routers.ai._get_user_ai_settings", new=AsyncMock(return_value=("k", "m", 0.7, "", False))), \
             patch("google.generativeai.GenerativeModel", return_value=model), \
             patch("google.generativeai.configure"), \
             patch("google.generativeai.upload_file", side_effect=AssertionError("dosya yükleme kullanılmamalı")):
            resp = self.client.post("/api/ai/transcribe",
                                    files={"file": ("a.webm", b"\x1a\x45\xdf\xa3fake", "audio/webm;codecs=opus")})
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(resp.json()["text"], "merhaba dunya")
        parts = model.generate_content_async.await_args.args[0]
        self.assertEqual(parts[0]["mime_type"], "audio/webm")
        self.assertEqual(parts[0]["data"], b"\x1a\x45\xdf\xa3fake")

    def test_transcribe_rejects_too_large_and_empty(self):
        with patch("app.routers.ai._get_user_ai_settings", new=AsyncMock(return_value=("k", "m", 0.7, "", False))):
            big = self.client.post("/api/ai/transcribe", files={"file": ("a.webm", b"0" * (20 * 1024 * 1024 + 1), "audio/webm")})
            empty = self.client.post("/api/ai/transcribe", files={"file": ("a.webm", b"", "audio/webm")})
        self.assertEqual(big.status_code, 413)
        self.assertEqual(empty.status_code, 400)


if __name__ == "__main__":
    unittest.main()
