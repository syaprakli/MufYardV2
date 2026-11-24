/**
 * İfade tutanağını kullanıcının Word şablonunu (ifade tutanagi ornegi.docx) doldurarak .docx olarak üretir.
 * Başlık, yazı tipleri, kenar boşlukları ve paragraf biçimleri şablondan gelir; yalnızca içerik değişir.
 */
import JSZip from "jszip";
import type { Tutanak } from "./api/tutanaklar";
import { IFADE_SABLON_B64 } from "./sablonlar/ifadeTutanagiSablon";
import { girisMetni, ifadeVeren, imzaUnvani, kimlikSatirlari } from "./ifadeMetni";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const el = (doc: Document, ad: string) => doc.createElementNS(W, `w:${ad}`);
const cocuklar = (n: Element, ad: string) => Array.from(n.childNodes).filter(c => (c as Element).localName === ad) as Element[];
const metin = (p: Element) => Array.from(p.getElementsByTagNameNS(W, "t")).map(t => t.textContent || "").join("");

/** Metni (sekme ve satır sonlarıyla) bir koşuya (w:r) çevirir; biçim (rPr) prototipten kopyalanır. */
function kosu(doc: Document, yazi: string, rPr?: Element | null, kalin?: boolean): Element {
    const r = el(doc, "r");
    let pr = rPr ? (rPr.cloneNode(true) as Element) : null;
    if (kalin !== undefined) {
        pr = pr || el(doc, "rPr");
        cocuklar(pr, "b").concat(cocuklar(pr, "bCs")).forEach(b => pr!.removeChild(b));
        if (kalin) pr.insertBefore(el(doc, "b"), pr.firstChild);
    }
    if (pr) r.appendChild(pr);
    yazi.split("\n").forEach((satir, i) => {
        if (i > 0) r.appendChild(el(doc, "br"));
        satir.split("\t").forEach((parca, j) => {
            if (j > 0) r.appendChild(el(doc, "tab"));
            if (parca) {
                const t = el(doc, "t");
                t.setAttributeNS(XML_NS, "xml:space", "preserve");
                t.textContent = parca;
                r.appendChild(t);
            }
        });
    });
    return r;
}

const ilkRPr = (p: Element) => {
    const r = p.getElementsByTagNameNS(W, "r")[0];
    return r ? cocuklar(r, "rPr")[0] || null : null;
};

/** Paragrafın içeriğini siler (biçimi, pPr, kalır) ve yeni koşuları ekler. */
function paragrafYaz(p: Element, kosular: Element[]) {
    Array.from(p.childNodes).forEach(c => { if ((c as Element).localName !== "pPr") p.removeChild(c); });
    kosular.forEach(k => p.appendChild(k));
}

/** Paragrafı metinle doldurur; metin birden çok satırsa aynı biçimde ardışık paragraflar oluşturur. */
function paragraflaraBol(doc: Document, p: Element, yazi: string) {
    const rPr = ilkRPr(p);
    const [ilk = "", ...devam] = yazi.trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
    paragrafYaz(p, [kosu(doc, ilk, rPr, false)]);
    let onceki = p;
    devam.forEach(l => {
        const yeni = bosParagraf(doc, p);
        yeni.appendChild(kosu(doc, l, rPr, false));
        onceki.parentNode!.insertBefore(yeni, onceki.nextSibling);
        onceki = yeni;
    });
}

function bosParagraf(doc: Document, prototip: Element): Element {
    const p = el(doc, "p");
    const pPr = cocuklar(prototip, "pPr")[0];
    if (pPr) p.appendChild(pPr.cloneNode(true));
    return p;
}

function imzaTablosu(doc: Document, t: Tutanak, rPr: Element | null): Element {
    // İfade veren önce, sonra müfettişler, sonra diğerleri; satır başına en fazla 3 kişi
    const sira = { ifade_veren: 0, mufettis: 1 } as Record<string, number>;
    const kisiler = [...(t.kisiler || [])].sort((a, b) => (sira[a.rol] ?? 2) - (sira[b.rol] ?? 2));
    const tbl = el(doc, "tbl");
    const tblPr = el(doc, "tblPr");
    const tblW = el(doc, "tblW");
    tblW.setAttributeNS(W, "w:w", "5000");
    tblW.setAttributeNS(W, "w:type", "pct");
    tblPr.appendChild(tblW);
    const jc = el(doc, "jc");
    jc.setAttributeNS(W, "w:val", "center");
    tblPr.appendChild(jc);
    tbl.appendChild(tblPr);
    const SUTUN = Math.min(3, Math.max(1, kisiler.length));
    const grid = el(doc, "tblGrid");
    for (let i = 0; i < SUTUN; i++) {
        const gc = el(doc, "gridCol");
        gc.setAttributeNS(W, "w:w", String(Math.floor(9072 / SUTUN)));
        grid.appendChild(gc);
    }
    tbl.appendChild(grid);
    const satirP = (yazi: string, kalin = false) => {
        const p = el(doc, "p");
        const pPr = el(doc, "pPr");
        const pj = el(doc, "jc");
        pj.setAttributeNS(W, "w:val", "center");
        pPr.appendChild(pj);
        p.appendChild(pPr);
        if (yazi) p.appendChild(kosu(doc, yazi, rPr, kalin));
        return p;
    };
    for (let i = 0; i < kisiler.length; i += SUTUN) {
        const tr = el(doc, "tr");
        for (let j = 0; j < SUTUN; j++) {
            const k = kisiler[i + j];
            const tc = el(doc, "tc");
            const tcPr = el(doc, "tcPr");
            const tcW = el(doc, "tcW");
            tcW.setAttributeNS(W, "w:w", String(Math.floor(9072 / SUTUN)));
            tcW.setAttributeNS(W, "w:type", "dxa");
            tcPr.appendChild(tcW);
            tc.appendChild(tcPr);
            // İmza yeri (boşluk) → ad soyad → unvan
            tc.appendChild(satirP(""));
            tc.appendChild(satirP(""));
            tc.appendChild(satirP(k ? (k.ad || "…") : ""));
            tc.appendChild(satirP(k ? imzaUnvani(k) : "", true));
            tr.appendChild(tc);
        }
        tbl.appendChild(tr);
    }
    return tbl;
}

export async function ifadeDocxUret(t: Tutanak): Promise<Blob> {
    const zip = await JSZip.loadAsync(IFADE_SABLON_B64, { base64: true });
    const xml = await zip.file("word/document.xml")!.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const paragraflar = () => cocuklar(body, "p");
    const bul = (bas: string) => paragraflar().find(p => metin(p).replace(/^\s+/, "").startsWith(bas));

    // 1) Kimlik satırları: "XXX" değerinin yerine bilgi yazılır, etiket ve sekmeler korunur
    const kisi = ifadeVeren(t);
    const SABLON_ETIKET: Record<string, string> = { "Doğum Yeri ve Yılı": "Doğum Yeri ve" };
    for (const [etiket, deger] of kimlikSatirlari(kisi)) {
        const p = bul(SABLON_ETIKET[etiket] || etiket);
        if (!p) continue;
        const kosular = Array.from(p.getElementsByTagNameNS(W, "r"));
        const i = kosular.findIndex(r => /X{2,}/.test(metin(r)));
        if (i < 0) continue;
        const ts = kosular[i].getElementsByTagNameNS(W, "t");
        // Şablonda "XXX" ile aynı parçadaki baştaki boşluk korunur (": XXX" → ": Ali Veli")
        const bosluk = (ts[0].textContent || "").match(/^\s*/)![0];
        const oncekiMetin = kosular.slice(0, i).map(metin).join("");
        ts[0].textContent = (bosluk || (/:\s*$/.test(oncekiMetin) && !/\s$/.test(oncekiMetin) ? " " : "")) + deger;
        ts[0].setAttributeNS(XML_NS, "xml:space", "preserve");
        Array.from(ts).slice(1).forEach(x => x.parentNode!.removeChild(x));
        kosular.slice(i + 1).forEach(r => r.parentNode!.removeChild(r));
    }

    // 2) Giriş paragrafı
    const giris = bul("Yukarıda açık kimliği");
    if (giris) paragraflaraBol(doc, giris, girisMetni(t));

    // 3) SORU/CEVAP bölümü: şablondaki örnekler silinip tutanaktaki sorularla yeniden yazılır
    const tum = paragraflar();
    const ilkSoru = tum.findIndex(p => /^\s*SORU\s*1\)/.test(metin(p)));
    let sonCevap = -1;
    tum.forEach((p, i) => { if (/^\s*CEVAP\s*\d/.test(metin(p))) sonCevap = i; });
    if (ilkSoru >= 0 && sonCevap >= ilkSoru) {
        const soruP = tum[ilkSoru];
        const cevapP = tum.find(p => /^\s*CEVAP\s*1/.test(metin(p))) || soruP;
        const cevapKosulari = cevapP.getElementsByTagNameNS(W, "r");
        const etiketRPr = cocuklar(cevapKosulari[0], "rPr")[0] || null;
        const cevapRPr = cocuklar(cevapKosulari[cevapKosulari.length - 1], "rPr")[0] || null;
        const soruRPr = ilkRPr(soruP);
        const sonraki = tum[sonCevap].nextSibling;
        const yeni: Element[] = [];
        const sorular = (t.sorular || []).filter(s => s.soru.trim() || s.cevap.trim());
        // Çok satırlı metin ayrı paragraflara bölünür: iki yana yaslı paragrafta satır sonu (w:br)
        // kullanılırsa Word o satırdaki kelimeleri sayfa boyunca yayar.
        const satirlar = (x: string) => x.trim().split(/\n+/).map(l => l.trim()).filter(Boolean);
        sorular.forEach((s, i) => {
            const [soru1 = "", ...soruDevam] = satirlar(s.soru);
            const sp = bosParagraf(doc, soruP);
            sp.appendChild(kosu(doc, `SORU ${i + 1}) ${soru1}`, soruRPr, true));
            yeni.push(sp);
            soruDevam.forEach(l => { const p = bosParagraf(doc, soruP); p.appendChild(kosu(doc, l, soruRPr, true)); yeni.push(p); });
            yeni.push(bosParagraf(doc, soruP));
            const [cevap1 = "", ...cevapDevam] = satirlar(s.cevap);
            const cp = bosParagraf(doc, cevapP);
            cp.appendChild(kosu(doc, `CEVAP ${i + 1}) `, etiketRPr, true));
            cp.appendChild(kosu(doc, cevap1, cevapRPr, false));
            yeni.push(cp);
            cevapDevam.forEach(l => { const p = bosParagraf(doc, cevapP); p.appendChild(kosu(doc, l, cevapRPr, false)); yeni.push(p); });
            yeni.push(bosParagraf(doc, soruP));
        });
        tum.slice(ilkSoru, sonCevap + 1).forEach(p => body.removeChild(p));
        yeni.forEach(p => body.insertBefore(p, sonraki));
    }

    // 4) Kapanış
    const kapanis = bul("Durumu tespit eden");
    if (kapanis && (t.kapanis || "").trim()) paragraflaraBol(doc, kapanis, t.kapanis!);

    // 5) İmza satırı (şablonda sekmelerle hizalı tek satır) → hizası bozulmayan tablo
    const imza = paragraflar().find(p => metin(p).includes("İfade Veren"));
    if (imza) {
        body.insertBefore(imzaTablosu(doc, t, ilkRPr(kapanis || imza)), imza);
        body.removeChild(imza);
    }

    zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
    // Belge bilgisi: oluşturma zamanı
    const core = zip.file("docProps/core.xml");
    if (core) {
        const simdi = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        const c = (await core.async("string"))
            .replace(/(<dcterms:created[^>]*>)[^<]*/, `$1${simdi}`)
            .replace(/(<dcterms:modified[^>]*>)[^<]*/, `$1${simdi}`)
            .replace(/<cp:revision>[^<]*<\/cp:revision>/, "<cp:revision>1</cp:revision>")
            .replace(/<cp:lastPrinted>[^<]*<\/cp:lastPrinted>/, "");
        zip.file("docProps/core.xml", c);
    }
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
}
