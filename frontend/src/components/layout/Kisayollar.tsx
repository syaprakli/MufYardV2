import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Keyboard, X } from "lucide-react";
import {
    atamalar, DEGISTI_OLAYI, duzenlenebilirAlanda, ISLEMLER, kayitModundaMi, olaydanKisayol, tuslar,
} from "../../lib/kisayollar";

export function TusKutulari({ kisayol }: { kisayol: string }) {
    if (!kisayol) return <span className="text-[11px] text-slate-400">Atanmamış</span>;
    return (
        <span className="inline-flex items-center gap-1">
            {tuslar(kisayol).map((t, i) => (
                <kbd key={i} className="min-w-[24px] px-1.5 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center shadow-[0_1px_0_rgba(0,0,0,0.08)]">
                    {t}
                </kbd>
            ))}
        </span>
    );
}

/** Uygulama genelinde kısayolları dinler (MainLayout içinde bir kez). */
export function KisayolDinleyici() {
    const navigate = useNavigate();
    const [harita, setHarita] = useState<Record<string, string>>(() => atamalar());
    const [yardim, setYardim] = useState(false);

    useEffect(() => {
        const yenile = () => setHarita(atamalar());
        window.addEventListener(DEGISTI_OLAYI, yenile);
        window.addEventListener("storage", yenile);
        return () => {
            window.removeEventListener(DEGISTI_OLAYI, yenile);
            window.removeEventListener("storage", yenile);
        };
    }, []);

    useEffect(() => {
        const ters = new Map(Object.entries(harita).filter(([, k]) => k).map(([id, k]) => [k, id]));
        const dinle = (e: KeyboardEvent) => {
            if (e.repeat || kayitModundaMi()) return;
            if (e.key === "Escape" && yardim) { setYardim(false); return; }
            const k = olaydanKisayol(e);
            if (!k) return;
            const id = ters.get(k);
            if (!id) return;
            // Yazı alanındayken yalnızca Ctrl/Alt'lı ve F tuşlu kısayollar çalışır (zaten geçerlilik kuralı bu)
            if (duzenlenebilirAlanda(e.target) && !e.ctrlKey && !e.altKey && !/^F\d/.test(k)) return;
            const islem = ISLEMLER.find(i => i.id === id);
            if (!islem) return;
            e.preventDefault();
            e.stopPropagation();
            if (islem.id === "yardim") setYardim(v => !v);
            else if (islem.yol) { setYardim(false); navigate(islem.yol); }
        };
        window.addEventListener("keydown", dinle);
        return () => window.removeEventListener("keydown", dinle);
    }, [harita, navigate, yardim]);

    if (!yardim) return null;
    return (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setYardim(false)}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Klavye kısayolları"
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Keyboard size={16} className="text-blue-600" /> Klavye kısayolları</h2>
                    <button type="button" onClick={() => setYardim(false)} className="text-slate-400 hover:text-slate-700" title="Kapat (Esc)"><X size={18} /></button>
                </div>
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                    {ISLEMLER.filter(i => harita[i.id]).map(i => (
                        <div key={i.id} className="flex items-center justify-between py-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{i.ad}</span>
                            <TusKutulari kisayol={harita[i.id]} />
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => { setYardim(false); navigate("/settings?sekme=kisayollar"); }}
                    className="mt-4 text-[11px] font-bold text-blue-600 hover:underline">Kısayolları değiştir (Ayarlar)</button>
            </div>
        </div>
    );
}
