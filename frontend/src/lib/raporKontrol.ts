/**
 * Rapor öncesi kalite kontrolü ve kişisel veri (KVKK) karartma.
 *
 * Saf fonksiyonlar: rapor metnini yalnızca okur, değiştirmez. Karartma, metnin kopyasını üretir.
 */
import type { Tenkit } from "./api/tenkitler";

export type BulguDuzeyi = "hata" | "uyari" | "bilgi";
export type BulguHedefi = "tenkit_takibi" | "checklist" | "photos" | "metin";

export interface Bulgu {
    duzey: BulguDuzeyi;
    baslik: string;
    ayrinti?: string;
    hedef?: BulguHedefi;
}

export type KisiselVeriTuru = "tckn" | "telefon" | "eposta" | "iban";

export interface KisiselVeri {
    tur: KisiselVeriTuru;
    deger: string;
    maskeli: string;
}

export const KISISEL_VERI_ETIKETI: Record<KisiselVeriTuru, string> = {
    tckn: "T.C. Kimlik No",
    telefon: "Telefon",
    eposta: "E-posta",
    iban: "IBAN",
};

// ---------------------------------------------------------------- metin yardımcıları

/** HTML'i düz metne çevirir (paragraf sonları korunur). */
export function htmlToText(html: string): string {
    if (!html) return "";
    if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, " ");
    const doc = new DOMParser().parseFromString(
        html.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "$&\n").replace(/<br\s*\/?>/gi, "\n"),
        "text/html",
    );
    return (doc.body.textContent || "").replace(/ /g, " ");
}

const TR_KUCUK: Record<string, string> = { I: "ı", İ: "i" };
export const normalize = (s: string) =>
    (s || "")
        .replace(/[Iİ]/g, c => TR_KUCUK[c])
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-zçğıöşü0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const DOLGU = new Set([
    "ve", "ile", "için", "bir", "bu", "şu", "olan", "olarak", "mı", "mi", "mu", "mü", "midir", "mıdır",
    "var", "yok", "de", "da", "ki", "gibi", "kadar", "olup", "edilmiş", "edilmesi", "yapılmış", "yapılması",
    "bulunmaktadır", "bulunan", "ilgili", "tarafından", "hususu", "konusu", "durumu",
]);

/** Türkçe ekleri kabaca atmak için kelime kökünün ilk 5 harfi kullanılır. */
const kokler = (s: string) =>
    normalize(s)
        .split(" ")
        .filter(k => k.length > 2 && !DOLGU.has(k))
        .map(k => k.slice(0, 5));

/** Tenkit başlığının anahtar kelimelerinin en az yarısı rapor metninde geçiyor mu? */
export function metindeGeciyor(baslik: string, metinKokleri: Set<string>): boolean {
    const k = Array.from(new Set(kokler(baslik)));
    if (k.length === 0) return true;
    const bulunan = k.filter(x => metinKokleri.has(x)).length;
    return bulunan / k.length >= 0.5;
}

// ---------------------------------------------------------------- kişisel veri

export function tcknGecerli(no: string): boolean {
    if (!/^[1-9]\d{10}$/.test(no)) return false;
    const d = no.split("").map(Number);
    const tek = d[0] + d[2] + d[4] + d[6] + d[8];
    const cift = d[1] + d[3] + d[5] + d[7];
    const d10 = (((tek * 7 - cift) % 10) + 10) % 10;
    const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
    return d[9] === d10 && d[10] === d11;
}

const maskele = (tur: KisiselVeriTuru, v: string): string => {
    const rakam = v.replace(/\D/g, "");
    if (tur === "tckn") return `${rakam.slice(0, 2)}*******${rakam.slice(-2)}`;
    if (tur === "telefon") return `${rakam.startsWith("90") ? "+90 " : ""}*** *** ** ${rakam.slice(-2)}`;
    if (tur === "iban") return `TR** **** **** **** **** **** ${rakam.slice(-2)}`;
    const [ad, alan] = v.split("@");
    return `${ad.slice(0, 1)}***@${alan}`;
};

const DESENLER: { tur: KisiselVeriTuru; re: RegExp; dogrula?: (m: string) => boolean }[] = [
    { tur: "iban", re: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi },
    { tur: "eposta", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { tur: "tckn", re: /(?<!\d)[1-9]\d{10}(?!\d)/g, dogrula: tcknGecerli },
    // Cep ve sabit hat: 05xx / 0xxx ile başlayan 10-11 haneli numaralar (boşluk, tire, parantezli yazımlar)
    // Sınır: önünde/arkasında rakam ya da "1.250" gibi sayı devamı olmamalı; cümle noktalaması (", 0532 …,") serbest.
    { tur: "telefon", re: /(?<!\d)(?<!\d[.,])(?:\+90[\s-]?)?\(?0?[2-5]\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d|[.,]\d)/g },
];

/** Metindeki kişisel verileri bulur (aynı değer bir kez listelenir). */
export function kisiselVeriBul(metin: string): KisiselVeri[] {
    const bulunan = new Map<string, KisiselVeri>();
    let kalan = metin;
    for (const { tur, re, dogrula } of DESENLER) {
        kalan = kalan.replace(re, m => {
            const ham = m.trim();
            if (tur === "telefon" && ham.replace(/\D/g, "").length < 10) return m;
            if (dogrula && !dogrula(ham.replace(/\D/g, ""))) return m;
            const anahtar = `${tur}:${ham.replace(/\s/g, "")}`;
            if (!bulunan.has(anahtar)) bulunan.set(anahtar, { tur, deger: ham, maskeli: maskele(tur, ham) });
            return " ".repeat(m.length); // bir değer iki türe birden sayılmasın (IBAN içindeki rakamlar vb.)
        });
    }
    return Array.from(bulunan.values());
}

const kacisRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Metindeki (düz metin) kişisel verileri maskeler. */
export function metniKarart(metin: string, veriler: KisiselVeri[]): string {
    let sonuc = metin;
    for (const v of [...veriler].sort((a, b) => b.deger.length - a.deger.length)) {
        sonuc = sonuc.replace(new RegExp(kacisRe(v.deger), "g"), v.maskeli);
    }
    return sonuc;
}

/** HTML içindeki metin düğümlerinde karartma yapar; biçim (kalın, tablo vb.) korunur. */
export function htmlKarart(html: string, veriler: KisiselVeri[]): string {
    if (typeof DOMParser === "undefined") return metniKarart(html, veriler);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const yuru = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const dugumler: Text[] = [];
    while (yuru.nextNode()) dugumler.push(yuru.currentNode as Text);
    dugumler.forEach(d => { d.data = metniKarart(d.data, veriler); });
    return doc.body.innerHTML;
}

// ---------------------------------------------------------------- kalite kontrolü

export interface KontrolGirdisi {
    raporMetni: string; // düz metin
    tenkitler: Tenkit[];
    sorular: { id: string; text: string }[];
    form: Record<string, any>;
    fotoSayisi: number;
    bugun?: Date;
}

const YER_TUTUCULAR: { re: RegExp; ad: string }[] = [
    { re: /\[[^\]\n]{0,60}\]/g, ad: "köşeli parantez" },
    { re: /\{\{[^}]*\}\}/g, ad: "şablon alanı" },
    { re: /\bX{3,}\b|\bx{3,}\b/g, ad: "XXX" },
    { re: /\.{5,}|…{2,}/g, ad: "noktalı boşluk" },
    { re: /\b(?:Örn|Örneğin)\s*:/g, ad: "örnek ifadesi" },
];

export function raporuKontrolEt(g: KontrolGirdisi): Bulgu[] {
    const b: Bulgu[] = [];
    const metin = g.raporMetni || "";
    const metinVar = metin.trim().length > 50;

    // 1) Kontrol listesinde "Hayır" olup tenkit olarak işlenmemiş maddeler
    const refler = new Set(g.tenkitler.map(t => t.kaynak_ref).filter(Boolean));
    const islenmemis = g.sorular.filter(q => g.form?.[q.id] === "no" && !refler.has(q.id));
    if (islenmemis.length) {
        b.push({
            duzey: "uyari",
            baslik: `Kontrol listesinde "Hayır" olan ${islenmemis.length} madde tenkit listesinde yok`,
            ayrinti: islenmemis.slice(0, 5).map(q => `• ${q.text}`).join("\n") + (islenmemis.length > 5 ? `\n… ve ${islenmemis.length - 5} madde daha` : ""),
            hedef: "tenkit_takibi",
        });
    }
    const cevapsiz = g.sorular.filter(q => g.form?.[q.id] !== "yes" && g.form?.[q.id] !== "no").length;
    if (g.sorular.length && cevapsiz) {
        b.push({ duzey: "bilgi", baslik: `Kontrol listesinde cevaplanmamış ${cevapsiz} madde var`, hedef: "checklist" });
    }

    // 2) Tenkit kalitesi
    const kanitsiz = g.tenkitler.filter(t => t.onem !== "bilgi" && !(t.kanitlar || []).length);
    if (kanitsiz.length) {
        b.push({
            duzey: kanitsiz.some(t => t.onem === "kritik") ? "hata" : "uyari",
            baslik: `${kanitsiz.length} tenkitin kanıtı yok`,
            ayrinti: kanitsiz.slice(0, 5).map(t => `• ${t.baslik}`).join("\n"),
            hedef: "tenkit_takibi",
        });
    }
    const dayanaksiz = g.tenkitler.filter(t => t.onem !== "bilgi" && !(t.dayanak || "").trim());
    if (dayanaksiz.length) {
        b.push({
            duzey: "uyari",
            baslik: `${dayanaksiz.length} tenkitte mevzuat dayanağı boş`,
            ayrinti: dayanaksiz.slice(0, 5).map(t => `• ${t.baslik}`).join("\n"),
            hedef: "tenkit_takibi",
        });
    }
    const aciklamasiz = g.tenkitler.filter(t => !(t.aciklama || "").trim());
    if (aciklamasiz.length) {
        b.push({ duzey: "bilgi", baslik: `${aciklamasiz.length} tenkitte tespit/açıklama yazılmamış`, hedef: "tenkit_takibi" });
    }

    if (!metinVar) {
        b.push({ duzey: "bilgi", baslik: "Rapor metni boş: metin kontrolleri ve kişisel veri taraması yapılamadı", hedef: "metin" });
        return b;
    }

    // 3) Tenkitler raporda geçiyor mu?
    const metinKokleri = new Set(kokler(metin));
    const eksik = g.tenkitler.filter(t => !metindeGeciyor(t.baslik, metinKokleri));
    if (eksik.length) {
        b.push({
            duzey: "uyari",
            baslik: `${eksik.length} tenkit rapor metninde bulunamadı`,
            ayrinti: "Anahtar kelimeleri raporda geçmiyor; farklı ifade edilmiş olabilir, kontrol edin:\n" + eksik.slice(0, 6).map(t => `• ${t.baslik}`).join("\n"),
            hedef: "tenkit_takibi",
        });
    }

    // 4) Fotoğraf atıfları
    const atiflar = Array.from(metin.matchAll(/Foto(?:ğraf)?\s*(?:No\.?\s*)?:?\s*(\d{1,3})/gi)).map(m => Number(m[1]));
    const olmayan = Array.from(new Set(atiflar.filter(n => n < 1 || n > g.fotoSayisi))).sort((a, c) => a - c);
    if (olmayan.length) {
        b.push({
            duzey: "hata",
            baslik: `Raporda olmayan fotoğrafa atıf var: ${olmayan.map(n => `Fotoğraf ${n}`).join(", ")}`,
            ayrinti: `Galeride ${g.fotoSayisi} fotoğraf var.`,
            hedef: "photos",
        });
    }

    // 5) Doldurulmamış şablon yerleri
    const yerler: string[] = [];
    for (const { re } of YER_TUTUCULAR) for (const m of metin.matchAll(re)) yerler.push(m[0].trim());
    if (yerler.length) {
        const benzersiz = Array.from(new Set(yerler));
        b.push({
            duzey: "hata",
            baslik: `Doldurulmamış ${yerler.length} şablon yeri olabilir`,
            ayrinti: benzersiz.slice(0, 8).map(y => `• ${y.length > 50 ? y.slice(0, 50) + "…" : y}`).join("\n"),
            hedef: "metin",
        });
    }

    // 6) İleri tarih
    const bugun = g.bugun || new Date();
    const ileri = Array.from(metin.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g))
        .map(m => ({ s: m[0], d: new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) }))
        .filter(x => !Number.isNaN(x.d.getTime()) && x.d.getTime() - bugun.getTime() > 24 * 3600 * 1000);
    if (ileri.length) {
        b.push({
            duzey: "uyari",
            baslik: `Bugünden sonraki tarih var: ${Array.from(new Set(ileri.map(x => x.s))).slice(0, 4).join(", ")}`,
            ayrinti: "Yazım hatası olabilir (ör. yıl). Süre verilen bir tarihse sorun yok.",
            hedef: "metin",
        });
    }

    // 7) Kişisel veri
    const kv = kisiselVeriBul(metin);
    if (kv.length) {
        const sayim = kv.reduce((a, v) => ({ ...a, [v.tur]: (a[v.tur] || 0) + 1 }), {} as Record<string, number>);
        b.push({
            duzey: "uyari",
            baslik: `Kişisel veri bulundu: ${Object.entries(sayim).map(([t, n]) => `${n} ${KISISEL_VERI_ETIKETI[t as KisiselVeriTuru]}`).join(", ")}`,
            ayrinti: "Rapor paylaşılacaksa aşağıdan karartılmış kopyasını alın.",
            hedef: "metin",
        });
    }

    return b;
}
