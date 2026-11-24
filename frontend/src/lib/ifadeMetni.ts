/** İfade tutanağı metin kuralları (kullanıcının verdiği şablona göre). */
import type { Tutanak, TutanakKisi } from "./api/tutanaklar";

export const IFADE_SORULARI_VARSAYILAN = [
    { soru: "Konu hakkında bildiklerinizi anlatınız.", cevap: "" },
    { soru: "İfadenize eklemek istediğiniz başka bir husus varsa ekleyiniz.", cevap: "Söyleyeceklerim bundan ibarettir." },
];

export const IFADE_KAPANIS_SABLON =
    "Durumu tespit eden bu ifade tutanağı birlikte düzenlendi, okundu, okutturuldu, beyana uygun olarak yazıldığı anlaşıldıktan sonra müştereken imzalandı.";

export const MUFETTIS_UNVANLARI = ["Baş Müfettiş", "Müfettiş", "Müfettiş Yardımcısı"];

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function gunAdi(tarih?: string | null): string {
    const m = (tarih || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return GUNLER[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()];
}

export function tarihNoktali(tarih?: string | null): string {
    const m = (tarih || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : tarih || "";
}

// Sayının okunuşunun son kelimesine göre bulunma eki: 1 bir→de, 3 üç→te, 6 altı→da, 40 kırk→ta …
const BIRLER: Record<number, string> = { 1: "de", 2: "de", 3: "te", 4: "te", 5: "te", 6: "da", 7: "de", 8: "de", 9: "da" };
const ONLAR: Record<number, string> = { 1: "da", 2: "de", 3: "da", 4: "ta", 5: "de" };

/** "10:25" → "10:25’te", "14:30" → "14:30’da", "09:00" → "09:00’da" */
export function saatEkli(saat?: string | null): string {
    const m = (saat || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return saat || "";
    const sa = Number(m[1]), dk = Number(m[2]);
    const sayi = dk !== 0 ? dk : sa;
    let ek: string;
    if (sayi === 0) ek = "da"; // sıfır
    else if (sayi % 10 !== 0) ek = BIRLER[sayi % 10];
    else ek = ONLAR[Math.floor(sayi / 10)] || "da";
    return `${m[1].padStart(2, "0")}:${m[2]}’${ek}`;
}

export const ifadeVeren = (t: Pick<Tutanak, "kisiler">): TutanakKisi | undefined =>
    (t.kisiler || []).find(k => k.rol === "ifade_veren");

/** Şablondaki giriş paragrafı: alanlardan otomatik oluşturulur. */
export function otomatikGiris(t: Tutanak): string {
    const k = ifadeVeren(t);
    const ad = k?.ad?.trim() || "…";
    const tarih = tarihNoktali(t.tarih) || "…";
    const gun = gunAdi(t.tarih) || "…";
    const saat = saatEkli(t.saat) || "…";
    const yer = t.yer?.trim() || "…";
    return `Yukarıda açık kimliği yazılı olan ${ad} ${tarih} tarihine tesadüf eden ${gun} günü saat ${saat} ${yer} davet olunarak, `
        + "ifadesinin alınacağı konu kendisine anlatıldı. İfade vereceğini beyan etmesi üzerine aşağıdaki sorular soruldu.";
}

/** Kullanıcı giriş metni yazmadıysa otomatik metin kullanılır. */
export const girisMetni = (t: Tutanak) => (t.metin || "").trim() || otomatikGiris(t);

/** İmza bloğundaki unvan: ifade veren "İfade Veren", müfettiş kendi unvanı. */
export function imzaUnvani(k: TutanakKisi): string {
    if (k.rol === "ifade_veren") return "İfade Veren";
    if (k.rol === "mufettis") return k.unvan?.trim() || "Müfettiş";
    const rol = { katilan: "Katılan", tanik: "Tanık", yazman: "Yazman" }[k.rol as "katilan" | "tanik" | "yazman"] || "";
    return [rol, k.unvan?.trim()].filter(Boolean).join(" – ");
}

/** Şablondaki kimlik satırları (etiket → değer). */
export function kimlikSatirlari(k?: TutanakKisi): [string, string][] {
    const d = (v?: string | null) => (v || "").trim();
    const dogum = [d(k?.dogum_yeri), d(k?.dogum_yili)].filter(Boolean).join("/");
    return [
        ["Adı ve Soyadı", d(k?.ad)],
        ["T.C. Kimlik Numarası", d(k?.tckn)],
        ["Baba Adı", d(k?.baba_adi)],
        ["Ana Adı", d(k?.ana_adi)],
        ["Doğum Yeri ve Yılı", dogum],
        ["Nüfusa Kayıtlı Olduğu Yer", d(k?.nufus_yeri)],
        ["Görevi", d(k?.unvan)],
        ["Adresi", d(k?.adres)],
        ["Cep Telefonu", d(k?.telefon)],
    ];
}

// ---------------------------------------------------------------- imza sırası (kıdem)

/** Kıdem derecesi (küçük = kıdemli): Baş Müfettiş > Müfettiş > Müfettiş Yardımcısı > diğerleri > İfade Veren. */
function kidemDerecesi(k: TutanakKisi): number {
    if (k.rol === "ifade_veren") return 9; // ifade veren her zaman en kıdemsiz
    if (k.rol !== "mufettis") return 5;
    const u = (k.unvan || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
    if (u.includes("baş")) return 0;
    if (u.includes("yard") || u.includes("yrd")) return 2;
    return 1; // "Müfettiş" ya da boş
}

/**
 * İmza bloğundaki soldan sağa sıra.
 * Kıdem: unvana göre; aynı unvanda kişiler listesinde üstte olan kıdemli.
 * Yerleşim: 2 kişi imzalıyorsa kıdemli sağda; 3 (ve daha fazla) kişide kıdemli en solda.
 */
export function imzaSirasi(kisiler: TutanakKisi[]): TutanakKisi[] {
    const kidemli = kisiler
        .map((k, i) => ({ k, i }))
        .sort((a, b) => kidemDerecesi(a.k) - kidemDerecesi(b.k) || a.i - b.i)
        .map(x => x.k);
    return kidemli.length === 2 ? kidemli.reverse() : kidemli;
}
