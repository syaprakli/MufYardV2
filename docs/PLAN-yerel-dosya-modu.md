# PLAN — Masaüstünde Yerel Dosyalar ("Yerel Dosya Modu")

> Durum: **1–5 tamamlandı, 6 (kurulum testi) bekliyor** · 23.11.2026
> Kullanıcı kararı: *"Eski düzende bilgisayarda dursun, istenirse sunucuya gitsin."*

## 1. Sorun

Görev klasörlerini ve rapor dosyalarını **backend** oluşturur; klasör, backend hangi makinedeyse orada açılır.

| Kullanım | Backend | Klasörler |
|---|---|---|
| Electron geliştirme modu | Bilgisayar | `Belgeler\MufYARD\Raporlar` ✅ |
| Web | Railway | Sunucu diski (`/data`) |
| **Kurulu Electron (.exe), mevcut kod** | **Railway** | **Sunucu diski — bilgisayarda klasör yok** |

Eski kurulum dosyası bilgisayarda kendi backend'ini çalıştırıyordu ama bunun için **Firebase yönetici anahtarını ve `.env`'yi her kuruluma kopyalıyordu** (`extraResources`). Kurulum dosyasını açan herkes tüm veritabanına yönetici erişimi elde edebiliyordu; güvenlik düzenlemesi bu yüzden kaldırdı. Eski düzen aynen geri getirilmeyecek.

## 2. Hedef düzen

```
Kurulu MufYARD (Electron)
 ├─ Arayüz
 │   ├─ Veri istekleri (görev, denetim, not, sohbet, profil…) ──► Railway (Firestore)
 │   └─ Dosya istekleri (klasör, dosya, Word üretimi, mevzuat) ──► Yerel dosya servisi
 └─ Yerel dosya servisi (bilgisayarda, 127.0.0.1)
     ├─ Yönetici anahtarı YOK, .env YOK, Firestore'a erişmez
     ├─ Kullanıcıyı Firebase'in herkese açık imza anahtarlarıyla doğrular
     └─ Belgeler\MufYARD altında çalışır (Raporlar, Diğer İşlem ve Belgeler, Mevzuat)

"Sunucuya gönder" ──► seçilen dosya/klasör Railway'e yüklenir (paylaşım / yedek)
Web ──► dosyalar sunucuda (bugünkü gibi)
```

**Değişmeyecekler:** klasör yapısı ve adları (`Yıl / Tür / Kod - Başlık / 01_Olur_ve_Ekleri …`), mevcut yerel klasörler, Firestore'daki tüm veriler.

## 3. Bulgular (kod incelemesi)

`backend/app/routers/files.py` uç noktalarının bağımlılıkları:

| Uç nokta | Firestore gerekir mi? |
|---|---|
| upload, tree, create-folder, delete-item, open-file, open-folder | Hayır (yerel izin dosyası) |
| generate-docx-* (kapak, dizi, hazırlık, değerlendirme, özet tablolar) | Hayır |
| open-task-folder/{id}, create-task-folder/{id} | **Evet** — görevi ID ile okuyor → görev bilgileri istekte gönderilerek kaldırılacak |
| share-to-user | Hayır (yerel); sunucuya gönderme ayrıca tasarlanacak |

Mevzuat dosya uç noktaları (open-folder, open-file-location, sync-folder, upload, extract-text) da yereldir.

## 4. Aşamalar

| # | İş | Durum |
|---|---|---|
| 1 | Backend "yerel dosya modu" (`MUFYARD_LOCAL_FILES=1`): yönetici anahtarı okunmaz, token Google'ın açık sertifikalarıyla doğrulanır, yalnızca `/api/files` açık, X-User-Id arka kapısı kapalı | ✅ testli + gerçek çalıştırma |
| 2 | Görev klasörü: yerel `sync-task-folder` (oluştur / kod-ad değişince taşı; görev→klasör eşlemesi `local_task_folders.json`). **Güvenlik:** sunucuda istemcinin gönderdiği görev bilgisine artık güvenilmiyor (başkasının klasörüne sahip olunabiliyordu) | ✅ testli |
| 3 | Arayüz: `FILES_API_URL` (kurulu masaüstü → 127.0.0.1:8000, diğerleri → API_URL); görev oluştur/güncelle sonrası yerel klasör eşitleme; "Klasörü Aç" yolu yerel servisten; Dosyalar önizleme adresleri; `files.ts` bozuk Türkçe metinler düzeltildi | ✅ |
| 4 | Paket: `main.cjs` kurulu uygulamada yerel servisi anahtarsız başlatır (eski anahtarlı servis port 8000'de ise kapatılır); `extraResources` backend'i `.env`/kimlik dosyası filtresiyle ekler; `build_release.bat` iki noktada `scripts/check_release_secrets.py` ile denetler | ✅ |
| 5 | "Sunucuya Gönder" — **tek seferlik kopya** (kullanıcı kararı): Dosyalar ekranında dosyanın o anki hâli sunucuda aynı klasör yoluna yüklenir; yerel dosya paylaşılırken önce otomatik gönderilir, sonra paylaşılır | ✅ |
| 6 | Yeni kurulum dosyası + kullanıcı testi | ⬜ |

Notlar:
- Denetim fotoğrafları, Kamusal Alan, tesisler, harita yüklemeleri bilerek **sunucuda** kalır (ortak veri, web'de de görünür).
- Mevzuat kütüphanesi sunucuda kalır (ortak).
- Klasör olarak toplu gönderme yok (dosya dosya); gerekirse eklenir.

## 5. Riskler / açık sorular

- Yerel servis yalnızca `127.0.0.1`'i dinlemeli; başka bilgisayarlardan erişilemez.
- AI'ın dosya okuması (Raporlar) yerel dosyalarla nasıl çalışacak? (AI yeniden tasarımında ele alınacak)
- "Sunucuya Gönder": tek seferlik kopya seçildi; sonraki değişiklikler için yeniden gönderilir.
- Bu plan tamamlanana kadar **yeni bir .exe kurulum dosyası çıkarılmamalı** (çıkarılırsa klasörler bilgisayarda oluşmaz).
