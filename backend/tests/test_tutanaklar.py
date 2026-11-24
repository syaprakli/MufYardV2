"""Tutanaklar (inceleme/soruşturma görevleri): görev yetkisi, kayıt, ekran sözleşmesi ve boyut sınırı."""
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.test_tenkitler import FakeDB  # ortam değişkenlerini de ayarlar

from fastapi.testclient import TestClient  # noqa: E402

from app.lib.auth import get_current_user  # noqa: E402
from app.lib.rate_limiter import limiter  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import tutanaklar as tutanak_router  # noqa: E402

TASKS = {
    "inc1": {"rapor_turu": "İnceleme", "rapor_adi": "X Belediyesi şikâyeti", "owner_id": "mufettis"},
    "sor1": {"rapor_turu": "Soruşturma", "rapor_adi": "Y hakkında", "owner_id": "diger",
             "shared_with": ["ortak@gsb.gov.tr"], "assigned_to": [], "accepted_collaborators": []},
}


class TutanakTests(unittest.TestCase):
    def setUp(self):
        limiter.enabled = False
        self.db = FakeDB()
        for i, t in TASKS.items():
            self.db.store.setdefault("tasks", {})[i] = dict(t)
        self.patches = [patch.object(tutanak_router, "db", self.db)]
        for p in self.patches:
            p.start()
        self.as_user("mufettis")
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.dependency_overrides.clear()
        limiter.enabled = True

    def as_user(self, uid, role="user", email=None):
        app.dependency_overrides[get_current_user] = lambda: {
            "uid": uid, "email": email or f"{uid}@gsb.gov.tr", "email_verified": True, "role": role}

    def _ifade(self, **kw):
        body = {"task_id": "inc1", "tur": "ifade", "tarih": "2026-03-12", "yer": "Van GSİM",
                "kisiler": [{"ad": "Ali Veli", "unvan": "Şube Müdürü", "rol": "ifade_veren", "tckn": "10000000146"}],
                "sorular": [{"soru": "Kimliğiniz?", "cevap": "Ali Veli"}], **kw}
        return self.client.post("/api/tutanaklar/", json=body)

    def test_create_list_update(self):
        r = self._ifade()
        self.assertEqual(r.status_code, 200, r.text)
        t = r.json()
        self.assertEqual(t["task_id"], "inc1")
        u = self.client.patch(f"/api/tutanaklar/{t['id']}", json={
            "sorular": [{"soru": "Kimliğiniz?", "cevap": "Ali Veli"}, {"soru": "İddia?", "cevap": "Kabul etmiyorum"}],
            "tamamlandi": True})
        self.assertEqual(u.status_code, 200, u.text)
        self.assertEqual(len(u.json()["sorular"]), 2)
        self.assertEqual(u.json()["yer"], "Van GSİM")  # gönderilmeyen alan korunur
        self.assertEqual([x["id"] for x in self.client.get("/api/tutanaklar/?task_id=inc1").json()], [t["id"]])

    def test_screen_default_payloads_are_accepted(self):
        """Ekranın 'yeni tutanak' anında gönderdiği gövde birebir kabul edilmeli
        (gerçek hata: yeni ifadede 'İfade veren' adı boş olduğu için 422)."""
        mufettis = {"ad": "", "unvan": "Müfettiş", "rol": "mufettis"}
        for tur in ("ifade", "tespit", "gorusme"):
            body = {
                "task_id": "inc1", "tur": tur, "tarih": "2026-11-24", "saat": "10:25", "yer": "", "konu": "X",
                "kisiler": ([{"ad": "", "unvan": "", "rol": "ifade_veren"}] if tur == "ifade" else []) + [mufettis],
                "sorular": [{"soru": "Kimlik bilgileriniz?", "cevap": ""}] if tur == "ifade" else [],
                "metin": "", "kapanis": "Kapanış", "tamamlandi": False,
            }
            r = self.client.post("/api/tutanaklar/", json=body)
            self.assertEqual(r.status_code, 200, f"{tur}: {r.text}")
            u = self.client.patch(f"/api/tutanaklar/{r.json()['id']}", json={
                "kisiler": [{"ad": "", "unvan": "", "rol": "katilan", "tckn": "1000"}], "tarih": "", "saat": ""})
            self.assertEqual(u.status_code, 200, f"{tur}: {u.text}")

    def test_browser_captured_payloads(self):
        """Tarayıcı testinin gerçekten gönderdiği gövdeler (varsa) gerçek şemadan geçmeli."""
        yol = os.environ.get("TUTANAK_TARAYICI_GOVDELERI")
        if not yol or not Path(yol).exists():
            self.skipTest("Tarayıcı testi çıktısı yok")
        for g in json.loads(Path(yol).read_text(encoding="utf-8")):
            yontem, govde = g["yontem"], g["govde"]
            if yontem == "POST":
                r = self.client.post("/api/tutanaklar/", json={**govde, "task_id": "inc1"})
            else:
                t = self._ifade().json()
                r = self.client.patch(f"/api/tutanaklar/{t['id']}", json=govde)
            self.assertEqual(r.status_code, 200, f"{yontem}: {r.text}")

    def test_permissions(self):
        self.as_user("yabanci")
        self.assertEqual(self.client.get("/api/tutanaklar/?task_id=inc1").status_code, 403)
        self.assertEqual(self._ifade().status_code, 403)
        # Paylaşılan görevde (e-posta ile) düzenleme yetkisi
        self.as_user("ortak", email="ortak@gsb.gov.tr")
        t = self.client.post("/api/tutanaklar/", json={"task_id": "sor1", "tur": "tespit", "metin": "x"})
        self.assertEqual(t.status_code, 200, t.text)
        tid = t.json()["id"]
        # Moderatör görür ama değiştiremez (ifade kişisel veri içerir)
        self.as_user("mod", role="moderator")
        self.assertEqual(self.client.get("/api/tutanaklar/?task_id=sor1").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tutanaklar/{tid}", json={"metin": "y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/tutanaklar/{tid}").status_code, 403)
        # Yönetici düzenler; sahip siler
        self.as_user("yonetici", role="admin")
        self.assertEqual(self.client.patch(f"/api/tutanaklar/{tid}", json={"metin": "y"}).status_code, 200)
        self.as_user("diger")
        self.assertEqual(self.client.delete(f"/api/tutanaklar/{tid}").status_code, 200)
        self.assertEqual(self.client.patch(f"/api/tutanaklar/{tid}", json={"metin": "y"}).status_code, 404)

    def test_validation_and_size_limit(self):
        self.assertEqual(self._ifade(tur="sorgu").status_code, 422)
        self.assertEqual(self._ifade(kisiler=[{"ad": "A", "tckn": "12ab"}]).status_code, 422)
        self.assertEqual(self._ifade(task_id="yok").status_code, 404)
        self.assertEqual(self.client.post("/api/tutanaklar/", json={"tur": "ifade"}).status_code, 422)  # görevsiz olmaz
        uzun = [{"soru": "s", "cevap": "ç" * 19000} for _ in range(30)]
        self.assertEqual(self._ifade(sorular=uzun).status_code, 413)


if __name__ == "__main__":
    unittest.main()
