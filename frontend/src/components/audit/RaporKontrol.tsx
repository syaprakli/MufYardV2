import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardCopy, Download, Info, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { fetchTenkitler, type Tenkit } from "../../lib/api/tenkitler";
import { sanitizeHtml, escapeHtml } from "../../lib/sanitize";
import {
    htmlKarart, htmlToText, KISISEL_VERI_ETIKETI, kisiselVeriBul, raporuKontrolEt,
    type Bulgu, type BulguHedefi,
} from "../../lib/raporKontrol";

interface Props {
    auditId?: string | null;
    /** Uygulamadaki rapor (HTML) */
    raporHtml: string;
    questions: { id: string; text: string }[];
    form: Record<string, any>;
    fotoSayisi: number;
    dosyaAdi: string;
    onGit?: (hedef: BulguHedefi) => void;
}

const DUZEY: Record<Bulgu["duzey"], { ikon: typeof AlertCircle; renk: string; ad: string }> = {
    hata: { ikon: AlertCircle, renk: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40", ad: "Düzeltilmeli" },
    uyari: { ikon: AlertTriangle, renk: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40", ad: "Kontrol edin" },
    bilgi: { ikon: Info, renk: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300", ad: "Bilgi" },
};
const HEDEF_ADI: Record<BulguHedefi, string> = {
    tenkit_takibi: "Tenkitlere git",
    checklist: "Kontrol listesine git",
    photos: "Fotoğraflara git",
    metin: "",
};

export function RaporKontrol({ auditId, raporHtml, questions, form, fotoSayisi, dosyaAdi, onGit }: Props) {
    const [tenkitler, setTenkitler] = useState<Tenkit[]>([]);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [kaynak, setKaynak] = useState<"uygulama" | "yapistir">(raporHtml?.trim() ? "uygulama" : "yapistir");
    const [yapistirilanHtml, setYapistirilanHtml] = useState("");
    const [yenile, setYenile] = useState(0);

    useEffect(() => {
        if (!auditId) return;
        let iptal = false;
        setYukleniyor(true);
        fetchTenkitler(auditId)
            .then(l => { if (!iptal) setTenkitler(l); })
            .catch(() => { if (!iptal) toast.error("Tenkitler alınamadı; tenkit kontrolleri eksik kalabilir."); })
            .finally(() => { if (!iptal) setYukleniyor(false); });
        return () => { iptal = true; };
    }, [auditId, yenile]);

    const html = kaynak === "uygulama" ? raporHtml || "" : yapistirilanHtml;
    const metin = useMemo(() => htmlToText(html), [html]);
    const bulgular = useMemo(
        () => raporuKontrolEt({ raporMetni: metin, tenkitler, sorular: questions, form, fotoSayisi }),
        [metin, tenkitler, questions, form, fotoSayisi],
    );
    const kisiselVeriler = useMemo(() => kisiselVeriBul(metin), [metin]);
    const sayi = (d: Bulgu["duzey"]) => bulgular.filter(b => b.duzey === d).length;

    const yapistir = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const h = e.clipboardData.getData("text/html");
        const t = e.clipboardData.getData("text/plain");
        setYapistirilanHtml(h ? sanitizeHtml(h) : t.split(/\r?\n/).map(s => `<p>${escapeHtml(s)}</p>`).join(""));
    };

    const karartilmis = () => sanitizeHtml(htmlKarart(html, kisiselVeriler));

    const panoyaKopyala = async () => {
        const h = karartilmis();
        try {
            await navigator.clipboard.write([new ClipboardItem({
                "text/html": new Blob([h], { type: "text/html" }),
                "text/plain": new Blob([htmlToText(h)], { type: "text/plain" }),
            })]);
            toast.success("Karartılmış metin kopyalandı.");
        } catch {
            toast.error("Panoya kopyalanamadı.");
        }
    };

    const wordIndir = () => {
        const govde = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(dosyaAdi)}</title></head><body>${karartilmis()}</body></html>`;
        const blob = new Blob(["﻿", govde], { type: "application/msword" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${dosyaAdi.replace(/[\\/:*?"<>|]+/g, "_")}_karartilmis.doc`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Kaynak seçimi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-900">
                    {([["uygulama", "Uygulamadaki rapor"], ["yapistir", "Word'den yapıştır"]] as const).map(([k, ad]) => (
                        <button key={k} type="button" onClick={() => setKaynak(k)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${kaynak === k ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-500"}`}>
                            {ad}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    {kaynak === "yapistir" && yapistirilanHtml && (
                        <button type="button" onClick={() => setYapistirilanHtml("")}
                            className="text-[11px] font-bold text-slate-500 hover:text-rose-600">
                            Yapıştırılanı temizle
                        </button>
                    )}
                    <button type="button" onClick={() => setYenile(v => v + 1)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-blue-600">
                        {yukleniyor ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Yeniden kontrol et
                    </button>
                </div>
            </div>

            {kaynak === "yapistir" && (
                <div
                    contentEditable
                    suppressContentEditableWarning
                    onPaste={yapistir}
                    // Alan yalnızca yapıştırma içindir: elle yazma/silme React durumunu bozmasın
                    onKeyDown={e => {
                        const gezinme = ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
                        if (!(e.ctrlKey || e.metaKey) && !gezinme.includes(e.key)) e.preventDefault();
                    }}
                    onCut={e => e.preventDefault()}
                    onDrop={e => e.preventDefault()}
                    className="min-h-[120px] max-h-[260px] overflow-y-auto rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 outline-none focus:border-blue-400"
                    data-placeholder="Rapor metnini buraya yapıştırın (Ctrl+V)"
                    dangerouslySetInnerHTML={{
                        __html: yapistirilanHtml || '<p style="color:#94a3b8">Rapor metnini Word\'den kopyalayıp buraya yapıştırın (Ctrl+V). Metin yalnızca bu bilgisayarda incelenir, sunucuya gönderilmez.</p>',
                    }}
                />
            )}

            {/* Özet */}
            <div className="grid grid-cols-3 gap-3">
                {(["hata", "uyari", "bilgi"] as const).map(d => {
                    const I = DUZEY[d].ikon;
                    return (
                        <div key={d} className={`rounded-2xl border p-3 flex items-center gap-3 ${DUZEY[d].renk}`}>
                            <I size={18} />
                            <div>
                                <p className="text-xl font-black leading-none">{sayi(d)}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{DUZEY[d].ad}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bulgular */}
            {bulgular.length === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-emerald-700 text-sm font-bold">
                    <CheckCircle2 size={18} /> Kontrollerde bir sorun bulunmadı.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {bulgular.map((b, i) => {
                        const I = DUZEY[b.duzey].ikon;
                        return (
                            <div key={i} className={`rounded-2xl border p-3.5 ${DUZEY[b.duzey].renk}`}>
                                <div className="flex items-start gap-2.5">
                                    <I size={16} className="mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black">{b.baslik}</p>
                                        {b.ayrinti && <p className="text-[11px] mt-1 whitespace-pre-line opacity-90">{b.ayrinti}</p>}
                                    </div>
                                    {b.hedef && b.hedef !== "metin" && onGit && (
                                        <button type="button" onClick={() => onGit(b.hedef!)}
                                            className="text-[10px] font-bold underline shrink-0">
                                            {HEDEF_ADI[b.hedef]}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Kişisel veri karartma */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Kişisel veri karartma</h4>
                </div>
                {!metin.trim() ? (
                    <p className="text-xs text-slate-400">Taranacak metin yok.</p>
                ) : kisiselVeriler.length === 0 ? (
                    <p className="text-xs text-emerald-600 font-semibold">T.C. kimlik no, telefon, e-posta veya IBAN bulunamadı.</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="text-left text-slate-400">
                                        <th className="py-1 pr-3 font-bold">Tür</th>
                                        <th className="py-1 pr-3 font-bold">Metinde</th>
                                        <th className="py-1 font-bold">Karartılmış</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {kisiselVeriler.map((v, i) => (
                                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                                            <td className="py-1.5 pr-3 font-bold text-slate-600 dark:text-slate-300">{KISISEL_VERI_ETIKETI[v.tur]}</td>
                                            <td className="py-1.5 pr-3 font-mono text-slate-700 dark:text-slate-200">{v.deger}</td>
                                            <td className="py-1.5 font-mono text-blue-600">{v.maskeli}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={panoyaKopyala}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                                <ClipboardCopy size={13} /> Karartılmış metni kopyala
                            </button>
                            <button type="button" onClick={wordIndir}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                                <Download size={13} /> Karartılmış Word indir
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Kişi adları otomatik bulunamaz; paylaşmadan önce adları ayrıca kontrol edin. Uygulamadaki rapor değiştirilmez, yalnızca kopyası karartılır.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
