import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertCircle, ChevronDown, ChevronUp, ClipboardCheck, ClipboardCopy, History, Loader2, Paperclip, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import {
    aktarTenkitler, createTenkit, deleteTenkit, DURUM_ETIKETLERI, fetchOncekiTenkitler, fetchTenkitler,
    ONEM_ETIKETLERI, updateTenkit, type Kanit, type Tenkit, type TenkitDurumu, type TenkitOnemi,
} from "../../lib/api/tenkitler";
import { kanitEtiketi, TenkitKanitlari } from "./TenkitKanitlari";

interface ChecklistQuestion {
    id: string;
    text: string;
    area: string;
}

interface Props {
    /** Bağlı denetim (rapor) kimliği; yoksa önce denetim başlatılmalı */
    auditId?: string | null;
    /** Kontrol listesi soruları ve cevapları ("Hayır" denenler tenkit adayı) */
    questions: ChecklistQuestion[];
    form: Record<string, any>;
    /** Denetim galerisindeki fotoğraflar (sıra = rapordaki "Fotoğraf N" numarası) */
    photos?: string[];
    photoDescriptions?: Record<string, string>;
    onDenetimBaslat?: () => void;
}

const DURUM_RENK: Record<TenkitDurumu, string> = {
    acik: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    cevap_bekleniyor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    giderildi: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    kismen_giderildi: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    giderilmedi: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300",
};
const ONEM_RENK: Record<TenkitOnemi, string> = {
    kritik: "bg-rose-600 text-white",
    uyari: "bg-amber-500 text-white",
    bilgi: "bg-slate-400 text-white",
};
const DURUMLAR = Object.keys(DURUM_ETIKETLERI) as TenkitDurumu[];
const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20";

function TenkitKarti({ tenkit, photos, photoDescriptions, onChange, onDelete }: {
    tenkit: Tenkit;
    photos: string[];
    photoDescriptions: Record<string, string>;
    onChange: (t: Tenkit) => void;
    onDelete: (id: string) => void;
}) {
    const [acik, setAcik] = useState(false);
    const [taslak, setTaslak] = useState<Partial<Tenkit>>({});
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const deger = <K extends keyof Tenkit>(k: K) => (k in taslak ? (taslak as any)[k] : tenkit[k]) ?? "";
    const degisti = Object.keys(taslak).length > 0;

    const kaydet = async (degisiklik: Partial<Tenkit>) => {
        setKaydediliyor(true);
        try {
            const guncel = await updateTenkit(tenkit.id, degisiklik);
            onChange(guncel);
            // Yalnızca kaydedilen alanları taslaktan düş; yazılmakta olan diğer alanlar kalsın
            setTaslak(t => {
                const kalan: Partial<Tenkit> = { ...t };
                (Object.keys(degisiklik) as (keyof Tenkit)[]).forEach(k => { delete kalan[k]; });
                return kalan;
            });
        } catch (e: any) {
            toast.error(e?.message || "Tenkit güncellenemedi.");
        } finally {
            setKaydediliyor(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${ONEM_RENK[tenkit.onem]}`}>
                            {ONEM_ETIKETLERI[tenkit.onem]}
                        </span>
                        {tenkit.alan && <span className="text-[10px] font-bold text-slate-400">{tenkit.alan}</span>}
                        {tenkit.kaynak === "kontrol_listesi" && <span className="text-[10px] text-slate-400">• Kontrol listesi</span>}
                        {(tenkit.kanitlar || []).length > 0 ? (
                            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5"><Paperclip size={10} />{tenkit.kanitlar!.length} kanıt</span>
                        ) : tenkit.onem !== "bilgi" && (
                            <span className="text-[10px] font-bold text-amber-600">• Kanıt yok</span>
                        )}
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{tenkit.baslik}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <select
                        value={tenkit.durum}
                        disabled={kaydediliyor}
                        onChange={e => kaydet({ durum: e.target.value as TenkitDurumu })}
                        className={`h-8 rounded-lg border text-[11px] font-black px-2 outline-none ${DURUM_RENK[tenkit.durum]}`}
                    >
                        {DURUMLAR.map(d => <option key={d} value={d}>{DURUM_ETIKETLERI[d]}</option>)}
                    </select>
                    <button
                        type="button"
                        onClick={() => setAcik(v => !v)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={acik ? "Kapat" : "Cevap ve ayrıntılar"}
                    >
                        {acik ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {!acik && tenkit.birim_cevabi && (
                <p className="mt-2 text-[11px] text-slate-500 line-clamp-2"><b>Birim cevabı:</b> {tenkit.birim_cevabi}</p>
            )}

            {acik && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="space-y-1 md:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Açıklama / Tespit</span>
                        <textarea rows={3} className={inputCls} value={deger("aciklama")} onChange={e => setTaslak(t => ({ ...t, aciklama: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dayanak (mevzuat)</span>
                        <input className={inputCls} value={deger("dayanak")} onChange={e => setTaslak(t => ({ ...t, dayanak: e.target.value }))} placeholder="Ör. 3289 s.K. md. 8" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Önem</span>
                        <select className={inputCls} value={deger("onem")} onChange={e => setTaslak(t => ({ ...t, onem: e.target.value as TenkitOnemi }))}>
                            {(Object.keys(ONEM_ETIKETLERI) as TenkitOnemi[]).map(o => <option key={o} value={o}>{ONEM_ETIKETLERI[o]}</option>)}
                        </select>
                    </label>
                    <TenkitKanitlari
                        kanitlar={tenkit.kanitlar || []}
                        photos={photos}
                        photoDescriptions={photoDescriptions}
                        kaydediliyor={kaydediliyor}
                        onKaydet={(kanitlar: Kanit[]) => kaydet({ kanitlar })}
                    />
                    <label className="space-y-1 md:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Birimin cevabı</span>
                        <textarea rows={3} className={inputCls} value={deger("birim_cevabi")} onChange={e => setTaslak(t => ({ ...t, birim_cevabi: e.target.value }))} placeholder="Cevaplı teftiş raporundaki birim cevabı" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cevap tarihi</span>
                        <input type="date" className={inputCls} value={deger("cevap_tarihi")} onChange={e => setTaslak(t => ({ ...t, cevap_tarihi: e.target.value }))} />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Takip notu</span>
                        <input className={inputCls} value={deger("takip_notu")} onChange={e => setTaslak(t => ({ ...t, takip_notu: e.target.value }))} placeholder="Sonraki denetimde bakılacak husus" />
                    </label>
                    <div className="md:col-span-2 flex items-center justify-between gap-2 pt-1">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <History size={12} />
                            {(tenkit.gecmis || []).map(g => `${DURUM_ETIKETLERI[g.durum]} (${g.tarih ? new Date(g.tarih).toLocaleDateString("tr-TR") : ""})`).join(" → ") || "—"}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" className="h-8 text-rose-500 hover:text-rose-600" onClick={() => onDelete(tenkit.id)}>
                                <Trash2 size={13} className="mr-1" /> Sil
                            </Button>
                            <Button size="sm" className="h-8" disabled={!degisti || kaydediliyor} onClick={() => kaydet(taslak)}>
                                {kaydediliyor ? <Loader2 size={13} className="animate-spin mr-1" /> : <Save size={13} className="mr-1" />} Kaydet
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const kacis = (v: string) => v.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Tenkit → tespit → dayanak → kanıt zincirini rapora yapıştırılabilir biçimde üretir. */
function raporMetni(tenkitler: Tenkit[], photos: string[]) {
    const html: string[] = [];
    const duz: string[] = [];
    tenkitler.forEach((t, i) => {
        const no = i + 1;
        const kanit = (t.kanitlar || []).map(k => kanitEtiketi(k, photos)).join(", ");
        html.push(`<p><strong>${no}. ${kacis(t.baslik)}</strong></p>`);
        duz.push(`${no}. ${t.baslik}`);
        if (t.aciklama) { html.push(`<p>${kacis(t.aciklama).replace(/\n/g, "<br>")}</p>`); duz.push(t.aciklama); }
        if (t.dayanak) { html.push(`<p><em>Dayanak:</em> ${kacis(t.dayanak)}</p>`); duz.push(`Dayanak: ${t.dayanak}`); }
        if (kanit) { html.push(`<p><em>Kanıt:</em> ${kacis(kanit)}</p>`); duz.push(`Kanıt: ${kanit}`); }
        duz.push("");
    });
    return { html: html.join("\n"), duz: duz.join("\n") };
}

export function TenkitTakibi({ auditId, questions, form, photos = [], photoDescriptions = {}, onDenetimBaslat }: Props) {
    const [tenkitler, setTenkitler] = useState<Tenkit[]>([]);
    const [onceki, setOnceki] = useState<{ birim_adi: string; tenkitler: Tenkit[] } | null>(null);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [islemde, setIslemde] = useState(false);
    const [yeniBaslik, setYeniBaslik] = useState("");

    const yukle = useCallback(async () => {
        if (!auditId) return;
        setYukleniyor(true);
        try {
            const [liste, eski] = await Promise.all([fetchTenkitler(auditId), fetchOncekiTenkitler(auditId).catch(() => null)]);
            setTenkitler(liste);
            setOnceki(eski);
        } catch (e: any) {
            toast.error(e?.message || "Tenkitler alınamadı.");
        } finally {
            setYukleniyor(false);
        }
    }, [auditId]);

    useEffect(() => { yukle(); }, [yukle]);

    const hayirMaddeleri = useMemo(() => questions.filter(q => form?.[q.id] === "no"), [questions, form]);
    const aktarilmamis = useMemo(() => {
        const refs = new Set(tenkitler.map(t => t.kaynak_ref).filter(Boolean));
        return hayirMaddeleri.filter(q => !refs.has(q.id));
    }, [hayirMaddeleri, tenkitler]);

    const sayac = useMemo(() => {
        const c: Record<string, number> = {};
        tenkitler.forEach(t => { c[t.durum] = (c[t.durum] || 0) + 1; });
        c.kanitsiz = tenkitler.filter(t => t.onem !== "bilgi" && !(t.kanitlar || []).length).length;
        return c;
    }, [tenkitler]);

    const oncekiGruplar = useMemo(() => {
        const g = new Map<string, Tenkit[]>();
        (onceki?.tenkitler || []).forEach(t => {
            const k = `${t.denetim_basligi || "Denetim"}|${(t.denetim_tarihi || "").slice(0, 10)}`;
            g.set(k, [...(g.get(k) || []), t]);
        });
        return Array.from(g.entries());
    }, [onceki]);

    if (!auditId) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <AlertCircle size={28} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Tenkit takibi için önce bu görevde denetimi başlatın.</p>
                {onDenetimBaslat && <Button size="sm" onClick={onDenetimBaslat}>Denetimi Başlat</Button>}
            </div>
        );
    }

    const kontrolListesindenAktar = async () => {
        if (aktarilmamis.length === 0) return;
        setIslemde(true);
        try {
            const sonuc = await aktarTenkitler(auditId, aktarilmamis.map(q => ({
                baslik: q.text,
                aciklama: form?.[`inspector_note_${q.id}`] || "",
                alan: q.area,
                kaynak: "kontrol_listesi" as const,
                kaynak_ref: q.id,
                onem: "uyari" as const,
            })));
            toast.success(`${sonuc.eklenen} tenkit eklendi.`);
            await yukle();
        } catch (e: any) {
            toast.error(e?.message || "Aktarılamadı.");
        } finally {
            setIslemde(false);
        }
    };

    const yeniEkle = async () => {
        if (!yeniBaslik.trim()) return;
        setIslemde(true);
        try {
            const t = await createTenkit({ audit_id: auditId, baslik: yeniBaslik.trim(), kaynak: "manuel" });
            setTenkitler(prev => [...prev, t]);
            setYeniBaslik("");
        } catch (e: any) {
            toast.error(e?.message || "Tenkit eklenemedi.");
        } finally {
            setIslemde(false);
        }
    };

    const oncekindenAktar = async (t: Tenkit) => {
        setIslemde(true);
        try {
            const sonuc = await aktarTenkitler(auditId, [{
                baslik: t.baslik,
                aciklama: `Önceki denetimde (${t.denetim_basligi || ""}) verilen tenkit; son durumu: ${DURUM_ETIKETLERI[t.durum]}.`
                    + (t.birim_cevabi ? `\nBirim cevabı: ${t.birim_cevabi}` : ""),
                dayanak: t.dayanak || undefined,
                alan: t.alan || "Önceki Denetim",
                onem: t.onem,
                kaynak: "manuel",
                kaynak_ref: `onceki:${t.id}`,
            }]);
            toast.success(sonuc.eklenen ? "Bu denetimde yeniden kontrol edilecekler listesine eklendi." : "Bu tenkit zaten eklenmiş.");
            await yukle();
        } catch (e: any) {
            toast.error(e?.message || "Aktarılamadı.");
        } finally {
            setIslemde(false);
        }
    };

    const raporaKopyala = async () => {
        const { html, duz } = raporMetni(tenkitler, photos);
        try {
            if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
                await navigator.clipboard.write([new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([duz], { type: "text/plain" }),
                })]);
            } else {
                await navigator.clipboard.writeText(duz);
            }
            toast.success(`${tenkitler.length} tenkit kopyalandı. Rapor editörüne yapıştırabilirsiniz.`);
        } catch {
            toast.error("Panoya kopyalanamadı.");
        }
    };

    const sil = async (id: string) => {
        if (!window.confirm("Bu tenkit silinsin mi?")) return;
        try {
            await deleteTenkit(id);
            setTenkitler(prev => prev.filter(t => t.id !== id));
        } catch (e: any) {
            toast.error(e?.message || "Tenkit silinemedi.");
        }
    };

    return (
        <div className="flex flex-col gap-5">
            {/* Özet */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 mr-1">Bu denetimin tenkitleri ({tenkitler.length})</span>
                {DURUMLAR.filter(d => sayac[d]).map(d => (
                    <span key={d} className={`text-[10px] font-black px-2 py-1 rounded-lg border ${DURUM_RENK[d]}`}>{DURUM_ETIKETLERI[d]}: {sayac[d]}</span>
                ))}
                {sayac.kanitsiz > 0 && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20" title="Kritik/uyarı tenkitlerinden kanıt bağlanmamış olanlar">
                        Kanıtsız: {sayac.kanitsiz}
                    </span>
                )}
                {tenkitler.length > 0 && (
                    <button type="button" onClick={raporaKopyala}
                        className="ml-auto flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Tenkitleri tespit, dayanak ve kanıtlarıyla numaralı olarak kopyalar">
                        <ClipboardCopy size={13} /> Rapora kopyala
                    </button>
                )}
            </div>

            {/* Ekleme */}
            <div className="flex flex-col lg:flex-row gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={islemde || aktarilmamis.length === 0}
                    onClick={kontrolListesindenAktar}
                    className="h-9"
                    title="Kontrol listesinde 'Hayır' işaretlenen maddeleri tenkit olarak ekler"
                >
                    <ClipboardCheck size={14} className="mr-1.5" />
                    Kontrol listesinden aktar ({aktarilmamis.length})
                </Button>
                <div className="flex flex-1 gap-2">
                    <input
                        className={inputCls + " h-9"}
                        placeholder="Yeni tenkit başlığı…"
                        value={yeniBaslik}
                        onChange={e => setYeniBaslik(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") yeniEkle(); }}
                    />
                    <Button size="sm" className="h-9 shrink-0" disabled={islemde || !yeniBaslik.trim()} onClick={yeniEkle}>
                        <Plus size={14} className="mr-1" /> Ekle
                    </Button>
                </div>
            </div>

            {/* Liste */}
            {yukleniyor ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : tenkitler.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Henüz tenkit yok. Kontrol listesinden aktarabilir veya elle ekleyebilirsiniz.</p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {tenkitler.map(t => (
                        <TenkitKarti key={t.id} tenkit={t} onDelete={sil} photos={photos} photoDescriptions={photoDescriptions}
                            onChange={g => setTenkitler(prev => prev.map(x => (x.id === g.id ? g : x)))} />
                    ))}
                </div>
            )}

            {/* Önceki denetimler */}
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/10 p-4">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-1">Önceki denetimlerdeki tenkitler</h4>
                <p className="text-[11px] text-slate-500 mb-3">
                    {onceki?.birim_adi ? `${onceki.birim_adi} için` : "Bu birim için"} daha önceki denetimlerde verilen tenkitler ve son durumları.
                </p>
                {oncekiGruplar.length === 0 ? (
                    <p className="text-xs text-slate-400">Erişebildiğiniz önceki bir denetimde bu birime ait tenkit bulunamadı.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {oncekiGruplar.map(([key, list]) => (
                            <div key={key}>
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5">
                                    {key.split("|")[0]} <span className="font-medium text-slate-400">{key.split("|")[1]}</span>
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {list.map(t => (
                                        <div key={t.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2">
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${DURUM_RENK[t.durum]}`}>{DURUM_ETIKETLERI[t.durum]}</span>
                                            <span className="text-xs text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate" title={t.baslik}>{t.baslik}</span>
                                            {t.durum !== "giderildi" && (
                                                <button
                                                    type="button"
                                                    disabled={islemde}
                                                    onClick={() => oncekindenAktar(t)}
                                                    className="text-[10px] font-bold text-blue-600 hover:underline shrink-0"
                                                    title="Bu denetimde yeniden kontrol edilecekler listesine ekle"
                                                >
                                                    Bu denetimde kontrol et
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
