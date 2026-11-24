import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Keyboard, Monitor, RotateCcw } from "lucide-react";
import {
    ata, atamalar, cakisan, DEGISTI_OLAYI, ISLEMLER, kayitModunu, kisayolSorunu, olaydanKisayol, varsayilanaDon,
} from "../../lib/kisayollar";
import { TusKutulari } from "../layout/Kisayollar";

interface MasaustuAyarlari {
    acilistaBaslat: boolean;
    acilistaGizliBaslat: boolean;
    arkaPlandaCalis: boolean;
    genelKisayol: string;
    paketli?: boolean;
    acilistaKayitli?: boolean | null;
}

type ElectronAPI = {
    masaustuAyarlariAl?: () => Promise<MasaustuAyarlari>;
    masaustuAyarlariKaydet?: (d: Partial<MasaustuAyarlari>) => Promise<{ ayarlar: MasaustuAyarlari; hata?: string | null }>;
};
const api = (): ElectronAPI | undefined => (window as any).electronAPI;

const kartCls = "bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 md:p-7 shadow-sm";

/** Tıklayınca tuş kaydeder: Esc vazgeçer, Backspace/Delete kaldırır. */
function TusKaydedici({ deger, onKaydet, onTemizle }: {
    deger: string;
    onKaydet: (k: string) => string | null; // hata mesajı ya da null
    onTemizle?: () => void;
}) {
    const [kayit, setKayit] = useState(false);
    const [hata, setHata] = useState<string | null>(null);

    useEffect(() => {
        if (!kayit) return;
        kayitModunu(true);
        const dinle = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") { setKayit(false); setHata(null); return; }
            if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                onTemizle?.();
                setKayit(false);
                setHata(null);
                return;
            }
            const k = olaydanKisayol(e);
            if (!k) return; // yalnızca Ctrl/Alt/Shift basıldı, tuşu bekle
            const sorun = onKaydet(k);
            if (sorun) setHata(sorun);
            else { setKayit(false); setHata(null); }
        };
        window.addEventListener("keydown", dinle, true);
        return () => {
            window.removeEventListener("keydown", dinle, true);
            kayitModunu(false);
        };
    }, [kayit, onKaydet, onTemizle]);

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                onClick={() => { setKayit(v => !v); setHata(null); }}
                onBlur={() => { setKayit(false); setHata(null); }}
                className={`min-w-[150px] h-9 px-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                    kayit ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }`}
                title="Değiştirmek için tıklayıp yeni tuşlara basın"
            >
                {kayit ? <span className="text-[11px] font-bold text-blue-600 animate-pulse">Tuşlara basın… (Esc: vazgeç)</span> : <TusKutulari kisayol={deger} />}
            </button>
            {hata && <span className="text-[10px] font-semibold text-rose-600 max-w-[280px] text-right">{hata}</span>}
        </div>
    );
}

function Anahtar({ acik, onDegis, disabled }: { acik: boolean; onDegis: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={acik}
            disabled={disabled}
            onClick={() => onDegis(!acik)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 ${acik ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${acik ? "translate-x-5" : ""}`} />
        </button>
    );
}

function Satir({ baslik, aciklama, children }: { baslik: string; aciklama?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{baslik}</p>
                {aciklama && <p className="text-[11px] text-slate-500 mt-0.5">{aciklama}</p>}
            </div>
            {children}
        </div>
    );
}

export function KisayolBolumu() {
    const [harita, setHarita] = useState<Record<string, string>>(() => atamalar());
    useEffect(() => {
        const yenile = () => setHarita(atamalar());
        window.addEventListener(DEGISTI_OLAYI, yenile);
        return () => window.removeEventListener(DEGISTI_OLAYI, yenile);
    }, []);

    return (
        <div className={kartCls}>
            <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2"><Keyboard size={18} className="text-blue-600" /> Klavye kısayolları</h3>
                <button type="button" onClick={() => { varsayilanaDon(); toast.success("Kısayollar varsayılana döndü."); }}
                    className="text-[11px] font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1">
                    <RotateCcw size={12} /> Tümünü varsayılana döndür
                </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
                Değiştirmek için kısayola tıklayıp yeni tuşlara basın. Kaldırmak için tıklayıp Backspace'e basın. Ayarlar bu cihazda saklanır.
                Uygulama içindeyken <b>F1</b> tüm kısayolları gösterir.
            </p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {ISLEMLER.map(i => (
                    <Satir key={i.id} baslik={i.ad} aciklama={i.varsayilan && harita[i.id] !== i.varsayilan ? `Varsayılan: ${i.varsayilan}` : undefined}>
                        <div className="flex items-center gap-2">
                            <TusKaydedici
                                deger={harita[i.id]}
                                onKaydet={k => {
                                    const sorun = kisayolSorunu(k);
                                    if (sorun) return sorun;
                                    const diger = cakisan(k, i.id);
                                    if (diger) return `${k} zaten "${diger.ad}" için kullanılıyor. Önce oradan kaldırın.`;
                                    ata(i.id, k);
                                    return null;
                                }}
                                onTemizle={() => ata(i.id, "")}
                            />
                            {harita[i.id] !== i.varsayilan && (
                                <button type="button" title="Varsayılana döndür" onClick={() => varsayilanaDon(i.id)} className="text-slate-400 hover:text-blue-600">
                                    <RotateCcw size={14} />
                                </button>
                            )}
                        </div>
                    </Satir>
                ))}
            </div>
        </div>
    );
}

export function MasaustuBolumu() {
    const [a, setA] = useState<MasaustuAyarlari | null>(null);
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const destek = !!api()?.masaustuAyarlariAl;

    useEffect(() => {
        if (!destek) return;
        api()!.masaustuAyarlariAl!().then(setA).catch(() => toast.error("Masaüstü ayarları okunamadı."));
    }, [destek]);

    const kaydet = async (d: Partial<MasaustuAyarlari>): Promise<string | null> => {
        setKaydediliyor(true);
        try {
            const r = await api()!.masaustuAyarlariKaydet!(d);
            const guncel = await api()!.masaustuAyarlariAl!();
            setA(guncel);
            if (r.hata) { toast.error(r.hata); return r.hata; }
            toast.success("Kaydedildi.");
            return null;
        } catch {
            toast.error("Kaydedilemedi.");
            return "Kaydedilemedi.";
        } finally {
            setKaydediliyor(false);
        }
    };

    return (
        <div className={kartCls}>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1"><Monitor size={18} className="text-blue-600" /> Masaüstü uygulaması</h3>
            {!destek ? (
                <p className="text-xs text-slate-500 mt-2">Bu ayarlar yalnızca bilgisayara kurulu MufYARD uygulamasında kullanılabilir.</p>
            ) : !a ? (
                <p className="text-xs text-slate-400 mt-2">Yükleniyor…</p>
            ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <Satir baslik="Bilgisayar açılınca MufYARD'ı başlat"
                        aciklama={a.paketli ? "Windows oturumu açıldığında uygulama kendiliğinden başlar." : "Geliştirme sürümünde uygulanmaz; kurulu sürümde çalışır."}>
                        <Anahtar acik={a.acilistaBaslat} disabled={kaydediliyor} onDegis={v => kaydet({ acilistaBaslat: v })} />
                    </Satir>
                    <Satir baslik="Açılışta pencere açmadan simge olarak başlat"
                        aciklama="Bilgisayar açılınca pencere açılmaz; saatin yanındaki MufYARD simgesinden açarsınız. Bildirim ve hatırlatmalar çalışır.">
                        <Anahtar acik={a.acilistaGizliBaslat} disabled={kaydediliyor || !a.acilistaBaslat} onDegis={v => kaydet({ acilistaGizliBaslat: v })} />
                    </Satir>
                    <Satir baslik="Kapatınca arka planda çalışmaya devam et"
                        aciklama={a.arkaPlandaCalis
                            ? "X'e basınca uygulama kapanmaz, sağ alttaki simgeye iner. Tamamen kapatmak için simgeye sağ tıklayıp Çıkış'ı seçin."
                            : "X'e basınca uygulama tamamen kapanır; hatırlatma ve bildirimler de durur."}>
                        <Anahtar acik={a.arkaPlandaCalis} disabled={kaydediliyor} onDegis={v => kaydet({ arkaPlandaCalis: v })} />
                    </Satir>
                    <Satir baslik="MufYARD'ı her yerden göster / gizle"
                        aciklama="Başka bir programdayken bile bu tuşlarla MufYARD öne gelir; tekrar basınca gizlenir.">
                        <TusKaydedici
                            deger={a.genelKisayol}
                            onKaydet={k => {
                                const sorun = kisayolSorunu(k);
                                if (sorun) return sorun;
                                if (!/^(Ctrl|Alt)/.test(k) || !/\+([A-Z0-9]|F\d{1,2})$/.test(k)) return "Ctrl veya Alt ile bir harf, rakam ya da F tuşu seçin.";
                                void kaydet({ genelKisayol: k });
                                return null;
                            }}
                            onTemizle={() => void kaydet({ genelKisayol: "" })}
                        />
                    </Satir>
                </div>
            )}
        </div>
    );
}
