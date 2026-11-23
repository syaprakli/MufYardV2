/**
 * Saha fotoğrafına tarih/konum damgası.
 *
 * Tarih ve konum önce fotoğrafın kendi EXIF bilgisinden (telefonla çekilmişse çekim anı ve GPS),
 * yoksa cihazdan (şu an + konum izni verilmişse cihaz konumu) alınır. Damga görselin altına
 * yazılır; aynı bilgi ayrıca `photo_meta` olarak saklanır. Orijinal dosya değiştirilmez.
 */

export interface FotoMeta {
    tarih: string;              // ISO
    tarih_kaynagi: "exif" | "cihaz";
    enlem?: number;
    boylam?: number;
    konum_kaynagi?: "exif" | "cihaz";
    damgali?: boolean;
}

const MAKS_KENAR = 2560;
const DAMGA_TERCIH_ANAHTARI = "mufyard_foto_damga";

export function damgaTercihi(): boolean {
    try {
        return localStorage.getItem(DAMGA_TERCIH_ANAHTARI) !== "0";
    } catch {
        return true;
    }
}

export function damgaTercihiKaydet(acik: boolean) {
    try {
        localStorage.setItem(DAMGA_TERCIH_ANAHTARI, acik ? "1" : "0");
    } catch {
        /* tarayıcı depolaması kapalı olabilir */
    }
}

export const tarihMetni = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const konumMetni = (m?: Partial<FotoMeta>) =>
    m && typeof m.enlem === "number" && typeof m.boylam === "number" ? `${m.enlem.toFixed(5)}, ${m.boylam.toFixed(5)}` : "";

export const haritaAdresi = (m?: Partial<FotoMeta>) =>
    m && typeof m.enlem === "number" && typeof m.boylam === "number"
        ? `https://www.openstreetmap.org/?mlat=${m.enlem}&mlon=${m.boylam}#map=18/${m.enlem}/${m.boylam}`
        : "";

// EXIF okuyucu ayrı bir parça olarak yüklenir. Sayfa açılır açılmaz (internet varken) indirilir;
// aksi halde sahada internet yokken ilk fotoğrafta indirilemez ve tarih/konum okunamaz.
let exifrSozu: Promise<typeof import("exifr")> | null = null;
const exifrYukle = () => {
    if (!exifrSozu) {
        exifrSozu = import("exifr");
        exifrSozu.catch(() => { exifrSozu = null; }); // başarısızsa sonra yeniden denensin
    }
    return exifrSozu;
};
if (typeof window !== "undefined") void exifrYukle().catch(() => undefined);

async function exifOku(file: Blob): Promise<{ tarih?: Date; enlem?: number; boylam?: number }> {
    try {
        const { default: exifr } = await exifrYukle();
        // Not: "latitude/longitude" hesaplanan alanlardır; `pick` ile istenemez, konum ayrıca exifr.gps ile okunur.
        const [veri, gps]: any[] = await Promise.all([
            exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null),
            exifr.gps(file).catch(() => null),
        ]);
        const tarihHam = veri?.DateTimeOriginal instanceof Date ? veri.DateTimeOriginal : veri?.CreateDate instanceof Date ? veri.CreateDate : undefined;
        const enlem = gps?.latitude, boylam = gps?.longitude;
        const konumVar = typeof enlem === "number" && typeof boylam === "number" && Number.isFinite(enlem) && Number.isFinite(boylam)
            && !(enlem === 0 && boylam === 0);
        return {
            tarih: tarihHam && !Number.isNaN(tarihHam.getTime()) ? tarihHam : undefined,
            enlem: konumVar ? enlem : undefined,
            boylam: konumVar ? boylam : undefined,
        };
    } catch {
        return {};
    }
}

let sonCihazKonumu: { enlem: number; boylam: number; zaman: number } | null = null;

/** Cihaz konumu (izin yoksa / masaüstünde konum servisi yoksa sessizce boş döner). */
async function cihazKonumu(): Promise<{ enlem: number; boylam: number } | null> {
    if (sonCihazKonumu && Date.now() - sonCihazKonumu.zaman < 2 * 60 * 1000) return sonCihazKonumu;
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise(resolve => {
        const zamanAsimi = window.setTimeout(() => resolve(null), 8000);
        navigator.geolocation.getCurrentPosition(
            pos => {
                window.clearTimeout(zamanAsimi);
                sonCihazKonumu = { enlem: pos.coords.latitude, boylam: pos.coords.longitude, zaman: Date.now() };
                resolve(sonCihazKonumu);
            },
            () => { window.clearTimeout(zamanAsimi); resolve(null); },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 120000 },
        );
    });
}

/** Fotoğrafın tarih/konum bilgisi (damga basmadan). */
export async function fotoMetaOku(file: Blob): Promise<FotoMeta> {
    const exif = await exifOku(file);
    const meta: FotoMeta = exif.tarih
        ? { tarih: exif.tarih.toISOString(), tarih_kaynagi: "exif" }
        : { tarih: new Date().toISOString(), tarih_kaynagi: "cihaz" };
    if (exif.enlem !== undefined && exif.boylam !== undefined) {
        meta.enlem = exif.enlem;
        meta.boylam = exif.boylam;
        meta.konum_kaynagi = "exif";
    } else {
        const k = await cihazKonumu();
        if (k) {
            meta.enlem = k.enlem;
            meta.boylam = k.boylam;
            meta.konum_kaynagi = "cihaz";
        }
    }
    return meta;
}

async function gorselYukle(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === "function") {
        try {
            // EXIF yönünü uygular (telefon fotoğrafları yan dönmesin)
            return await createImageBitmap(file, { imageOrientation: "from-image" } as any);
        } catch {
            /* aşağıdaki yönteme düş */
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Fotoğrafa damga basar; büyük fotoğrafları 2560 px'e küçültür (sahada yükleme süresi için).
 * Görsel çözülemezse (ör. HEIC) orijinal dosya damgasız döner.
 */
export async function fotoDamgala(file: File, ekSatir?: string): Promise<{ blob: Blob; ad: string; meta: FotoMeta }> {
    const meta = await fotoMetaOku(file);
    try {
        const gorsel = await gorselYukle(file);
        const gw = "naturalWidth" in gorsel ? gorsel.naturalWidth : gorsel.width;
        const gh = "naturalHeight" in gorsel ? gorsel.naturalHeight : gorsel.height;
        const oran = Math.min(1, MAKS_KENAR / Math.max(gw, gh));
        const w = Math.round(gw * oran);
        const h = Math.round(gh * oran);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas yok");
        ctx.drawImage(gorsel as CanvasImageSource, 0, 0, w, h);
        if ("close" in gorsel && typeof gorsel.close === "function") gorsel.close();

        const satirlar = [
            `${tarihMetni(meta.tarih)}${meta.tarih_kaynagi === "cihaz" ? " (yükleme)" : ""}`,
            konumMetni(meta) ? `Konum: ${konumMetni(meta)}` : "",
            ekSatir || "",
        ].filter(Boolean);
        const font = Math.max(14, Math.round(Math.min(w, h) * 0.028));
        const pad = Math.round(font * 0.6);
        ctx.font = `600 ${font}px Arial, sans-serif`;
        const genislik = Math.max(...satirlar.map(s => ctx.measureText(s).width)) + pad * 2;
        const yukseklik = satirlar.length * font * 1.3 + pad * 1.4;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(w - genislik - pad, h - yukseklik - pad, genislik, yukseklik);
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "top";
        satirlar.forEach((s, i) => ctx.fillText(s, w - genislik - pad + pad, h - yukseklik - pad + pad * 0.7 + i * font * 1.3));

        const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.88));
        if (!blob) throw new Error("kodlanamadı");
        const ad = (file.name || "foto").replace(/\.[^.]+$/, "") + "_damgali.jpg";
        return { blob, ad, meta: { ...meta, damgali: true } };
    } catch {
        return { blob: file, ad: file.name || "foto.jpg", meta };
    }
}
