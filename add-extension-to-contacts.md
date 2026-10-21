# Rehber Kişilerine Dahili Numara (Extension) Ekleme Planı

Bu plan, kurumsal ve kişisel rehber genelinde **Dahili Numara (extension)** alanının eklenmesini, formlarda yönetilmesini, arama çubuğunda filtrelenmesini ve kartlar üzerinde kopyalanabilir rozet/satır olarak sunulmasını kapsar.

---

## 1. Mimari ve Değişiklik Kapsamı

### A. Backend Katmanı
- **`backend/app/schemas/contact.py`**:
  - `ContactBase` ve `ContactUpdate` modellerine `extension: Optional[str] = ""` eklenmesi.
- **`backend/app/services/contact_service.py`**:
  - `create_contact` ve `update_contact` metodlarında `extension` alanının Firestore'a kaydedilmesi.
  - `sync_from_rdb_rehber_v6` metodunda Excel 4. sütundaki dahili numaranın doğrudan `extension` alanına yazılması.
  - `get_contacts` sorgusunda geriye dönük uyumluluk: Eğer bir kurumsal kayıtta `extension` alanı boşsa ancak `unit` içinde `Dahili: 5103` geçiyorsa, otomatik parse edilerek `extension` alanına atanması.

### B. Frontend Katmanı
- **`frontend/src/lib/api/contacts.ts`**:
  - `Contact` ve `ContactCreate` interface'lerine `extension?: string;` eklenmesi.
- **`frontend/src/pages/Contacts.tsx`**:
  - `newContact` ve `editingContact` state'lerine `extension` eklenmesi.
  - Modal formuna "Dahili No" (örn: 5103) giriş alanının eklenmesi.
  - `ContactCard` bileşeninde dahili numaranın telefonun yanında/altında özel bir `Dahili: {contact.extension}` rozeti olarak gösterilmesi.
  - Tıklandığında panoya kopyalama ve kullanıcıya toast bildirimi gösterilmesi.
  - Rehber arama çubuğunda dahili numaraya göre filtreleme desteği.

---

## 2. Uygulama Adımları

- [ ] **Görev 1: Backend Şema Güncellemesi**
  - `ContactBase`, `ContactUpdate`, `ContactResponse` pydantic modellerine `extension` ekle.
- [ ] **Görev 2: Backend Servis Güncellemesi**
  - Firestore okuma, yazma ve Excel senkronizasyonunda `extension` desteğini sağla.
- [ ] **Görev 3: Frontend API & Arayüz Güncellemesi**
  - TypeScript tanımlarını güncelle.
  - Modal formuna Dahili No alanını yerleştir.
  - `ContactCard` üzerinde kopyalanabilir dahili buton/rozetini uygula.
  - Arama fonksiyonuna dahili numara eşleşmesini dahil et.
- [ ] **Görev 4: Derleme & Çalıştırma**
  - Frontend TypeScript ve Vite derlemesi (`npm run build`).
  - PyInstaller backend derlemesi (`dist/mufyard-backend`).
  - Electron win-unpacked güncellemesi ve uygulamanın yeniden başlatılması.
- [ ] **Görev 5: Doğrulama Testleri**
  - Kişisel rehbere dahili numaralı yeni kişi ekle ve doğrula.
  - Kurumsal rehberdeki dahili numaraları ve panoya kopyalama aksiyonunu test et.
  - Arama çubuğuna dahili numara yazarak filtrelemeyi doğrula.
