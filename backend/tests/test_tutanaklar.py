"""Tutanaklar: yetki, kayıt/güncelleme, doğrulama ve boyut sınırı."""
import unittest
from unittest.mock import AsyncMock, patch

from tests.test_tenkitler import AUDITS, FakeDB  # ortam değişkenlerini de ayarlar

from fastapi.testclient import TestClient  # noqa: E402

from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import tutanaklar as tutanak_router  # noqa: E402


class TutanakTests(unittest.TestCase):
    def setUp(self):
        limiter.enabled = False
        self.db = FakeDB()
        self.patches = [
            patch.object(tutanak_router, "db", self.db),
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

    def _ifade(self, **kw):
        body = {"audit_id": "a2026", "tur": "ifade", "tarih": "2026-03-12", "yer": "Van GSİM",
                "kisiler": [{"ad": "Ali Veli", "unvan": "Şube Müdürü", "rol": "ifade_veren", "tckn": "10000000146"}],
                "sorular": [{"soru": "Kimliğiniz?", "cevap": "Ali Veli"}], **kw}
        return self.client.post("/api/tutanaklar/", json=body)

    def test_create_list_update(self):
        r = self._ifade()
        self.assertEqual(r.status_code, 200, r.text)
        t = r.json()
        self.assertEqual(t["kisiler"][0]["rol"], "ifade_veren")
        self.assertFalse(t["tamamlandi"])
        u = self.client.patch(f"/api/tutanaklar/{t['id']}", json={
            "sorular": [{"soru": "Kimliğiniz?", "cevap": "Ali Veli"}, {"soru": "İddia?", "cevap": "Kabul etmiyorum"}],
            "tamamlandi": True})
        self.assertEqual(u.status_code, 200, u.text)
        self.assertEqual(len(u.json()["sorular"]), 2)
        self.assertTrue(u.json()["tamamlandi"])
        self.assertEqual(u.json()["yer"], "Van GSİM")  # gönderilmeyen alan korunur
        lst = self.client.get("/api/tutanaklar/?audit_id=a2026").json()
        self.assertEqual([x["id"] for x in lst], [t["id"]])

    def test_screen_default_payloads_are_accepted(self):
        """Ekranın 'yeni tutanak' anında gönderdiği gövde (Tutanaklar.tsx yeniTutanak) birebir kabul edilmeli.
        Gerçek hata: yeni ifadede 'İfade veren' adı boş olduğu için sunucu 422 veriyordu."""
        mufettis = {"ad": "", "unvan": "Müfettiş", "rol": "mufettis"}  # profil adı yoksa boş gelir
        for tur in ("ifade", "tespit", "gorusme"):
            body = {
                "audit_id": "a2026", "tur": tur, "tarih": "2026-11-24", "saat": "10:25", "yer": "", "konu": "",
                "kisiler": ([{"ad": "", "unvan": "", "rol": "ifade_veren"}] if tur == "ifade" else []) + [mufettis],
                "sorular": [{"soru": "Kimlik bilgileriniz?", "cevap": ""}] if tur == "ifade" else [],
                "metin": "", "kapanis": "Kapanış", "tamamlandi": False,
            }
            r = self.client.post("/api/tutanaklar/", json=body)
            self.assertEqual(r.status_code, 200, f"{tur}: {r.text}")
            # Düzenleme sırasında ara durumlar da kaydedilebilmeli (boş satır, kısmi TC)
            u = self.client.patch(f"/api/tutanaklar/{r.json()['id']}", json={
                "kisiler": [{"ad": "", "unvan": "", "rol": "katilan", "tckn": "1000"}], "tarih": "", "saat": ""})
            self.assertEqual(u.status_code, 200, f"{tur}: {u.text}")

    def test_permissions(self):
        self.as_user("yabanci")
        self.assertEqual(self.client.get("/api/tutanaklar/?audit_id=a2026").status_code, 403)
        self.assertEqual(self._ifade().status_code, 403)
        self.as_user("diger")
        t = self.client.post("/api/tutanaklar/", json={"audit_id": "paylasilan", "tur": "tespit", "metin": "x"}).json()
        self.as_user("mufettis")  # paylaşılan denetimde yalnızca görüntüleme yetkisi
        self.assertEqual(self.client.get("/api/tutanaklar/?audit_id=paylasilan").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tutanaklar/{t['id']}", json={"metin": "y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/tutanaklar/{t['id']}").status_code, 403)
        self.as_user("diger")
        self.assertEqual(self.client.delete(f"/api/tutanaklar/{t['id']}").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tutanaklar/{t['id']}", json={"metin": "y"}).status_code, 404)

    def test_validation_and_size_limit(self):
        self.assertEqual(self._ifade(tur="sorgu").status_code, 422)
        self.assertEqual(self._ifade(kisiler=[{"ad": "A", "tckn": "12ab"}]).status_code, 422)
        self.assertEqual(self._ifade(audit_id="yok").status_code, 404)
        # Belge 1 MiB sınırına yaklaşırsa anlaşılır hata
        uzun = [{"soru": "s", "cevap": "ç" * 19000} for _ in range(30)]
        self.assertEqual(self._ifade(sorular=uzun).status_code, 413)


if __name__ == "__main__":
    unittest.main()
