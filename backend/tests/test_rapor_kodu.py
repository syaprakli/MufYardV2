"""Rapor kodu üretiminin tekrar eden numara vermediğini doğrular."""
import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_rk_test_")
os.environ.setdefault("DATA_DIR", _TEST_DATA_DIR)
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_JSON", "")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT_PATH", os.path.join(_TEST_DATA_DIR, "missing-firebase.json"))
os.environ.setdefault("FIREBASE_PRIVATE_KEY", "")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import task_service  # noqa: E402
from app.services.task_service import TaskService  # noqa: E402


class RaporKoduTests(unittest.TestCase):
    def setUp(self):
        task_service._recently_issued_codes.clear()

    def _with_codes(self, codes, coro):
        async def fake_fetch(prefix):
            await asyncio.sleep(0)  # gerçek sorgu gibi kontrolü event loop'a bırak
            return [c for c in codes if c.startswith(prefix)]
        with patch.object(TaskService, "_fetch_codes_with_prefix", side_effect=fake_fetch):
            return asyncio.run(coro)

    def test_more_than_1000_tasks_no_duplicate(self):
        codes = [f"S.Y.64/2026-{i}" for i in range(1, 1501)]
        code = self._with_codes(codes, TaskService._generate_rapor_kodu(2026))
        self.assertEqual(code, "S.Y.64/2026-1501")

    def test_gap_filling_and_year_isolation(self):
        codes = ["S.Y.64/2026-1", "S.Y.64/2026-3", "S.Y.64/2025-2", "TASLAK-2026-1", "S.Y.64/2026-x"]
        self.assertEqual(self._with_codes(codes, TaskService._generate_rapor_kodu(2026)), "S.Y.64/2026-2")
        task_service._recently_issued_codes.clear()
        self.assertEqual(self._with_codes(codes, TaskService._generate_draft_rapor_kodu(2026)), "TASLAK-2026-2")

    def test_concurrent_generation_gives_unique_codes(self):
        async def many():
            return await asyncio.gather(*(TaskService._generate_rapor_kodu(2026) for _ in range(10)))
        codes = self._with_codes(["S.Y.64/2026-1"], many())
        self.assertEqual(len(set(codes)), 10, codes)
        self.assertNotIn("S.Y.64/2026-1", codes)

    def test_query_error_raises_instead_of_returning_1(self):
        async def boom(prefix):
            raise RuntimeError("firestore down")
        with patch.object(TaskService, "_fetch_codes_with_prefix", side_effect=boom):
            with self.assertRaises(RuntimeError):
                asyncio.run(TaskService._generate_rapor_kodu(2026))


if __name__ == "__main__":
    unittest.main()
