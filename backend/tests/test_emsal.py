"""Emsal arama: yalnızca erişilebilen denetimler, Türkçe normalleştirme, tenkitler, eski uçlar."""
import unittest
from unittest.mock import AsyncMock, patch

from tests.test_tenkitler import FakeDB, _Query  # ortam değişkenlerini de ayarlar

from fastapi.testclient import TestClient  # noqa: E402

from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.services import emsal_service  # noqa: E402


class _InQuery(_Query):
    def where(self, field, op, value):
        if op == "in":
            q = _InQuery(self.store, self.coll, self.filters)
            q.in_filter = (field, set(value))
            return q
        return _InQuery(self.store, self.coll, self.filters + ((field, value),))

    def stream(self):
        f = getattr(self, "in_filter", None)
        for snap in super().stream():
            if f is None or snap.to_dict().get(f[0]) in f[1]:
                yield snap


class InDB(FakeDB):
    def collection(self, name):
        base = super().collection(name)
        db = self

        class _Coll(_InQuery):
            def document(self, doc_id=None):
                return base.document(doc_id)

        return _Coll(db.store, name)


AUDITS = {
    "a1": {"title": "Van GSİM 2024 Denetimi", "owner_id": "u1", "task_id": "t1", "date": "2024-04-01",
           "report_content": "<p>Kantin <b>işletmesi</b> ihalesiz olarak verilmiştir. Kira bedeli tahsil edilmemiştir.</p>"},
    "a2": {"title": "Muş Spor Kulübü", "owner_id": "u1", "task_id": "t2", "date": "2025-02-01",
           "report_content": "<p>Kulübün kantin geliri kayıtlara alınmamıştır.</p>"},
    "gizli": {"title": "Başkasının raporu", "owner_id": "u2", "task_id": "t1",
              "report_content": "<p>Kantin işletmesi gizli bilgi TC 10000000146</p>"},
}
TASKS = {"t1": {"rapor_turu": "İl Denetimi", "rapor_adi": "Van Gençlik ve Spor İl Müdürlüğü"},
         "t2": {"rapor_turu": "Spor Kulüpleri Denetimi", "rapor_adi": "Muşspor"}}
TENKITLER = {
    "k1": {"audit_id": "a1", "baslik": "Kantin kira bedeli tahsil edilmemiş", "durum": "giderilmedi",
           "birim_cevabi": "İcra takibi başlatıldı", "dayanak": "2886 s.K."},
    "k2": {"audit_id": "gizli", "baslik": "Kantin gizli tenkit", "durum": "acik"},
}


def _erisilen(uid, email=None):
    return [{**{k: v for k, v in a.items() if k != "report_content"}, "id": i}
            for i, a in AUDITS.items() if a["owner_id"] == uid]


class EmsalTests(unittest.TestCase):
    def setUp(self):
        limiter.enabled = False
        emsal_service.onbellegi_temizle()
        self.db = InDB()
        for coll, data in (("audits", AUDITS), ("tasks", TASKS), ("tenkitler", TENKITLER)):
            for i, d in data.items():
                self.db.store.setdefault(coll, {})[i] = dict(d)
        self.patches = [
            patch.object(emsal_service, "db", self.db),
            patch("app.services.audit_service.AuditService.get_all_audits", new=AsyncMock(side_effect=_erisilen)),
        ]
        for p in self.patches:
            p.start()
        app.dependency_overrides[get_current_user] = lambda: {"uid": "u1", "email": "u1@gsb.gov.tr", "email_verified": True, "role": "user"}
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.dependency_overrides.clear()
        limiter.enabled = True
        emsal_service.onbellegi_temizle()

    def ara(self, q, **kw):
        r = self.client.get("/api/search/emsal", params={"q": q, **kw})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_only_accessible_audits_and_tenkits(self):
        s = self.ara("kantin")
        self.assertEqual({r["audit_id"] for r in s["raporlar"]}, {"a1", "a2"})
        self.assertEqual([t["id"] for t in s["tenkitler"]], ["k1"])
        self.assertNotIn("gizli", str(s))
        # Eski uçlar da artık sızdırmıyor
        eski = self.client.get("/api/search/search-reports", params={"q": "gizli"}).json()
        self.assertEqual(eski["results"], [])
        self.assertEqual(self.client.get("/api/search/reports", params={"q": "gizli"}).json(), [])

    def test_turkish_normalization_multi_term_and_phrase(self):
        self.assertEqual([r["audit_id"] for r in self.ara("İŞLETMESİ")["raporlar"]], ["a1"])
        self.assertEqual([r["audit_id"] for r in self.ara("kantin ihalesiz")["raporlar"]], ["a1"])  # AND
        self.assertEqual(self.ara("kantin yokkelime")["raporlar"], [])
        self.assertEqual([r["audit_id"] for r in self.ara('"kira bedeli"')["raporlar"]], ["a1"])
        self.assertEqual(self.ara('"bedeli kira"')["raporlar"], [])

    def test_snippet_html_stripped_and_tenkit_fields(self):
        r = self.ara("ihalesiz")["raporlar"][0]
        self.assertNotIn("<", r["ozet"])
        self.assertIn("ihalesiz", r["ozet"])
        self.assertEqual(r["birim"], "Van Gençlik ve Spor İl Müdürlüğü")
        t = self.ara("icra")["tenkitler"][0]  # birim cevabında geçiyor
        self.assertEqual((t["id"], t["durum"], t["denetim_basligi"], t["rapor_turu"]),
                         ("k1", "giderilmedi", "Van GSİM 2024 Denetimi", "İl Denetimi"))

    def test_report_type_filter_and_validation(self):
        s = self.ara("kantin", rapor_turu="Spor Kulüpleri Denetimi")
        self.assertEqual([r["audit_id"] for r in s["raporlar"]], ["a2"])
        self.assertEqual(s["tenkitler"], [])
        self.assertEqual(self.client.get("/api/search/emsal", params={"q": "k"}).status_code, 422)

    def test_cache_and_refresh(self):
        self.ara("kantin")
        self.db.store["audits"]["a2"]["report_content"] = "<p>yeni ifade sporcu lisansı</p>"
        self.assertEqual(self.ara("lisansı")["raporlar"], [])  # önbellekte eski metin
        self.assertEqual([r["audit_id"] for r in self.ara("lisansı", yenile=True)["raporlar"]], ["a2"])


if __name__ == "__main__":
    unittest.main()
