# PLAN — Denetim Sayfalarının Birleştirilmesi (Yol haritası Q1)

> Durum: **uygulanıyor** · Hazırlanma: 23.11.2026
>
> | Aşama | Durum |
> |---|---|
> | 0 Test altyapısı | Ertelendi: sayfalar uygulama bağlamlarına (auth, ortak veri, onay, yönlendirme) sıkı bağlı; bunun yerine her geçişte "ayar = eski sayfa" eşdeğerlik kontrolü yapılıyor |
> | 1 Ortak yardımcılar | Aşama 2 ile birlikte yapıldı (yardımcılar ortak sayfada) |
> | 2 Özel Yurt | ✅ `/denetim/ozel` → `DenetimSayfasi tur="ozel"`; kullanıcı testi ✅ |
> | 3 KYK | ✅ `/denetim/kyk` → `DenetimSayfasi tur="kyk"`. KYK farkları iki bayrakla: `ilAltGorevleri` (İl görevi altında yurtlar, alt görev otomatik oluşturma), `ozetKartiTasarimi` (KYK üst bölüm tasarımı). İki yönlü satır kontrolü temiz. Kullanıcı testi ✅ |
> | 4 Spor + Federasyon | ✅ `/denetim/spor`, `/denetim/federasyon` → ortak sayfa. Ayarlar: `pano` (pano + evrak talep yazısı; bloklar eski sayfalardan birebir, tür başına ayrı), `raporSablonu` (bulgu aktarımı: resmi Spor/Federasyon şablonu + kapak), `raporOlusturucu` (ReportDynamicBuilder; başlık, şablon, kapak anahtarı, etiket). Evrak maddeleri `evrakTalepMaddeleri.ts`. Rapor yazma kodu **değiştirilmeden** taşındı. Düzeltmeler: Spor fotoğraf büyütme (yeni pencere → uygulama içi; Electron'da yerel fotoğraflarda çalışmıyordu), modül kartları telefonda sıkı yerleşim (herkese), geçersiz renk sınıfları. İki yönlü satır kontrolü temiz. Kullanıcı testi ✅ (rapor editörü ayrıca denenecek) |
> | 5 İl | ✅ `/denetim/il` → ortak sayfa. Büyük ölçüde farklılaşmış bölümler bütün olarak `tur === "il"` ile ayrıldı (fotoğraf yükleme, rapor verisi yükleme + tesis tarayıcı yedeği, görev başlığı il seçici, sekme çubuğu, kart alt kısmı); evrak talebi / istenecek tablolar (tenkit) / tesisler `ilEkleri` içinde **değiştirilmeden**; `DenetimOzetTablolar` ve `IlTesisleriDenetim` yalnızca İl'de, ihtiyaç anında yüklenir. İl'de kaldırılmış "Bu İle Bağlı KYK" paneli ortak sayfadan da kaldırıldı. Ayarlar: `raporSablonu: "il"`, `raporOlusturucu` (14 Başlık, `kapakId`), `sonGorevAnahtari`. Doğrulama temiz. **Kullanıcı testi bekleniyor** |
> | 6 Eski dosyaların silinmesi | ⬜ İl testi sonrası |

## 1. Mevcut durum (ölçüldü)

| Sayfa | Satır | Ortak çekirdeğe göre fazlası |
|---|---|---|
| `DenetimOzel.tsx` | 2.750 | — (en sade kopya, çekirdeğe en yakın) |
| `DenetimKyk.tsx` | 2.897 | +270: İl görevine bağlı KYK alt görevi oluşturma/bulma, alt yurt menüsü |
| `DenetimFederasyon.tsx` | 3.577 | +930: Pano (dashboard) sekmesi (705), evrak talep maddeleri, rapor oluşturucu modu |
| `DenetimSpor.tsx` | 3.627 | +1.000: `ReportDynamicBuilder` + rapor ilk kurulum (742), rapor oluşturucu modu |
| `DenetimIl.tsx` | 3.726 | +1.180: Evrak Talebi sekmesi (556), Tesisler sekmesi, Özet Tablolar (→ tenkit), Özel Beden Eğitimi |
| **Toplam** | **16.577** | |

- Beşi de **5 Haziran 2026'da (354817c) tek bir genel sayfadan kopyalanarak** oluşturulmuş. Her kopyada `const activeTab = "ozel"` gibi tür sabitlenmiş, ama beş türün eşlemesi (`categoryMap`) hâlâ her dosyada duruyor.
- Ortak çekirdek ≈ 2.600 satır; sayfalar birbirine %82–97 aynı.
- **Bedeli:** son 3 ayda 8 commit beş dosyanın **beşini birden** değiştirmek zorunda kaldı. Aynı hata 5 kez düzeltiliyor; birinde unutulunca sayfalar ayrışıyor.

### Sayfaya özgü olanlar (ayar olacaklar)

| Ayar | Özel | KYK | İl | Spor | Federasyon |
|---|---|---|---|---|---|
| `key` (URL, soru seti) | `ozel` | `kyk` | `il` | `spor` | `federasyon` |
| `raporTuru` | Özel Yurt Denetimi | Kyk Yurt Denetimi | İl Denetimi | Spor Kulüpleri Denetimi | Federasyon Denetimi |
| Klasör/dosya öneki | `Ozel_Denetim` | `KYK_Denetimi` | `Il_Denetimi` | `Spor_Denetimi` | `Federasyon` |
| Liste etiketi | Tüm Yurtlar | (yurtlar) | — | Tüm Kulüpler | Tüm Federasyonlar |
| Bilgi metinleri | İl Müdürlüğü… | Yurt Müdürlüğü… | … | … | … |
| Ek sekmeler | — | — | Evrak Talebi, Tesisler, Özet Tablolar | — | Pano |
| Rapor oluşturucu modu | — | — | var | var | var |
| Alt görev mantığı | — | İl → KYK | — | — | — |

## 2. Hedef yapı

```
pages/denetim/
  DenetimSayfasi.tsx          ortak sayfa (çekirdek), türü config'ten alır
  denetimTurleri.ts           5 türün ayarları (yukarıdaki tablo)
  denetimYardimcilari.ts      stripHtml, getTaskDisplayCode, getNextReportTitle, emptyForm, PRESET_CATEGORIES…
  ekler/
    IlEvrakTalebiSekmesi.tsx
    IlTesislerSekmesi.tsx
    FederasyonPanoSekmesi.tsx
    RaporOlusturucuModu.tsx   (Spor + Federasyon + İl ortak)
    kykAltGorev.ts
App.tsx: /denetim/il, /denetim/kyk … aynı URL'ler → <DenetimSayfasi tur="il" /> …
```

**Değişmeyecekler** (kullanıcı verisi/alışkanlık bozulmasın):
- URL'ler (`/denetim/ozel` vb.)
- Klasör ve dosya adı önekleri (`Ozel_Denetim_…`): Raporlar klasör yapısı ve izinler bunlara bağlı
- localStorage anahtarları (ör. `mufyard_last_task_il`): son seçilen görev hatırlanmaya devam eder
- `DenetimOzetTablolar` / tenkit havuzu: **hiç dokunulmaz**, İl sayfasına olduğu gibi takılır (tenkit yeniden tasarımı ayrı)

**Beklenen sonuç:** ~16.600 satır → ~5.000–6.000 satır; ortak bir düzeltme tek yerde yapılır, yeni tesis türü = bir ayar bloğu + varsa ek sekme.

## 3. Aşamalar

Her aşama ayrı commit/deploy; bir sonraki aşamaya **kullanıcı uygulamada test edip onay verince** geçilir.

| Aşama | İş | Risk | Kullanıcı testi |
|---|---|---|---|
| **0** | Güvenlik ağı: Vitest + Testing Library; her sayfa için "açılıyor, görev listesi geliyor, sekmeler görünüyor" duman testi (API taklit). CI'a eklenir | Yok (yalnızca test) | — |
| **1** | Saf yardımcıların tek dosyaya alınması; 5 sayfa oradan import eder. Davranış değişmez | Çok düşük | Herhangi bir sayfayı açmak |
| **2** | `DenetimSayfasi` + `denetimTurleri` Özel sayfasından türetilir; **yalnızca `/denetim/ozel`** yeni sayfaya bağlanır | Orta | Özel yurt: görev seç, checklist, fotoğraf, rapor, evrak |
| **3** | KYK: alt görev mantığı ekle (`kykAltGorev`), `/denetim/kyk` bağlanır | Orta | İl görevinden KYK alt görevi oluşturma |
| **4** | Spor + Federasyon: rapor oluşturucu modu ve Federasyon pano sekmesi; iki rota bağlanır | Orta-yüksek | Rapor oluşturucu, pano |
| **5** | İl: evrak talebi, tesisler, özet tablolar (tenkit olduğu gibi); rota bağlanır | Yüksek (en büyük fark) | Evrak talebi, tesisler, özet tablolar, tenkit aktarımı |
| **6** | Eski 5 dosyanın silinmesi; çekirdeğin hook'lara bölünmesi (isteğe bağlı) | Düşük | Genel kontrol |

Geri dönüş: aşama 2–5'te eski sayfa dosyası silinmez; sorun çıkarsa `App.tsx`'te tek satırla eski sayfaya dönülür.

## 4. Ayrışmış "ortak" kısımlar

Kopyalar 5 aydır ayrı geliştiği için ortak sanılan bazı bölümler sayfalar arasında farklılaşmış (ör. fotoğraf ızgarası, rapor önizleme başlığı, görev oluşturma butonu bölgesi). Kural:
- Farkın **bir hata düzeltmesi** olduğu açıksa (bir sayfada düzeltilmiş, diğerlerinde unutulmuş) → düzeltilmiş hâli herkese uygulanır.
- **Bilinçli tür farkı** ise → config'e taşınır.
- Emin olunamayanlar her aşamanın sonunda kullanıcıya liste olarak sorulur.

## 5. Kapsam dışı

- Tenkit havuzu / özet tablolar mantığı, AI yazma, rapor editörü seçimi (ayrı yeniden tasarım — yol haritası C3/P4/Q3)
- `DenetimBilgiBankasi.tsx` (ayrı sayfa, kopya değil)
- Görsel tasarım değişikliği (birleştirme sırasında ekranlar aynı kalır)

## 6. Açık sorular (kullanıcıya)

- ✅ Çözüldü (kullanıcı onayı): kart alt yazıları ve rapor adı örneği denetlenen kurumu göstermeli (Yurt Müdürlüğü / Spor Kulübü / Federasyon). `denetimTurleri.ts` ve henüz geçirilmemiş eski sayfalarda düzeltildi.

- ❓ Üst bölüm tasarımı: Özel/İl/Spor/Federasyon "Aktif Form seçici + Durum" kullanıyor, KYK "özet kartı (kod, müfettiş, tarih) + Denetime Başla". Şimdilik ikisi de korunuyor (`ozetKartiTasarimi`). Tek tasarıma inilecekse hangisi?

## 7. Karar bekleyenler (ilk taslak)

1. Aşama sırası ve "her aşamadan sonra test" yaklaşımı uygun mu?
2. Aşama 0 için Vitest eklenmesi (yalnızca geliştirme bağımlılığı) uygun mu?
3. İl sayfası (tenkit bağlantılı) en sona bırakılsın mı, yoksa tenkit yeniden tasarımıyla birlikte mi ele alınsın?
