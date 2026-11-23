/**
 * Denetim türlerinin ayarları.
 *
 * Beş denetim sayfası (İl, KYK, Özel Yurt, Spor Kulübü, Federasyon) tek bir genel sayfanın
 * kopyalarıydı. Ortak sayfa (DenetimSayfasi) türe özgü her şeyi buradan okur.
 * Değerler eski sayfalardaki metinlerden birebir alınmıştır; klasör/dosya önekleri ve
 * URL anahtarları kullanıcı verisine bağlı olduğu için DEĞİŞTİRİLMEMELİDİR.
 *
 * Plan: docs/PLAN-denetim-sayfalari-birlestirme.md
 */

export type DenetimTuruKey = "il" | "kyk" | "ozel" | "spor" | "federasyon";

export interface DenetimTuruAyari {
    /** URL (/denetim/<key>) ve soru seti (AUDIT_TEMPLATES) anahtarı */
    key: DenetimTuruKey;
    /** Sayfa başlığı */
    baslik: string;
    /** "… henüz bir görev oluşturulmamıştır" mesajındaki tür adı */
    bosListeTurAdi: string;
    /** Görev listesi düğmesi: "<tekil> Değiştir", "Tüm <çoğul> / Görevler Listesini Aç" */
    tekilEtiket: string;
    cogulEtiket: string;
    /** Fotoğraf cihaza kaydedilirken dosya adı öneki: `<fotoOneki>_<rapor adı>` */
    fotoOneki: string;
    /** Rapor adı yokken fotoğraf dışa aktarma klasör/dosya adı */
    dosyaOneki: string;
    /** Hub kartı alt başlıkları */
    kurumsalVeriAciklamasi: string;
    evrakTalepAciklamasi: string;
}

export const DENETIM_TURLERI: Record<DenetimTuruKey, DenetimTuruAyari> = {
    ozel: {
        key: "ozel",
        baslik: "Özel Yurt Denetimi",
        bosListeTurAdi: "Özel Yurt Denetimi",
        tekilEtiket: "Yurt",
        cogulEtiket: "Yurtlar",
        fotoOneki: "Ozel",
        dosyaOneki: "Ozel_Denetim",
        // Not: KYK dışındaki sayfalarda "İl Müdürlüğü" metni kopyadan kalmış olabilir (planda açık soru).
        kurumsalVeriAciklamasi: "İl Müdürlüğü kurumsal, tesis ve personel temel verileri",
        evrakTalepAciklamasi: "İl Müdürlüğünden istenecek resmi evrak talep yazısı",
    },
    kyk: {
        key: "kyk",
        baslik: "Kyk Yurt Denetimi",
        bosListeTurAdi: "KYK Yurt Denetimi",
        tekilEtiket: "Yurt",
        cogulEtiket: "Yurtlar",
        fotoOneki: "KYK",
        dosyaOneki: "KYK_Denetimi",
        kurumsalVeriAciklamasi: "Yurt Müdürlüğü kurumsal, kapasite ve personel temel verileri",
        evrakTalepAciklamasi: "Yurt Müdürlüğünden istenecek resmi evrak talep yazısı",
    },
    il: {
        key: "il",
        baslik: "İl Müdürlükleri Denetimi",
        bosListeTurAdi: "İl Müdürlükleri Denetimi",
        tekilEtiket: "İl",
        cogulEtiket: "İller",
        fotoOneki: "Il",
        dosyaOneki: "Il_Denetimi",
        kurumsalVeriAciklamasi: "İl Müdürlüğü kurumsal, tesis ve personel temel verileri",
        evrakTalepAciklamasi: "İl Müdürlüğünden istenecek resmi evrak talep yazısı",
    },
    spor: {
        key: "spor",
        baslik: "Spor Kulüpleri Denetimi",
        bosListeTurAdi: "Spor Kulüpleri Denetimi",
        tekilEtiket: "Kulüp",
        cogulEtiket: "Kulüpler",
        fotoOneki: "Spor",
        dosyaOneki: "Spor_Denetimi",
        kurumsalVeriAciklamasi: "İl Müdürlüğü kurumsal, tesis ve personel temel verileri",
        evrakTalepAciklamasi: "İl Müdürlüğünden istenecek resmi evrak talep yazısı",
    },
    federasyon: {
        key: "federasyon",
        baslik: "Federasyon Denetimi",
        bosListeTurAdi: "Federasyon Denetimi",
        tekilEtiket: "Federasyon",
        cogulEtiket: "Federasyonlar",
        fotoOneki: "Federasyon",
        dosyaOneki: "Federasyon",
        kurumsalVeriAciklamasi: "İl Müdürlüğü kurumsal, tesis ve personel temel verileri",
        evrakTalepAciklamasi: "İl Müdürlüğünden istenecek resmi evrak talep yazısı",
    },
};
