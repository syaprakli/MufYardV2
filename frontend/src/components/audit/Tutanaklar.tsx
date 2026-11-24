import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
    ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, CloudOff, Download, FileSignature, Loader2, Mic, Plus, Printer, Square, Trash2, UserPlus,
} from "lucide-react";
import {
    createTutanak, deleteTutanak, fetchTutanaklar, ROL_ADI, sesiMetneCevir, TUR_ADI, updateTutanak,
    type KisiRolu, type Tutanak, type TutanakKisi,
} from "../../lib/api/tutanaklar";
import { isNetworkError } from "../../lib/api/utils";
import { taslakAl, taslakKaydet, taslaklar, taslakSil, taslakTasi, yerelId, yerelMi } from "../../lib/tutanakTaslak";
import { IFADE_KAPANIS, tutanakWordIndir, tutanakYazdir } from "../../lib/tutanakBelge";
import { useSesKaydi } from "../../lib/hooks/useSesKaydi";
import { IFADE_SORULARI_VARSAYILAN, imzaSirasi, imzaUnvani, MUFETTIS_UNVANLARI, otomatikGiris } from "../../lib/ifadeMetni";

interface Props {
    /** İnceleme / soruşturma görevi */
    taskId?: string | null;
    mufettisAdi?: string;
    /** Görevin adı: yeni tutanağın "Konu" alanına önerilir */
    gorevAdi?: string;
}

const inputCls = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20";
const etiketCls = "text-[10px] font-black uppercase tracking-wider text-slate-400";
const LISTE_ONBELLEK = (a: string) => `mufyard_tutanak_liste_${a}`;

/** Şablondaki varsayılan sorular; ilk soru görevin konusuyla başlar. */
const ifadeSorulari = (konu: string) => IFADE_SORULARI_VARSAYILAN.map((s, i) => ({
    soru: i === 0 && konu ? `${konu} konusu hakkında bildiklerinizi anlatınız.` : s.soru,
    cevap: s.cevap,
}));
const SON_SORU = IFADE_SORULARI_VARSAYILAN[IFADE_SORULARI_VARSAYILAN.length - 1].soru;

const bugun = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const simdi = () => new Date().toTimeString().slice(0, 5);

function yeniTutanak(taskId: string, mufettisAdi: string, gorevAdi: string): Tutanak {
    const mufettis: TutanakKisi = { ad: mufettisAdi || "", unvan: "Müfettiş", rol: "mufettis" };
    return {
        id: yerelId(),
        task_id: taskId,
        tur: "ifade",
        tarih: bugun(),
        saat: simdi(),
        yer: "",
        konu: gorevAdi || "",
        kisiler: [{ ad: "", unvan: "", rol: "ifade_veren" }, mufettis],
        sorular: ifadeSorulari(gorevAdi),
        metin: "",
        kapanis: IFADE_KAPANIS,
        tamamlandi: false,
    };
}

// ------------------------------------------------------------------ mikrofon düğmesi
function MikrofonDugmesi({ aktif, isleniyor, sure, onClick, disabled }: {
    aktif: boolean; isleniyor: boolean; sure: number; onClick: () => void; disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || isleniyor}
            title={aktif ? "Kaydı bitir ve metne çevir" : "Sesle yaz (konuşulanlar metne eklenir)"}
            className={`shrink-0 h-8 px-2.5 rounded-lg flex items-center gap-1 text-[10px] font-black transition-colors ${
                aktif ? "bg-rose-500 text-white animate-pulse" : isleniyor ? "bg-slate-100 text-slate-400" : "bg-violet-50 dark:bg-violet-950/30 text-violet-600 hover:bg-violet-100"
            } disabled:opacity-50`}
        >
            {isleniyor ? <Loader2 size={13} className="animate-spin" /> : aktif ? <Square size={12} className="fill-white" /> : <Mic size={13} />}
            {aktif ? `${Math.floor(sure / 60)}:${String(sure % 60).padStart(2, "0")}` : isleniyor ? "Çevriliyor" : "Ses"}
        </button>
    );
}

// ------------------------------------------------------------------ düzenleyici
function TutanakDuzenleyici({ t, onChange, kayitDurumu, onKapat }: {
    t: Tutanak;
    onChange: (t: Tutanak) => void;
    kayitDurumu: "kaydedildi" | "bekliyor" | "cihazda" | "hata";
    onKapat: () => void;
}) {
    const ses = useSesKaydi();
    const [aktifAlan, setAktifAlan] = useState<string | null>(null);
    const [islenenAlan, setIslenenAlan] = useState<string | null>(null);
    const sonT = useRef(t);
    sonT.current = t;

    const guncelle = (d: Partial<Tutanak>) => onChange({ ...sonT.current, ...d });
    const kisiGuncelle = (i: number, d: Partial<TutanakKisi>) =>
        guncelle({ kisiler: (sonT.current.kisiler || []).map((k, j) => (j === i ? { ...k, ...d } : k)) });
    const soruGuncelle = (i: number, d: Partial<{ soru: string; cevap: string }>) =>
        guncelle({ sorular: (sonT.current.sorular || []).map((s, j) => (j === i ? { ...s, ...d } : s)) });

    /** Alan anahtarı: "metin", "kapanis" veya "cevap:<sıra>" */
    const metneEkle = (alan: string, eklenecek: string) => {
        const cur = sonT.current;
        const ekle = (eski: string) => (eski.trim() ? `${eski.replace(/\s+$/, "")} ${eklenecek}` : eklenecek);
        if (alan === "metin") guncelle({ metin: ekle(cur.metin || "") });
        else if (alan === "kapanis") guncelle({ kapanis: ekle(cur.kapanis || "") });
        else if (alan.startsWith("cevap:")) {
            const i = Number(alan.split(":")[1]);
            soruGuncelle(i, { cevap: ekle((cur.sorular || [])[i]?.cevap || "") });
        }
    };

    const mikrofon = async (alan: string) => {
        if (ses.kaydediyor) {
            const kayitAlani = aktifAlan;
            setAktifAlan(null);
            const blob = await ses.durdur();
            if (!kayitAlani) return;
            if (!blob) return toast.error("Ses algılanamadı (çok kısa).");
            if (!navigator.onLine) return toast.error("İnternet yok: ses metne çevrilemez. Cevabı elle yazın.");
            setIslenenAlan(kayitAlani);
            try {
                const metin = await sesiMetneCevir(blob);
                if (metin) metneEkle(kayitAlani, metin);
                else toast.error("Seste konuşma bulunamadı.");
            } catch (e: any) {
                toast.error(e?.message || "Ses metne çevrilemedi.");
            } finally {
                setIslenenAlan(null);
            }
            return;
        }
        try {
            await ses.baslat();
            setAktifAlan(alan);
        } catch (e: any) {
            toast.error(e?.name === "NotAllowedError" ? "Mikrofon izni verilmedi." : e?.message || "Mikrofon açılamadı.");
        }
    };
    const mikProps = (alan: string) => ({
        aktif: ses.kaydediyor && aktifAlan === alan,
        isleniyor: islenenAlan === alan,
        sure: ses.sure,
        disabled: (ses.kaydediyor && aktifAlan !== alan) || (!!islenenAlan && islenenAlan !== alan),
        onClick: () => mikrofon(alan),
    });

    const durum = {
        kaydedildi: <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Kaydedildi</span>,
        bekliyor: <span className="text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Kaydediliyor</span>,
        cihazda: <span className="text-amber-600 flex items-center gap-1" title="İnternet gelince otomatik gönderilecek"><CloudOff size={12} /> Cihazda saklanıyor</span>,
        hata: <span className="text-rose-600 flex items-center gap-1"><CloudOff size={12} /> Kaydedilemedi</span>,
    }[kayitDurumu];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={onKapat} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600">
                    <ArrowLeft size={14} /> Tutanaklar
                </button>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                    {durum}
                    <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" className="accent-emerald-600" checked={!!t.tamamlandi} onChange={e => guncelle({ tamamlandi: e.target.checked })} />
                        Tamamlandı
                    </label>
                    <button type="button" onClick={() => tutanakYazdir(t)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <Printer size={13} /> Yazdır
                    </button>
                    <button type="button" onClick={() => void tutanakWordIndir(t).catch(() => toast.error("Word dosyası oluşturulamadı."))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                        <Download size={13} /> Word
                    </button>
                </div>
            </div>

            <h3 className="text-sm font-black text-slate-900 dark:text-white">{TUR_ADI[t.tur]}</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="space-y-1"><span className={etiketCls}>Tarih</span>
                    <input type="date" className={inputCls} value={t.tarih || ""} onChange={e => guncelle({ tarih: e.target.value })} /></label>
                <label className="space-y-1"><span className={etiketCls}>Saat</span>
                    <input type="time" className={inputCls} value={t.saat || ""} onChange={e => guncelle({ saat: e.target.value })} /></label>
                <label className="space-y-1 col-span-2"><span className={etiketCls}>Davet edildiği yer</span>
                    <input className={inputCls} value={t.yer || ""} onChange={e => guncelle({ yer: e.target.value })}
                        placeholder="Ör. Müfettişlik odasına" /></label>
                <label className="space-y-1 col-span-2 md:col-span-4"><span className={etiketCls}>Konu</span>
                    <input className={inputCls} value={t.konu || ""} onChange={e => guncelle({ konu: e.target.value })} placeholder="Ör. Kantin kira sözleşmesinin uzatılması" /></label>
            </div>

            {/* Kişiler */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className={etiketCls}>Kişiler (imza blokları)</span>
                    <button type="button" onClick={() => guncelle({ kisiler: [...(t.kisiler || []), { ad: "", unvan: "", rol: "katilan" }] })}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline">
                        <UserPlus size={12} /> Kişi ekle
                    </button>
                </div>
                {(t.kisiler || []).map((k, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <select className={inputCls + " col-span-6 md:col-span-2"} value={k.rol} onChange={e => kisiGuncelle(i, { rol: e.target.value as KisiRolu })}>
                            {(Object.keys(ROL_ADI) as KisiRolu[]).map(r => <option key={r} value={r}>{ROL_ADI[r]}</option>)}
                        </select>
                        <input className={inputCls + " col-span-6 md:col-span-3"} placeholder="Ad Soyad" value={k.ad} onChange={e => kisiGuncelle(i, { ad: e.target.value })} />
                        <input className={inputCls + " col-span-6 md:col-span-3"} placeholder={k.rol === "ifade_veren" ? "Görevi" : "Unvan"} value={k.unvan || ""}
                            list={k.rol === "mufettis" ? "mufettis-unvanlari" : undefined} onChange={e => kisiGuncelle(i, { unvan: e.target.value })} />
                        <span className="col-span-5 md:col-span-3 text-[10px] text-slate-400">{k.rol === "ifade_veren" ? "Kimlik bilgileri aşağıda" : ""}</span>
                        <div className="col-span-1 flex items-center justify-end gap-0.5">
                            <button type="button" title="Yukarı taşı (aynı unvanda üstteki kıdemli sayılır)" disabled={i === 0}
                                onClick={() => { const k = [...(t.kisiler || [])]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; guncelle({ kisiler: k }); }}
                                className="h-8 w-6 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                            <button type="button" title="Aşağı taşı" disabled={i === (t.kisiler || []).length - 1}
                                onClick={() => { const k = [...(t.kisiler || [])]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; guncelle({ kisiler: k }); }}
                                className="h-8 w-6 flex items-center justify-center text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                            <button type="button" title="Kişiyi çıkar" onClick={() => guncelle({ kisiler: (t.kisiler || []).filter((_, j) => j !== i) })}
                                className="h-8 w-6 flex items-center justify-center text-slate-400 hover:text-rose-600">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {(t.kisiler || []).length > 0 && (
                <p className="text-[11px] text-slate-500 -mt-2">
                    <b>İmza sırası (soldan sağa):</b> {imzaSirasi(t.kisiler || []).map(k => `${k.ad || "…"} (${imzaUnvani(k)})`).join("  |  ")}
                    <span className="block text-[10px] text-slate-400">Kıdem: Baş Müfettiş › Müfettiş › Müfettiş Yardımcısı › İfade Veren; aynı unvanda listede üstteki kıdemli. 2 imzada kıdemli sağda, 3 imzada en solda.</span>
                </p>
            )}
            <datalist id="mufettis-unvanlari">{MUFETTIS_UNVANLARI.map(u => <option key={u} value={u} />)}</datalist>

            {/* İfade verenin kimlik bilgileri (şablondaki satırlar) */}
            {(() => {
                const i = (t.kisiler || []).findIndex(k => k.rol === "ifade_veren");
                if (i < 0) {
                    return (
                        <button type="button" onClick={() => guncelle({ kisiler: [{ ad: "", unvan: "", rol: "ifade_veren" }, ...(t.kisiler || [])] })}
                            className="self-start text-[11px] font-bold text-blue-600 hover:underline">+ İfade veren ekle</button>
                    );
                }
                const k = (t.kisiler || [])[i];
                const alan = (ad: string, key: keyof TutanakKisi, ph = "", ek: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}, temiz?: (v: string) => string) => (
                    <label className="space-y-1">
                        <span className={etiketCls}>{ad}</span>
                        <input className={inputCls} placeholder={ph} value={(k[key] as string) || ""} {...ek}
                            onChange={e => kisiGuncelle(i, { [key]: temiz ? temiz(e.target.value) : e.target.value } as Partial<TutanakKisi>)} />
                    </label>
                );
                return (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                        <span className={etiketCls}>İfade verenin kimlik bilgileri</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {alan("Adı ve soyadı", "ad")}
                            {alan("T.C. kimlik numarası", "tckn", "", { inputMode: "numeric" }, v => v.replace(/\D/g, "").slice(0, 11))}
                            {alan("Baba adı", "baba_adi")}
                            {alan("Ana adı", "ana_adi")}
                            {alan("Doğum yeri", "dogum_yeri")}
                            {alan("Doğum yılı", "dogum_yili", "", { inputMode: "numeric" }, v => v.replace(/[^\d./]/g, "").slice(0, 10))}
                            {alan("Nüfusa kayıtlı olduğu yer", "nufus_yeri")}
                            {alan("Görevi", "unvan")}
                            <div className="col-span-2 md:col-span-3">{alan("Adresi", "adres")}</div>
                            {alan("Cep telefonu", "telefon", "05xx xxx xx xx", { inputMode: "tel" })}
                        </div>
                    </div>
                );
            })()}

            {/* Gövde */}
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className={etiketCls}>Giriş paragrafı</span>
                    <MikrofonDugmesi {...mikProps("metin")} />
                </div>
                <textarea rows={3} className={inputCls} value={t.metin || ""} onChange={e => guncelle({ metin: e.target.value })}
                    placeholder="Boş bırakırsanız aşağıdaki standart giriş metni kullanılır." />
                {!(t.metin || "").trim() && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 p-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-400">Yazılacak giriş: </span>{otomatikGiris(t)}
                        <button type="button" onClick={() => guncelle({ metin: otomatikGiris(t) })} className="ml-2 font-bold text-blue-600 hover:underline">Düzenle</button>
                    </div>
                )}
            </div>

            {(
                <div className="space-y-3">
                    <span className={etiketCls}>Sorular ve cevaplar</span>
                    {(t.sorular || []).map((s, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-white dark:bg-slate-900/60">
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] font-black text-blue-600 pt-2 w-20 shrink-0">SORU {i + 1})</span>
                                <textarea rows={2} className={inputCls} value={s.soru} onChange={e => soruGuncelle(i, { soru: e.target.value })} placeholder="Soru" />
                                <button type="button" title="Soruyu sil" onClick={() => guncelle({ sorular: (t.sorular || []).filter((_, j) => j !== i) })}
                                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-rose-600 shrink-0"><Trash2 size={14} /></button>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] font-black text-emerald-600 pt-2 w-20 shrink-0">CEVAP {i + 1})</span>
                                <textarea rows={3} className={inputCls} value={s.cevap} onChange={e => soruGuncelle(i, { cevap: e.target.value })} placeholder="Cevap (yazın veya Ses ile kaydedin)" />
                                <MikrofonDugmesi {...mikProps(`cevap:${i}`)} />
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={() => {
                        const s = [...(t.sorular || [])];
                        const sonda = s.length && s[s.length - 1].soru.trim() === SON_SORU;
                        s.splice(sonda ? s.length - 1 : s.length, 0, { soru: "", cevap: "" });
                        guncelle({ sorular: s });
                    }}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline">
                        <Plus size={13} /> Soru ekle
                    </button>
                </div>
            )}

            <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className={etiketCls}>Kapanış</span>
                    <MikrofonDugmesi {...mikProps("kapanis")} />
                </div>
                <textarea rows={2} className={inputCls} value={t.kapanis || ""} onChange={e => guncelle({ kapanis: e.target.value })} />
            </div>
            <p className="text-[10px] text-slate-400">
                Ses kayıtları yalnızca metne çevirmek için gönderilir, saklanmaz. Metne çeviri için internet gerekir; tutanağın kendisi internetsiz de yazılabilir.
            </p>
        </div>
    );
}

// ------------------------------------------------------------------ liste + senkron
export function Tutanaklar({ taskId, mufettisAdi = "", gorevAdi = "" }: Props) {
    const [liste, setListe] = useState<Tutanak[]>([]);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [aktifId, setAktifId] = useState<string | null>(null);
    const [durumlar, setDurumlar] = useState<Record<string, "kaydedildi" | "bekliyor" | "cihazda" | "hata">>({});
    const senkronda = useRef(false);
    const zamanlayici = useRef<number | null>(null);
    const hataBildirildi = useRef<Set<string>>(new Set());

    const taslaklarlaBirlestir = useCallback((sunucu: Tutanak[]) => {
        if (!taskId) return sunucu;
        const t = taslaklar(taskId);
        const harita = new Map(sunucu.map(x => [x.id, x]));
        t.forEach(d => harita.set(d.veri.id, d.veri));
        return Array.from(harita.values());
    }, [taskId]);

    const senkronize = useCallback(async () => {
        if (!taskId || senkronda.current) return;
        senkronda.current = true;
        const baslangic = Date.now();
        try {
            for (const d of taslaklar(taskId)) {
                const id = d.veri.id;
                setDurumlar(s => ({ ...s, [id]: "bekliyor" }));
                try {
                    if (yerelMi(id)) {
                        const yeni = await createTutanak(taskId, d.veri.tur, d.veri);
                        taslakTasi(id, yeni.id, d.zaman);
                        const tasinan = taslakAl(yeni.id);
                        setListe(l => l.map(x => (x.id === id ? { ...(tasinan?.veri || x), id: yeni.id, created_at: yeni.created_at } : x)));
                        setAktifId(a => (a === id ? yeni.id : a));
                        setDurumlar(s => ({ ...s, [yeni.id]: tasinan ? "bekliyor" : "kaydedildi" }));
                    } else {
                        await updateTutanak(id, d.veri);
                        taslakSil(id, d.zaman);
                        setDurumlar(s => ({ ...s, [id]: taslakAl(id) ? "bekliyor" : "kaydedildi" }));
                    }
                } catch (e: any) {
                    if (isNetworkError(e) || !e?.status || e.status >= 500) {
                        setDurumlar(s => ({ ...s, [id]: "cihazda" }));
                        break;
                    }
                    setDurumlar(s => ({ ...s, [id]: "hata" }));
                    if (!hataBildirildi.current.has(id)) {
                        hataBildirildi.current.add(id);
                        toast.error(e?.message || "Tutanak kaydedilemedi.");
                    }
                }
            }
        } finally {
            senkronda.current = false;
        }
        // Senkron sürerken yazılan değişiklikler hemen ardından gönderilir
        if (taslaklar(taskId).some(d => d.zaman >= baslangic)) {
            if (zamanlayici.current) window.clearTimeout(zamanlayici.current);
            zamanlayici.current = window.setTimeout(() => void senkronize(), 1500);
        }
    }, [taskId]);

    const yukle = useCallback(async () => {
        if (!taskId) return;
        setYukleniyor(true);
        try {
            const sunucu = await fetchTutanaklar(taskId);
            try { localStorage.setItem(LISTE_ONBELLEK(taskId), JSON.stringify(sunucu)); } catch { /* depolama dolu */ }
            setListe(taslaklarlaBirlestir(sunucu));
        } catch {
            let onbellek: Tutanak[] = [];
            try { onbellek = JSON.parse(localStorage.getItem(LISTE_ONBELLEK(taskId)) || "[]"); } catch { /* yok */ }
            setListe(taslaklarlaBirlestir(onbellek));
        } finally {
            setYukleniyor(false);
        }
        void senkronize();
    }, [taskId, taslaklarlaBirlestir, senkronize]);

    useEffect(() => { void yukle(); }, [yukle]);
    useEffect(() => {
        const calistir = () => void senkronize();
        window.addEventListener("online", calistir);
        // Zayıf sinyalde "online" olayı gelmeyebilir: bekleyen taslak varsa periyodik dene
        const aralik = window.setInterval(() => { if (taskId && taslaklar(taskId).length) calistir(); }, 30000);
        return () => {
            window.removeEventListener("online", calistir);
            window.clearInterval(aralik);
            if (zamanlayici.current) window.clearTimeout(zamanlayici.current);
        };
    }, [senkronize, taskId]);

    const degistir = (t: Tutanak) => {
        setListe(l => l.map(x => (x.id === t.id ? t : x)));
        if (!taslakKaydet(t)) toast.error("Cihaz depolaması dolu: değişiklik saklanamadı.", { id: "tutanak-depo" });
        setDurumlar(s => ({ ...s, [t.id]: "bekliyor" }));
        if (zamanlayici.current) window.clearTimeout(zamanlayici.current);
        zamanlayici.current = window.setTimeout(() => void senkronize(), 1500);
    };

    const yeni = () => {
        if (!taskId) return;
        const t = yeniTutanak(taskId, mufettisAdi, gorevAdi);
        taslakKaydet(t);
        setListe(l => [...l, t]);
        setAktifId(t.id);
        setDurumlar(s => ({ ...s, [t.id]: "bekliyor" }));
        void senkronize();
    };

    const sil = async (t: Tutanak) => {
        if (!window.confirm(`${TUR_ADI[t.tur]} silinsin mi? Bu işlem geri alınamaz.`)) return;
        try {
            if (!yerelMi(t.id)) await deleteTutanak(t.id);
            taslakSil(t.id);
            setListe(l => l.filter(x => x.id !== t.id));
            if (aktifId === t.id) setAktifId(null);
        } catch (e: any) {
            toast.error(isNetworkError(e) ? "İnternet yok: silme için bağlantı gerekir." : e?.message || "Silinemedi.");
        }
    };

    const aktif = useMemo(() => liste.find(x => x.id === aktifId) || null, [liste, aktifId]);

    if (!taskId) {
        return <p className="text-sm text-slate-500 py-12 text-center">Tutanak için bir inceleme/soruşturma görevi seçin.</p>;
    }
    if (aktif) {
        return <TutanakDuzenleyici t={aktif} onChange={degistir} kayitDurumu={durumlar[aktif.id] || "kaydedildi"} onKapat={() => setAktifId(null)} />;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 mr-2">İfade Tutanakları ({liste.length})</span>
                <button type="button" onClick={yeni}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus size={13} /> Yeni İfade Tutanağı
                </button>
            </div>
            {yukleniyor && liste.length === 0 ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : liste.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Henüz ifade tutanağı yok.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {liste.map(t => {
                        const kim = (t.kisiler || []).find(k => k.rol === "ifade_veren")?.ad;
                        const d = durumlar[t.id];
                        return (
                            <div key={t.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <FileSignature size={15} className="text-blue-600" />
                                    <span className="text-xs font-black text-slate-900 dark:text-white">{TUR_ADI[t.tur]}</span>
                                    {t.tamamlandi && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">TAMAMLANDI</span>}
                                    {(d === "cihazda" || yerelMi(t.id)) && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">CİHAZDA</span>}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {kim ? <b>{kim}</b> : null}{kim && t.konu ? " — " : ""}{t.konu || (!kim ? "Konu girilmedi" : "")}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {(t.tarih || "").split("-").reverse().join(".")} {t.saat || ""} · {t.yer || "Yer girilmedi"}
                                    {` · ${(t.sorular || []).filter(s => s.cevap.trim()).length}/${(t.sorular || []).length} cevap`}
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button type="button" onClick={() => setAktifId(t.id)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 hover:bg-blue-100">Aç</button>
                                    <button type="button" onClick={() => void tutanakWordIndir(t).catch(() => toast.error("Word dosyası oluşturulamadı."))} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1"><Download size={12} /> Word</button>
                                    <button type="button" onClick={() => sil(t)} className="ml-auto text-slate-400 hover:text-rose-600" title="Sil"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
