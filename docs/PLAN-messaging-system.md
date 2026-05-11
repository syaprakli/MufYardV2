# PLAN: MufYardV2 Mesajlaşma Sistemi Standardizasyonu

> **Durum:** Taslak / Planlama Aşamasında
> **Hedef:** Özel mesajların yüzen kutu (Floating) yerine alt bar (Messenger tarzı) yapısına geçirilmesi ve Genel Müzakere senkronizasyonunun %100 stabil hale getirilmesi.

---

## 1. ANALİZ VE MEVCUT DURUM

### 1.1. Mevcut Sorunlar
- **Özel Mesajlar:** Mevcut `FloatingChat` yapısı çok fazla yer kaplıyor ve kullanıcı deneyimi açısından "mesaj geldiğinde aşağıda beliren kutu" beklentisini tam karşılamıyor.
- **Genel Müzakere (Kamusal Alan):** WebSocket `room_id: 'global'` senkronizasyonunda bazı durumlarda mesajlar anlık düşmüyor veya dosya ekleri render edilmiyor.

---

## 2. ÇÖZÜM MİMARİSİ

### 2.1. Özel Mesajlaşma (Bottom Bar Chat)
- **Yapı:** `ChatContainer` bileşeni güncellenerek pencereler ekranın en altına sabitlenmiş, minimize edilebilir ve yan yana dizilen kutulara dönüştürülecek.
- **Otomatik Açılış:** Mesaj geldiğinde bu kutu otomatik olarak "açık" veya "bildirimli" şekilde altta belirecek.
- **Sync:** Mesajlar sayfasıyla bu kutular `ChatContext` üzerinden tam senkronize çalışacak.

### 2.2. Canlı Müzakere (Global Sync)
- **PresenceContext Güçlendirme:** `global` oda için bağlantı koptuğunda otomatik reconnect ve mesaj geçmişinin (buffer) doğru yönetilmesi.
- **Dosya Render:** Tüm medya tiplerinin (Görsel, PDF, Belge) genel chat akışında önizlemeli gösterilmesi.
- **Online Göstergesi:** O an Kamusal Alan'da olan kullanıcıların listesinin anlık güncellenmesi.

---

## 3. UYGULAMA ADIMLARI (FAZLAR)

### FAZ 1: UI Altyapısı (Bottom Bar)
- `FloatingChat.tsx` bileşenini `BottomChatBox.tsx` olarak yeniden tasarlamak.
- `ChatContainer.tsx` içindeki dizilim mantığını (`flex-row-reverse`) güncellemek.

### FAZ 2: WebSocket & Sync Stabilizasyonu
- `PresenceContext.tsx` içindeki `sendMessage` ve `onmessage` handler'larını `room_id: 'global'` için optimize etmek.
- Mesajların veritabanına (Firebase) yazılma ve anlık dağılma hızını doğrulamak.

### FAZ 3: Medya & Preview
- `PublicSpace.tsx` içindeki mesaj balonlarını `AttachmentPreview` bileşeniyle entegre etmek.
- Büyük dosya gönderimlerinde progres bar eklemek.

---

## 4. DOĞRULAMA (TEST) KRİTERLERİ

1. [ ] İki farklı tarayıcıda Kamusal Alan açıldığında mesajlar < 500ms sürede diğer ekrana düşüyor mu?
2. [ ] Özel mesaj geldiğinde sayfanın altında kutu otomatik beliriyor mu?
3. [ ] Gönderilen PDF/Resim dosyaları genel müzakere ekranında tıklanabilir önizleme olarak görünüyor mu?
4. [ ] Mesajlar sayfasıyla alttaki chat kutusu anlık senkron mu?
