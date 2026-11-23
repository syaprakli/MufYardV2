# MufYARD — Güvenlik, Performans ve Mimari Yol Haritası

> Kaynak: 23.11.2026 tarihli kapsamlı kod denetimi (güvenlik, performans, ölçeklenebilirlik, kod kalitesi).
> Bu dosya yaşayan bir kayıttır: bir madde ilerledikçe durumu ve commit'i burada güncellenir.

**Durum işaretleri:** ✅ tamamlandı · ⏸ bilinçli olarak bekletiliyor · ⬜ yapılacak · 👤 kullanıcı/kurum aksiyonu

---

## 0. Altyapı özeti (denetim sonrası)

| Bileşen | Durum |
|---|---|
| Backend | Railway, **EU West (Amsterdam)**, tek instance, uvicorn tek process |
| Kalıcı dosyalar | Railway volume `/data` (5 GB), `DATA_DIR=/data` — 23.11.2026 öncesi volume yoktu, her deploy'da dosyalar siliniyordu |
| Veritabanı | Firestore `eur3` (Belçika/Hollanda) |
| Web | Firebase Hosting (yalnızca statik dosya) |
| AI | Google Gemini (`google.generativeai` 0.8.6 — paket desteği bitti) |
| CI | GitHub Actions: backend testleri, frontend build + `node --check`, `npm audit`, gizli anahtar taraması |

---

## 1. Güvenlik

| # | Bulgu | Önem | Durum | Commit |
|---|---|---|---|---|
| S0 | Firebase private key git geçmişinde açıkta | CRITICAL | ✅ Anahtar iptal edildi, yenisi Railway'de. Geçmiş yeniden yazılmadı (anahtar geçersiz olduğu için gerek kalmadı) | — |
| S1 | Kurucu uç noktaları (yedek al/yükle, rol ayarları) e-posta doğrulaması kontrol etmiyordu | CRITICAL | ✅ `require_founder_admin` | 515e96c |
| S2 | Sabit e-posta / sabit UID ile admin yetkisi (denetim, not, rehber, mesaj, profil) | HIGH | ✅ Rol tabanlı | 515e96c |
| S3 | Canlı rapor WebSocket'inde denetim yetkisi yoktu | HIGH | ✅ Yetki kontrolü, view/comment salt okunur | 515e96c |
| C1 | Doğrulama sadece frontend'de; `@gsb.gov.tr` muaftı → dışarıdan kayıt + başkasının e-postasıyla kimliğe bürünme | CRITICAL | ✅ Backend + tüm WebSocket'lerde `email_verified` zorunlu, muafiyet yok | a27274a |
| C2 | AI `list_files`/`read_file_content` dosya izinlerini atlıyordu | HIGH | ✅ Dosyalar API'si ile aynı izin kuralı | b8b6d5c |
| C2b | Mevzuat `local_path` istemciden geliyordu → AI ile başkasının raporu okunabiliyordu | HIGH | ✅ Yol `Mevzuat/` içinde, `Kisisel/<uid>` sahibine, özel mevzuat sahibine | b8b6d5c |
| C3 | AI yazma araçları (mesaj gönder, kişi/not sil…) onaysız çalışıyor → dolaylı prompt injection | MEDIUM→HIGH | ⏸ AI yeniden tasarımında ele alınacak (öneri: araç "öneri" döner, kullanıcı onaylar) | — |
| C4 | Yüklemeler belleğe alındıktan sonra boyut kontrolü; bazılarında sınır yok | MEDIUM | ✅ `BodySizeLimitMiddleware` (25 MB / mevzuat 50 MB / yedek 100 MB) | e5af56f |
| C5 | Rate limit IP'ye göre ve `X-Forwarded-For` ile atlatılabiliyordu | MEDIUM | ✅ uid bazlı, en sağdaki proxy IP'si | a84db7b |
| C6 | Rol önbelleği 5 dk (yetkisi alınan admin 5 dk daha admin) | LOW | ⬜ | — |
| C7 | `verify_id_token(check_revoked=False)` → devre dışı kullanıcı token süresi dolana kadar (≤1 saat) erişir | LOW-MEDIUM | ⬜ | — |
| C8 | Gemini ücretsiz anahtarlarıyla içerik Google eğitiminde kullanılabilir | MEDIUM (KVKK) | ✅ Ayarlar ve Asistan ekranında uyarı | b1ff15f |

## 2. Performans

| # | Bulgu | Durum | Commit |
|---|---|---|---|
| P1 | Ses deşifresi senkron (10–60 sn tüm sunucu donuyordu) | ✅ Async + inline ses (max 20 MB) | e29487e |
| P1b | 19 yerde `to_thread(q.stream)` / `to_thread(lambda: q.stream())` → Firestore trafiği event loop'ta (sohbet, DM, online, bildirim…) | ✅ + AST tabanlı koruma testi | e29487e, e7c90f5 |
| P2 | Online listesi: her istemci 15 sn'de tüm koleksiyonu okuyordu (maliyet ~ kullanıcı²) | ✅ 10 sn sunucu önbelleği, heartbeat önbelleği günceller | e7c90f5 |
| P3 | Yeni rapor sürümünde tüm sürümler (tam HTML) okunuyordu | ✅ `count()` aggregation | e7c90f5 |
| P4 | Rapor içeriği denetim belgesinde; TinyMCE base64 görselleri → 1 MiB belge sınırı riski | ⏸ Rapor/tenkit yeniden tasarımında ele alınacak (önce doğrulanmalı) | — |
| P5 | Notlarda sahip adı için not başına sıralı profil okuma (N+1) | ✅ Tek `get_all` | e7c90f5 |
| P6 | Görev/denetim/not listesi başına 10 ayrı sorgu (uid+e-posta × 5 alan) | ⬜ Veri modeli değişikliği: tek `participants` alanı + `array_contains_any`. 1000+ kullanıcıya kadar bekleyebilir | — |
| P7 | `file_permissions.json` her izin kontrolünde yeniden okunuyordu | ✅ mtime önbelleği | ecc8429 |

## 3. Veri bütünlüğü ve ölçeklenebilirlik

| # | Bulgu | Durum | Commit |
|---|---|---|---|
| D1 | Railway'de volume yoktu → yüklenen dosyalar her deploy'da siliniyordu | ✅ Volume `/data` + `DATA_DIR`. Önceki kayıplar geri gelmez | (altyapı) |
| D2 | Rapor kodu: sırasız `limit(1000)` + hata durumunda "1" → yinelenen resmi numara | ✅ Yıl önekli aralık sorgusu, kilit, hata fırlatır | 0adc468 |
| D3 | `file_permissions.json` atomik değil; bozulunca tüm izinler silinebilirdi; eşzamanlı yazmalar kayboluyordu | ✅ Atomik yazma, `.bak`, bozuksa yazmayı reddet, kilitli güncelleme | ecc8429 |
| D4 | E-postayla paylaşımda bildirim gitmiyordu (Python'da `.trim()` yok) | ✅ | e29487e |
| D5 | Yatay ölçek mümkün değil: süreç içi durum (WebSocket odaları, önbellekler, rate limit, rapor kodu kilidi), izinler yerel diskte | ⬜ 1000+ aktif kullanıcıda: izinler → Firestore, dosyalar → Storage, yayınlar/rate limit → Redis, rapor kodu → Firestore transaction sayacı | — |

## 4. Kod kalitesi

| # | Bulgu | Durum |
|---|---|---|
| Q1 | 5 `Denetim*.tsx` sayfası (~16 bin satır) %82–97 aynı | ⬜ Tek bileşen + tesis türüne göre config. **Yeni tesis türü eklemeden önce yapılmalı** |
| Q2 | `Files.tsx` 9.419 satır, 174 `useState` | ⬜ Ağaç / önizleme / paylaşım / yükleme bileşenlerine bölünmeli |
| Q3 | İki editör (TinyMCE + Quill/Yjs) | ⬜ Rapor yeniden tasarımında birine karar verilmeli |
| Q4 | `owner_id` bazen uid bazen e-posta | ⬜ P6 ile birlikte tek kimlik (uid) + veri göçü |
| Q5 | `google.generativeai` desteği bitti | ⬜ `google.genai`'ye geçiş (istemci başına API anahtarı da global yarışı tamamen kaldırır) |
| Q6 | `datetime.utcnow`, pydantic `.dict()` eskimiş | ⬜ Toplu değişim |
| Q7 | Repo kirliliği (scratch, eski deploy kopyası, kullanıcı yüklemeleri, loglar) | ✅ Takipten çıkarıldı (0233715). `backend/uploads` git geçmişinde duruyor |
| Q8 | `esbuild` yalnızca proje dışından bulunuyordu → CI build kırılıyordu | ✅ d25161a |

## 5. Uyumluluk (KVKK / kamu verisi)

| # | Konu | Durum |
|---|---|---|
| K1 | Sunucu ve dosyalar ABD'deydi | ✅ AB'ye taşındı (Firestore zaten AB) |
| K2 | KVKK md. 9 yurt dışı aktarım (AB de yurt dışı) | 👤 Kurum KVKK irtibat kişisiyle değerlendirilmeli |
| K3 | 2019/12 Genelgesi: kamu verisinin yurt içi saklanması | 👤 Rapor verisinin bulutta tutulup tutulamayacağı kurumla netleşmeli; gerekirse raporlar masaüstünde / yurt içi sunucuda |
| K4 | Firebase Storage bucket konumu | ⬜ Doğrulanmadı (yerel anahtar güncellenince okunabilir) |

## 6. Bekleyen kullanıcı aksiyonları

- 👤 `backend/firebase-credentials.json` → Railway'deki `FIREBASE_SERVICE_ACCOUNT_JSON` (anahtar `13c48d2a…`) ile değiştirilmeli; yerel dosya geçersiz anahtar içeriyor.
- 👤 K2/K3 için kurum görüşmesi.

## 7. Önerilen sıradaki adımlar

1. AI yazma + rapor/tenkit yeniden tasarımı (C3, P4, Q3 birlikte)
2. Q1 — denetim sayfalarının birleştirilmesi
3. C6/C7 — küçük güvenlik iyileştirmeleri
4. Q5 — `google.genai` geçişi
5. P6/Q4 — veri modeli (büyüme öncesi)
