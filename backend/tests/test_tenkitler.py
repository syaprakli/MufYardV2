"""Tenkit takibi: yetki, toplu aktarım, durum geçmişi ve önceki denetimlerin eşleştirilmesi."""
import itertools
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_tenkit_test_")
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
from app.routers import tenkitler as tenkit_router  # noqa: E402
from app.services import tenkit_service  # noqa: E402
from app.services.tenkit_service import birim_anahtari  # noqa: E402

_ids = itertools.count(1)


class _Doc:
    def __init__(self, store, coll, doc_id):
        self.store, self.coll, self.id = store, coll, doc_id

    def get(self):
        data = self.store.setdefault(self.coll, {}).get(self.id)
        return _Snap(self.id, data)

    def set(self, data):
        self.store.setdefault(self.coll, {})[self.id] = dict(data)

    def update(self, changes):
        self.store[self.coll][self.id].update(changes)

    def delete(self):
        self.store.get(self.coll, {}).pop(self.id, None)


class _Snap:
    def __init__(self, doc_id, data):
        self.id, self._data, self.exists = doc_id, data, data is not None

    def to_dict(self):
        return dict(self._data or {})


class _Query:
    def __init__(self, store, coll, filters=()):
        self.store, self.coll, self.filters = store, coll, filters

    def where(self, field, op, value):
        assert op == "=="
        return _Query(self.store, self.coll, self.filters + ((field, value),))

    def limit(self, _n):
        return self

    def stream(self):
        for doc_id, data in list(self.store.get(self.coll, {}).items()):
            if all(data.get(f) == v for f, v in self.filters):
                yield _Snap(doc_id, data)


class FakeDB:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        db = self

        class _Coll(_Query):
            def document(self, doc_id=None):
                return _Doc(db.store, name, doc_id or f"auto{next(_ids)}")

        return _Coll(self.store, name)


AUDITS = {
    "a2026": {"id": "a2026", "task_id": "t2026", "owner_id": "mufettis", "title": "Van 2026", "date": "2026-03-01"},
    "a2024": {"id": "a2024", "task_id": "t2024", "owner_id": "mufettis", "title": "Van 2024", "date": "2024-04-01"},
    "baskasi": {"id": "baskasi", "task_id": "t2023", "owner_id": "diger", "title": "Van 2023", "date": "2023-01-01"},
    "paylasilan": {"id": "paylasilan", "task_id": "t2026", "owner_id": "diger", "shared_roles": {"mufettis": "view"}},
}
TASKS = {
    "t2026": {"rapor_turu": "İl Denetimi", "rapor_adi": "Van Gençlik ve Spor İl Müdürlüğü"},
    "t2024": {"rapor_turu": "İl Denetimi", "rapor_adi": "VAN GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ "},
    "t2023": {"rapor_turu": "İl Denetimi", "rapor_adi": "Van Gençlik ve Spor İl Müdürlüğü"},
}


class TenkitTests(unittest.TestCase):
    def setUp(self):
        limiter.enabled = False
        self.db = FakeDB()
        for tid, t in TASKS.items():
            self.db.store.setdefault("tasks", {})[tid] = dict(t)
        self.patches = [
            patch.object(tenkit_service, "db", self.db),
            patch.object(tenkit_router, "db", self.db),
            patch("app.services.audit_service.AuditService.get_audit",
                  new=AsyncMock(side_effect=lambda aid: dict(AUDITS[aid]) if aid in AUDITS else None)),
        ]
        for p in self.patches:
            p.start()
        self.as_user("mufettis")
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.dependency_overrides.clear()
        limiter.enabled = True

    def as_user(self, uid, role="user"):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": uid, "email": f"{uid}@gsb.gov.tr", "email_verified": True, "role": role}

    def test_birim_anahtari_ignores_case_turkish_chars_and_spaces(self):
        self.assertEqual(birim_anahtari("İl Denetimi", "Van Gençlik ve Spor İl Müdürlüğü"),
                         birim_anahtari("il denetimi", "  VAN GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ "))
        self.assertNotEqual(birim_anahtari("İl Denetimi", "Van"), birim_anahtari("İl Denetimi", "Muş"))

    def test_create_list_update_with_history(self):
        r = self.client.post("/api/tenkitler/", json={"audit_id": "a2026", "baslik": "Hakem kursu açılmamış", "onem": "kritik"})
        self.assertEqual(r.status_code, 200, r.text)
        t = r.json()
        self.assertEqual(t["durum"], "acik")
        self.assertEqual(t["birim_adi"], "Van Gençlik ve Spor İl Müdürlüğü")
        u = self.client.patch(f"/api/tenkitler/{t['id']}", json={"durum": "giderildi", "birim_cevabi": "Kurs açıldı", "cevap_tarihi": "2026-05-01"})
        self.assertEqual(u.status_code, 200, u.text)
        body = u.json()
        self.assertEqual(body["durum"], "giderildi")
        self.assertEqual([g["durum"] for g in body["gecmis"]], ["acik", "giderildi"])
        lst = self.client.get("/api/tenkitler/?audit_id=a2026").json()
        self.assertEqual(len(lst), 1)

    def test_bulk_import_skips_duplicates(self):
        items = [{"baslik": "Madde 5", "kaynak": "kontrol_listesi", "kaynak_ref": "il_q5"},
                 {"baslik": "Madde 7", "kaynak": "kontrol_listesi", "kaynak_ref": "il_q7"}]
        first = self.client.post("/api/tenkitler/aktar", json={"audit_id": "a2026", "items": items}).json()
        second = self.client.post("/api/tenkitler/aktar", json={"audit_id": "a2026", "items": items + [
            {"baslik": "Madde 9", "kaynak": "kontrol_listesi", "kaynak_ref": "il_q9"}]}).json()
        self.assertEqual((first["eklenen"], first["atlanan"]), (2, 0))
        self.assertEqual((second["eklenen"], second["atlanan"]), (1, 2))

    def test_permissions(self):
        # Yabancı: göremez, ekleyemez
        self.as_user("yabanci")
        self.assertEqual(self.client.get("/api/tenkitler/?audit_id=a2026").status_code, 403)
        self.assertEqual(self.client.post("/api/tenkitler/", json={"audit_id": "a2026", "baslik": "x"}).status_code, 403)
        # Görüntüleme rolü: görür ama değiştiremez
        self.as_user("diger")
        t = self.client.post("/api/tenkitler/", json={"audit_id": "paylasilan", "baslik": "x"}).json()
        self.as_user("mufettis")
        self.assertEqual(self.client.get("/api/tenkitler/?audit_id=paylasilan").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tenkitler/{t['id']}", json={"durum": "giderildi"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/tenkitler/{t['id']}").status_code, 403)
        # Admin her denetimde düzenleyebilir
        self.as_user("yonetici", role="admin")
        self.assertEqual(self.client.patch(f"/api/tenkitler/{t['id']}", json={"durum": "giderildi"}).status_code, 200)

    def test_onceki_shows_same_unit_from_accessible_audits_only(self):
        self.client.post("/api/tenkitler/", json={"audit_id": "a2024", "baslik": "2024 tenkiti"})
        self.client.post("/api/tenkitler/", json={"audit_id": "a2026", "baslik": "2026 tenkiti"})
        self.as_user("diger")
        self.client.post("/api/tenkitler/", json={"audit_id": "baskasi", "baslik": "Başka müfettişin tenkiti"})
        self.as_user("mufettis")
        r = self.client.get("/api/tenkitler/onceki?audit_id=a2026").json()
        basliklar = [t["baslik"] for t in r["tenkitler"]]
        self.assertEqual(basliklar, ["2024 tenkiti"])  # kendi denetimi hariç, erişilemeyen hariç
        self.assertEqual(r["tenkitler"][0]["denetim_basligi"], "Van 2024")

    def test_unknown_audit_and_tenkit(self):
        self.assertEqual(self.client.get("/api/tenkitler/?audit_id=yok").status_code, 404)
        self.assertEqual(self.client.patch("/api/tenkitler/yok", json={"durum": "acik"}).status_code, 404)
        self.assertEqual(self.client.patch("/api/tenkitler/x", json={"durum": "bilinmeyen"}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
