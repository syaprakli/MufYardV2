"""Firestore okuma maliyetini düşüren değişiklikleri doğrular: online önbelleği, sürüm sayımı, not sahipleri."""
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_cost_test_")
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
from app.routers import online  # noqa: E402
from app.services import audit_service, note_service  # noqa: E402


def _iso(seconds_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(seconds=seconds_ago)).isoformat()


class _Doc:
    def __init__(self, doc_id, data, exists=True):
        self.id, self._data, self.exists = doc_id, data, exists

    def to_dict(self):
        return dict(self._data)


class FakeOnlineDB:
    def __init__(self, docs):
        self.docs = docs
        self.stream_calls = 0
        self.writes = []
        self.deletes = []

    def collection(self, name):
        db = self

        class _Ref:
            def __init__(self, doc_id):
                self.doc_id = doc_id

            def set(self, data):
                db.writes.append((self.doc_id, data))

            def delete(self):
                db.deletes.append(self.doc_id)

        class _Coll:
            def stream(self):
                db.stream_calls += 1
                return iter([_Doc(k, v) for k, v in db.docs.items()])

            def document(self, doc_id):
                return _Ref(doc_id)

        return _Coll()


class OnlineCacheTests(unittest.TestCase):
    def setUp(self):
        online._reset_cache()
        limiter.enabled = False
        self.fake = FakeOnlineDB({
            "a": {"uid": "a", "name": "A", "last_active": _iso(10)},
            "old": {"uid": "old", "name": "Eski", "last_active": _iso(600)},
        })
        self.patch = patch.object(online, "db", self.fake)
        self.patch.start()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.patch.stop()
        app.dependency_overrides.clear()
        limiter.enabled = True
        online._reset_cache()

    def _as(self, uid):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": uid, "email": f"{uid}@example.com", "email_verified": True, "role": "user"}

    def test_many_list_calls_read_collection_once(self):
        self._as("viewer")
        for _ in range(25):
            resp = self.client.get("/api/online/list")
            self.assertEqual(resp.status_code, 200)
        self.assertEqual(self.fake.stream_calls, 1)
        self.assertEqual([u["uid"] for u in resp.json()], ["a"])  # bayat kayıt listelenmez

    def test_heartbeat_updates_cache_without_rereading(self):
        self._as("viewer")
        self.client.get("/api/online/list")
        self._as("b")
        self.assertEqual(self.client.post("/api/online/set", json={"uid": "b", "name": "B"}).status_code, 200)
        uids = {u["uid"] for u in self.client.get("/api/online/list").json()}
        self.assertEqual(uids, {"a", "b"})
        self.assertEqual(self.fake.stream_calls, 1)

    def test_remove_drops_user_immediately(self):
        self._as("a")
        self.client.get("/api/online/list")
        self.assertEqual(self.client.post("/api/online/remove", json={"uid": "a"}).status_code, 200)
        self.assertEqual(self.client.get("/api/online/list").json(), [])

    def test_cache_expires(self):
        self._as("viewer")
        self.client.get("/api/online/list")
        online._cache_loaded_at -= online.LIST_CACHE_SECONDS + 1
        self.client.get("/api/online/list")
        self.assertEqual(self.fake.stream_calls, 2)

    def test_cannot_set_other_user_returns_403_not_500(self):
        self._as("a")
        self.assertEqual(self.client.post("/api/online/set", json={"uid": "b", "name": "x"}).status_code, 403)
        self.assertEqual(self.client.post("/api/online/remove", json={"uid": "b"}).status_code, 403)


class VersionCountTests(unittest.TestCase):
    def test_uses_count_aggregation_without_reading_documents(self):
        ref = MagicMock()
        ref.count.return_value.get.return_value = [[MagicMock(value=42)]]
        ref.get.side_effect = AssertionError("sürüm belgeleri okunmamalı")
        self.assertEqual(audit_service._count_docs(ref), 42)

    def test_falls_back_when_count_unavailable(self):
        class NoCount:
            def get(self):
                return [1, 2, 3]
        self.assertEqual(audit_service._count_docs(NoCount()), 3)


class NoteOwnerNameTests(unittest.TestCase):
    def test_single_batched_read_for_all_owners(self):
        fake_db = MagicMock()
        fake_db.collection.return_value.document.side_effect = lambda uid: f"ref:{uid}"
        fake_db.get_all.return_value = [
            _Doc("u1", {"full_name": "Ayşe"}), _Doc("u2", {}, exists=False)]
        with patch.object(note_service, "db", fake_db):
            names = note_service._fetch_profile_names(["u1", "u2", "u1", "", "a/b"])
        self.assertEqual(names, {"u1": "Ayşe"})
        self.assertEqual(fake_db.get_all.call_count, 1)
        refs = fake_db.get_all.call_args.args[0]
        self.assertEqual(sorted(refs), ["ref:u1", "ref:u1", "ref:u2"])


if __name__ == "__main__":
    unittest.main()
