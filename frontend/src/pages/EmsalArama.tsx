import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Gavel, Loader2, RefreshCw, Search } from "lucide-react";
import { emsalAra, type EmsalSonucu } from "../lib/api/search";

const TURLER = ["İl Denetimi", "Spor Kulüpleri Denetimi", "Federasyon Denetimi", "Kyk Yurt Denetimi", "Özel Yurt Denetimi"];
const TUR_SEKME: Record<string, string> = {
    "İl Denetimi": "il", "Spor Kulüpleri Denetimi": "spor", "Federasyon Denetimi": "federasyon",
    "Kyk Yurt Denetimi": "kyk", "Özel Yurt Denetimi": "ozel",
};
const DURUM: Record<string, [string, string]> = {
    acik: ["Açık", "bg-rose-500/10 text-rose-600"],
    cevap_bekleniyor: ["Cevap bekleniyor", "bg-amber-500/10 text-amber-700"],
    giderildi: ["Giderildi", "bg-emerald-500/10 text-emerald-600"],
    kismen_giderildi: ["Kısmen giderildi", "bg-sky-500/10 text-sky-600"],
    giderilmedi: ["Giderilmedi", "bg-slate-500/10 text-slate-600"],
};

// Sunucunun normalleştirmesiyle aynı: Türkçe karakterler ve büyük/küçük harf eşlenir (uzunluk korunur)
const TR: Record<string, string> = { ı: "i", İ: "i", I: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u" };
const norm = (s: string) => Array.from(s).map(c => TR[c] ?? (c.toLowerCase()[0] || c)).join("");

/** Eşleşen yerleri <mark> ile vurgular (metin React ile kaçışlanır; HTML enjekte edilmez). */
function Vurgulu({ metin, terimler }: { metin: string; terimler: string[] }) {
    const parcalar = useMemo(() => {
        if (!metin || !terimler.length) return [{ t: metin, v: false }];
        const n = norm(metin);
        const isaret = new Array(metin.length).fill(false);
        terimler.forEach(x => {
            if (!x) return;
            let i = n.indexOf(x);
            while (i >= 0) {
                for (let k = i; k < i + x.length; k++) isaret[k] = true;
                i = n.indexOf(x, i + x.length);
            }
        });
        const out: { t: string; v: boolean }[] = [];
        for (let i = 0; i < metin.length; i++) {
            const son = out[out.length - 1];
            if (son && son.v === isaret[i]) son.t += metin[i];
            else out.push({ t: metin[i], v: isaret[i] });
        }
        return out;
    }, [metin, terimler]);
    return <>{parcalar.map((p, i) => (p.v ? <mark key={i} className="bg-yellow-200/70 dark:bg-yellow-500/30 text-inherit rounded-sm">{p.t}</mark> : <span key={i}>{p.t}</span>))}</>;
}

const tarihYaz = (t?: string) => {
    if (!t) return "";
    const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : String(t).slice(0, 10);
};

export default function EmsalArama() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const [q, setQ] = useState(params.get("q") || "");
    const [tur, setTur] = useState(params.get("tur") || "");
    const [sekme, setSekme] = useState<"hepsi" | "rapor" | "tenkit">("hepsi");
    const [sonuc, setSonuc] = useState<EmsalSonucu | null>(null);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [hata, setHata] = useState<string | null>(null);
    const istek = useRef(0);

    const ara = async (sorgu: string, raporTuru: string, yenile = false) => {
        if (sorgu.trim().length < 2) { setSonuc(null); return; }
        const no = ++istek.current;
        setYukleniyor(true);
        setHata(null);
        try {
            const s = await emsalAra(sorgu.trim(), raporTuru || undefined, yenile);
            if (no === istek.current) setSonuc(s);
        } catch (e: any) {
            if (no === istek.current) setHata(e?.message || "Arama yapılamadı.");
        } finally {
            if (no === istek.current) setYukleniyor(false);
        }
    };

    // Adres çubuğundaki sorgu (ör. tenkitten "Emsal ara" ile gelindiğinde) otomatik aranır
    useEffect(() => {
        const ilk = params.get("q");
        if (ilk && ilk.trim().length >= 2) void ara(ilk, params.get("tur") || "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const gonder = (e?: React.FormEvent) => {
        e?.preventDefault();
        const p: Record<string, string> = {};
        if (q.trim()) p.q = q.trim();
        if (tur) p.tur = tur;
        setParams(p, { replace: true });
        void ara(q, tur);
    };

    const raporAc = (auditId: string) => navigate(`/audit/${auditId}/report`);
    const denetimAc = (raporTuru?: string, taskId?: string | null) => {
        const s = raporTuru ? TUR_SEKME[raporTuru] : undefined;
        if (s && taskId) navigate(`/denetim/${s}?task_id=${encodeURIComponent(taskId)}`);
    };

    const terimler = sonuc?.terimler || [];
    const raporSay = sonuc?.toplam?.rapor ?? sonuc?.raporlar.length ?? 0;
    const tenkitSay = sonuc?.toplam?.tenkit ?? sonuc?.tenkitler.length ?? 0;

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">
            <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Search size={20} className="text-blue-600" /> Emsal Arama</h1>
                <p className="text-xs text-slate-500 mt-1">
                    Eski raporlarınızda ve tenkitlerinizde arayın: benzer bir tespiti daha önce nasıl yazdığınızı, hangi dayanağı kullandığınızı ve birimin ne cevap verdiğini görün.
                    Yalnızca erişiminiz olan denetimler aranır.
                </p>
            </div>

            <form onSubmit={gonder} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        autoFocus
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder='Ör. kantin ihale   ya da   "kira bedeli"'
                        className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <select value={tur} onChange={e => { setTur(e.target.value); if (q.trim().length >= 2) void ara(q, e.target.value); }}
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs px-3">
                    <option value="">Tüm denetim türleri</option>
                    {TURLER.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="submit" disabled={q.trim().length < 2 || yukleniyor}
                    className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
                    {yukleniyor ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Ara
                </button>
            </form>
            <p className="text-[11px] text-slate-400 -mt-3">
                Birden çok kelime yazarsanız hepsini içerenler gelir. Tam ifade için tırnak kullanın. Türkçe karakter ve büyük/küçük harf fark etmez.
            </p>

            {hata && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 rounded-xl px-3 py-2">{hata}</p>}

            {sonuc && (
                <>
                    <div className="flex items-center gap-2 flex-wrap">
                        {([["hepsi", `Tümü (${raporSay + tenkitSay})`], ["rapor", `Raporlar (${raporSay})`], ["tenkit", `Tenkitler (${tenkitSay})`]] as const).map(([k, ad]) => (
                            <button key={k} type="button" onClick={() => setSekme(k)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${sekme === k ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                                {ad}
                            </button>
                        ))}
                        <button type="button" onClick={() => ara(q, tur, true)} title="Yeni yazılan raporları da dahil etmek için yenile"
                            className="ml-auto text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1">
                            <RefreshCw size={12} /> Yenile
                        </button>
                    </div>

                    {raporSay + tenkitSay === 0 && (
                        <p className="text-sm text-slate-500 text-center py-10">Sonuç bulunamadı. Daha az veya farklı kelime deneyin.</p>
                    )}

                    {sekme !== "rapor" && sonuc.tenkitler.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tenkitler</h2>
                            {sonuc.tenkitler.map(t => {
                                const [durumAd, durumRenk] = DURUM[t.durum || ""] || [t.durum || "", "bg-slate-100 text-slate-600"];
                                return (
                                    <div key={t.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
                                        <div className="flex items-start gap-2">
                                            <Gavel size={15} className="text-rose-500 mt-0.5 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white"><Vurgulu metin={t.baslik} terimler={terimler} /></p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    {t.birim_adi} · {t.denetim_basligi} {tarihYaz(t.denetim_tarihi) && `· ${tarihYaz(t.denetim_tarihi)}`}
                                                </p>
                                            </div>
                                            {durumAd && <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${durumRenk}`}>{durumAd}</span>}
                                        </div>
                                        {t.dayanak && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2"><b>Dayanak:</b> <Vurgulu metin={t.dayanak} terimler={terimler} /></p>}
                                        {t.ozet && t.ozet !== t.baslik && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed"><Vurgulu metin={t.ozet} terimler={terimler} /></p>}
                                        {t.birim_cevabi && <p className="text-[11px] text-slate-500 mt-1.5"><b>Birim cevabı:</b> <Vurgulu metin={t.birim_cevabi} terimler={terimler} /></p>}
                                        {TUR_SEKME[t.rapor_turu || ""] && t.task_id && (
                                            <button type="button" onClick={() => denetimAc(t.rapor_turu, t.task_id)} className="text-[11px] font-bold text-blue-600 hover:underline mt-2">Denetime git</button>
                                        )}
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {sekme !== "tenkit" && sonuc.raporlar.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Raporlar</h2>
                            {sonuc.raporlar.map(r => (
                                <div key={r.audit_id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
                                    <div className="flex items-start gap-2">
                                        <FileText size={15} className="text-blue-600 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white"><Vurgulu metin={r.baslik} terimler={terimler} /></p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{[r.rapor_turu, r.birim, tarihYaz(r.tarih)].filter(Boolean).join(" · ")}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed"><Vurgulu metin={r.ozet} terimler={terimler} /></p>
                                    <div className="flex gap-3 mt-2">
                                        <button type="button" onClick={() => raporAc(r.audit_id)} className="text-[11px] font-bold text-blue-600 hover:underline">Raporu aç</button>
                                        {TUR_SEKME[r.rapor_turu || ""] && r.task_id && (
                                            <button type="button" onClick={() => denetimAc(r.rapor_turu, r.task_id)} className="text-[11px] font-bold text-slate-500 hover:underline">Denetime git</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
