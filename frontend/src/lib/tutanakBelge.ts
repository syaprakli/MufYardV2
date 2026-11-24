/** Tutanağın resmî düzende HTML/Word çıktısı. */
import { escapeHtml } from "./sanitize";
import { ROL_ADI, TUR_ADI, type Tutanak } from "./api/tutanaklar";

const tarihYaz = (t?: string | null) => {
    if (!t) return "…/…/……";
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : t;
};
const e = (s?: string | null) => escapeHtml(s || "");
const paragraf = (s?: string | null) =>
    (s || "").split(/\n{2,}/).map(p => `<p style="text-align:justify;text-indent:1.25cm;margin:0 0 8pt">${e(p).replace(/\n/g, "<br>")}</p>`).join("");

export const IFADE_KAPANIS =
    "Başka bir diyeceğinin olup olmadığı soruldu: \"Başka diyeceğim yoktur.\" dedi. İş bu ifade tutanağı okunup içeriğinin doğru olduğu beyan edildikten sonra birlikte imza altına alındı.";
export const TESPIT_KAPANIS = "İş bu tutanak, yukarıdaki tespitleri doğrulamak üzere birlikte imza altına alındı.";
export const GORUSME_KAPANIS = "Görüşme sonunda tutanak okunarak birlikte imza altına alındı.";

export function tutanakHtml(t: Tutanak): string {
    const kisiler = t.kisiler || [];
    const ifadeVeren = kisiler.find(k => k.rol === "ifade_veren");
    const ust = `
        <p style="text-align:center;font-weight:bold;font-size:14pt;margin:0 0 4pt">${e(TUR_ADI[t.tur]).toLocaleUpperCase("tr-TR")}</p>
        ${t.baslik ? `<p style="text-align:center;margin:0 0 12pt">${e(t.baslik)}</p>` : ""}
        <table style="width:100%;border-collapse:collapse;margin:0 0 12pt;font-size:11pt">
            <tr><td style="width:28%;padding:2pt 0"><b>Tarih / Saat</b></td><td>: ${tarihYaz(t.tarih)}${t.saat ? ` – ${e(t.saat)}` : ""}</td></tr>
            <tr><td style="padding:2pt 0"><b>Yer</b></td><td>: ${e(t.yer) || "…"}</td></tr>
            ${t.konu ? `<tr><td style="padding:2pt 0;vertical-align:top"><b>Konu</b></td><td>: ${e(t.konu)}</td></tr>` : ""}
            ${ifadeVeren ? `<tr><td style="padding:2pt 0"><b>İfade veren</b></td><td>: ${e(ifadeVeren.ad)}${ifadeVeren.unvan ? `, ${e(ifadeVeren.unvan)}` : ""}${ifadeVeren.tckn ? ` (T.C. ${e(ifadeVeren.tckn)})` : ""}</td></tr>` : ""}
            ${ifadeVeren?.adres ? `<tr><td style="padding:2pt 0"><b>Adres</b></td><td>: ${e(ifadeVeren.adres)}</td></tr>` : ""}
        </table>`;

    const govde = t.tur === "ifade"
        ? paragraf(t.metin) + (t.sorular || []).filter(s => s.soru.trim() || s.cevap.trim()).map((s, i) => `
            <p style="margin:10pt 0 2pt"><b>SORULDU ${i + 1}:</b> ${e(s.soru).replace(/\n/g, "<br>")}</p>
            <p style="text-align:justify;margin:0 0 6pt"><b>CEVABEN:</b> ${e(s.cevap).replace(/\n/g, "<br>") || "…"}</p>`).join("")
        : paragraf(t.metin);

    // İmza blokları: satır başına en fazla 3 kişi
    const SATIR = 3;
    const satirlar: typeof kisiler[] = [];
    for (let i = 0; i < kisiler.length; i += SATIR) satirlar.push(kisiler.slice(i, i + SATIR));
    const hucre = (k: (typeof kisiler)[number]) => `
            <td style="text-align:center;vertical-align:top;padding:0 6pt 24pt;width:${Math.floor(100 / SATIR)}%">
                <b>${e(ROL_ADI[k.rol])}</b><br>${e(k.ad)}<br>${e(k.unvan)}<br><br><br>İmza
            </td>`;
    const imzalar = satirlar.length
        ? `<table style="width:100%;margin-top:28pt;border-collapse:collapse;font-size:11pt">${satirlar.map(s => `<tr>${s.map(hucre).join("")}</tr>`).join("")}</table>`
        : "";

    return `${ust}${govde}${t.kapanis ? paragraf(t.kapanis) : ""}${imzalar}`;
}

export function tutanakDosyaAdi(t: Tutanak) {
    const kim = (t.kisiler || []).find(k => k.rol === "ifade_veren")?.ad || t.baslik || "";
    return `${TUR_ADI[t.tur]}${kim ? "_" + kim : ""}_${tarihYaz(t.tarih)}`.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

const belge = (baslik: string, govde: string) =>
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(baslik)}</title>
<style>@page{size:A4;margin:2.5cm 2cm} body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.4}</style></head><body>${govde}</body></html>`;

export function tutanakWordIndir(t: Tutanak) {
    const ad = tutanakDosyaAdi(t);
    const blob = new Blob(["﻿", belge(ad, tutanakHtml(t))], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ad}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
