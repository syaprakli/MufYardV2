# PLAN-kategori-email-duzenleme

## 1. Analiz & Mevcut Durum (Context)
- Kullanıcı, Excel'de sadece ünvan bazlı değil, **kişinin yer aldığı tablonun/başlığın (unit)** baz alınarak sekme filtrelemesi yapılmasını istemektedir (Örn: Şükrü Alper Pehlivanoğlu = Başkanlık bölümünde listelenmelidir).
- E-postalar otomatik uydurulmayacak; listede bulunmayanlara `-` veya boş değer verilecek.
- Sekmeler: Başkanlık, Başmüfettişler, Müfettişler, Müfettiş Yardımcıları, Büro, Çay Ocağı ve Destek.

## 2. Görev Kırılımları (Task Breakdown)

### Phase 1: Backend Email Revizyonu
- [ ] `update_emails.py` içerisindeki kontrol listesinde yer ARANMAYAN tüm personele `-` e-posta adresinin tanımlanması. 
- [ ] Bu işlemle sahte e-postaların tüm izleri temizlenir.

### Phase 2: Frontend Filtreleme (Unit Bazlı Arama)
- [ ] `Contacts.tsx` sekme filtresinin güncellenmesi.
- [ ] Tıklanan sekme isimleriyle `c.unit` (Excel'den gelen başlık) içeriğinin eşleştirilmesi. 
  - **Başkanlık:** `c.unit.toLowerCase().includes("başkanlik")`
  - **Başmüfettişler:** `c.unit.toLowerCase().includes("başmüfetti̇ş")`
  - **Müfettişler:** `c.unit.toLowerCase().includes("müfetti̇ş")` ve "baş" içermeyenler.
  - **Müfettiş Yardımcıları:** Gerekirse ünvan üzerinden desteklenecek, temelde Yardımcı arayacak.
  - **Büro:** `c.unit.toLowerCase().includes("büro")`
  - **Çay Ocağı:** `c.unit.toLowerCase().includes("çay")` veya `"destek"` veya `"hi̇zmet"`

### Phase 3: Doğrulama (Verification)
- [ ] `Şükrü Alper Pehlivanoğlu` "Başkanlık" sekmesinde çıkıyor mu kontrol edilecek.
- [ ] Eksik e-postalar tamamen `-` olarak görülecek.

## 3. Açık Sorular (Socratic Gate)
- Planda belirtilen kategoriler dışında eklemek istediğiniz bir filtre sekmesi var mıdır?
