# PLAN — Masaüstünde Yerel Dosyalar ("Yerel Dosya Modu")

> Durum: **taslak, onay bekliyor** · 23.11.2026
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

| # | İş | Not |
|---|---|---|
| 1 | Backend "yerel dosya modu": `MUFYARD_LOCAL_FILES=1` ile Firebase yönetici anahtarı olmadan açılır, yalnızca dosya uç noktaları etkin, token doğrulama proje kimliğiyle | Testlerle |
| 2 | Görev klasörü uç noktaları görev bilgisini istekten alır (Firestore okumaz) | Testlerle |
| 3 | Arayüz: iki adres — veri → Railway, dosya → yerel servis (Electron) / Railway (web). Görev oluşturma/yeniden adlandırmadan sonra yerel klasör oluşturma çağrısı | Geliştirme modunda denenir |
| 4 | Kurulum paketi: yerel servis tekrar pakete girer, **anahtar ve .env olmadan**; paket içeriği CI'da kontrol edilir (anahtar varsa derleme düşer) | |
| 5 | "Sunucuya gönder": Dosyalar ekranında seçili dosya/klasörü Railway'e yükleme | Kullanıcıyla tasarlanacak |
| 6 | Yeni kurulum dosyası + kullanıcı testi | Kullanıcı |

## 5. Riskler / açık sorular

- Yerel servis yalnızca `127.0.0.1`'i dinlemeli; başka bilgisayarlardan erişilemez.
- AI'ın dosya okuması (Raporlar) yerel dosyalarla nasıl çalışacak? (AI yeniden tasarımında ele alınacak)
- "Sunucuya gönder" edilen dosyanın sonraki değişiklikleri: tek seferlik kopya mı, eşitleme mi? (Kullanıcı kararı; öneri: tek seferlik kopya, basit)
- Bu plan tamamlanana kadar **yeni bir .exe kurulum dosyası çıkarılmamalı** (çıkarılırsa klasörler bilgisayarda oluşmaz).
