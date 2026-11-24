/** Tutanağın resmî düzende HTML (yazdırma) ve Word çıktısı. İfade tutanağı kullanıcının şablonuna göredir. */
import { escapeHtml } from "./sanitize";
import { TUR_ADI, type Tutanak } from "./api/tutanaklar";
import { ifadeDocxUret } from "./ifadeDocx";
import { girisMetni, ifadeVeren, IFADE_KAPANIS_SABLON, imzaUnvani, kimlikSatirlari, tarihNoktali } from "./ifadeMetni";

const e = (s?: string | null) => escapeHtml(s || "");
const satirSonu = (s?: string | null) => e(s).replace(/\n/g, "<br>");

export const IFADE_KAPANIS = IFADE_KAPANIS_SABLON;

// Şablondaki başlık: T.C. / GENÇLİK VE SPOR BAKANLIĞI / MÜFETTİŞLİĞİ
const BASLIK = `
    <p style="text-align:center;font-weight:bold;margin:0">T.C.</p>
    <p style="text-align:center;font-weight:bold;margin:0">GENÇLİK VE SPOR BAKANLIĞI</p>
    <p style="text-align:center;font-weight:bold;margin:0 0 28pt">MÜFETTİŞLİĞİ</p>`;

function imzaTablosu(t: Tutanak) {
    const sira = { ifade_veren: 0, mufettis: 1 } as Record<string, number>;
    const kisiler = [...(t.kisiler || [])].sort((a, b) => (sira[a.rol] ?? 2) - (sira[b.rol] ?? 2));
    if (!kisiler.length) return "";
    const SUTUN = Math.min(3, kisiler.length);
    const satirlar: typeof kisiler[] = [];
    for (let i = 0; i < kisiler.length; i += SUTUN) satirlar.push(kisiler.slice(i, i + SUTUN));
    return `<table style="width:100%;margin-top:36pt;border-collapse:collapse">${satirlar.map(s => `<tr>${s.map(k => `
        <td style="text-align:center;vertical-align:top;padding:24pt 6pt 12pt;width:${Math.floor(100 / SUTUN)}%">
            ${e(k.ad) || "…"}<br><b>${e(imzaUnvani(k))}</b>
        </td>`).join("")}</tr>`).join("")}</table>`;
}

export function tutanakHtml(t: Tutanak): string {
    const kimlik = kimlikSatirlari(ifadeVeren(t)).map(([etiket, deger]) =>
        `<tr><td style="width:42%;padding:1pt 0">${e(etiket)}</td><td style="padding:1pt 0">: ${e(deger)}</td></tr>`).join("");
    const sorular = (t.sorular || []).filter(s => s.soru.trim() || s.cevap.trim()).map((s, i) => `
        <p style="text-align:justify;margin:12pt 0 0"><b>SORU ${i + 1}) ${satirSonu(s.soru.trim())}</b></p>
        <p style="text-align:justify;margin:12pt 0 0"><b>CEVAP ${i + 1})</b> ${satirSonu(s.cevap.trim())}</p>`).join("");
    return `${BASLIK}
        <p style="font-weight:bold;margin:0 0 12pt">İFADE TUTANAĞI:</p>
        <table style="border-collapse:collapse;margin:0 0 12pt">${kimlik}</table>
        <p style="text-align:justify;margin:0 0 8pt">${satirSonu(girisMetni(t))}</p>
        ${sorular}
        <p style="text-align:justify;margin:24pt 0 0">${satirSonu((t.kapanis || "").trim() || IFADE_KAPANIS_SABLON)}</p>
        ${imzaTablosu(t)}`;
}

export function tutanakDosyaAdi(t: Tutanak) {
    const kim = ifadeVeren(t)?.ad || t.baslik || "";
    return `${TUR_ADI[t.tur]}${kim ? "_" + kim : ""}_${tarihNoktali(t.tarih)}`.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

const belge = (baslik: string, govde: string) =>
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(baslik)}</title>
<style>@page{size:A4;margin:2.5cm} body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.3}</style></head><body>${govde}</body></html>`;

function indir(blob: Blob, ad: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** İfade tutanağı: kullanıcının Word şablonu doldurularak gerçek .docx. */
export async function tutanakWordIndir(t: Tutanak) {
    const ad = tutanakDosyaAdi(t);
    if (t.tur === "ifade") {
        indir(await ifadeDocxUret(t), `${ad}.docx`);
        return;
    }
    indir(new Blob(["﻿", belge(ad, tutanakHtml(t))], { type: "application/msword" }), `${ad}.doc`);
}

export function tutanakYazdir(t: Tutanak) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const d = iframe.contentDocument;
    if (!d) return iframe.remove();
    d.open();
    d.write(belge(tutanakDosyaAdi(t), tutanakHtml(t)));
    d.close();
    setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1000);
    }, 300);
}
