import { useState } from "react";
import { Camera, Check, FileText, Loader2, Plus, StickyNote, X } from "lucide-react";
import { getSafeImageUrl, handleImageError } from "../../lib/utils";
import type { Kanit } from "../../lib/api/tenkitler";

export const MAX_KANIT = 30;

/** Galeride bağlanabilir fotoğraf: data:/blob: adresler tenkite bağlanamaz (belge boyutu). */
export const baglanabilirFoto = (url: string) => /^https?:\/\//.test(url) || (url.startsWith("/") && !url.startsWith("//"));

const yeniId = () => `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Kanıtın rapordaki adı: fotoğraflar galerideki sırasıyla anılır ("Fotoğraf 3"). */
export function kanitEtiketi(k: Kanit, photos: string[]): string {
    if (k.tur === "foto") {
        const sira = photos.indexOf(k.url || "");
        return sira >= 0 ? `Fotoğraf ${sira + 1}` : "Fotoğraf (galeriden kaldırılmış)";
    }
    return k.ad || (k.tur === "belge" ? "Belge" : "Not");
}

interface Props {
    kanitlar: Kanit[];
    photos: string[];
    photoDescriptions: Record<string, string>;
    kaydediliyor: boolean;
    onKaydet: (kanitlar: Kanit[]) => void;
}

export function TenkitKanitlari({ kanitlar, photos, photoDescriptions, kaydediliyor, onKaydet }: Props) {
    const [secici, setSecici] = useState(false);
    const [secili, setSecili] = useState<Set<string>>(new Set());
    const [belge, setBelge] = useState<{ tur: "belge" | "not"; ad: string } | null>(null);

    const bagliFotolar = new Set(kanitlar.filter(k => k.tur === "foto").map(k => k.url));
    const adaylar = photos.filter(u => baglanabilirFoto(u));
    const kalan = MAX_KANIT - kanitlar.length;

    const seciciAc = () => {
        setSecili(new Set(Array.from(bagliFotolar).filter(Boolean) as string[]));
        setSecici(true);
        setBelge(null);
    };

    const fotolariKaydet = () => {
        const digerleri = kanitlar.filter(k => k.tur !== "foto" || !adaylar.includes(k.url || ""));
        const mevcut = new Map(kanitlar.filter(k => k.tur === "foto").map(k => [k.url, k]));
        const fotolar: Kanit[] = adaylar
            .filter(u => secili.has(u))
            .map(u => mevcut.get(u) || { id: yeniId(), tur: "foto", url: u, aciklama: photoDescriptions[u] || "" });
        onKaydet([...digerleri, ...fotolar].slice(0, MAX_KANIT));
        setSecici(false);
    };

    const belgeEkle = () => {
        if (!belge?.ad.trim()) return;
        onKaydet([...kanitlar, { id: yeniId(), tur: belge.tur, ad: belge.ad.trim() }]);
        setBelge(null);
    };

    return (
        <div className="md:col-span-2 space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Kanıtlar ({kanitlar.length})
                </span>
                <div className="flex items-center gap-1.5">
                    {kaydediliyor && <Loader2 size={12} className="animate-spin text-blue-500" />}
                    <button type="button" onClick={seciciAc} disabled={kaydediliyor}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 hover:bg-blue-100">
                        <Camera size={12} /> Fotoğraf bağla
                    </button>
                    <button type="button" disabled={kaydediliyor || kalan <= 0}
                        onClick={() => { setBelge({ tur: "belge", ad: "" }); setSecici(false); }}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                        <Plus size={12} /> Belge / not
                    </button>
                </div>
            </div>

            {kanitlar.length === 0 && !secici && !belge && (
                <p className="text-[11px] text-amber-600">Bu tenkite henüz kanıt bağlanmadı. Fotoğraf veya belge referansı (ör. "Ek-3: 2025 yılı mizanı") ekleyin.</p>
            )}

            {kanitlar.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {kanitlar.map(k => (
                        <div key={k.id} className="group relative flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pr-6 max-w-[260px]">
                            {k.tur === "foto" ? (
                                <img src={getSafeImageUrl(k.url || "")} onError={handleImageError} alt=""
                                    className="w-10 h-10 object-cover rounded-l-lg shrink-0" />
                            ) : (
                                <span className="w-10 h-10 flex items-center justify-center shrink-0 text-slate-400">
                                    {k.tur === "belge" ? <FileText size={16} /> : <StickyNote size={16} />}
                                </span>
                            )}
                            <span className="text-[11px] leading-tight py-1 min-w-0">
                                <b className="block text-slate-700 dark:text-slate-200 truncate">{kanitEtiketi(k, photos)}</b>
                                {k.tur === "foto" && (photoDescriptions[k.url || ""] || k.aciklama) && (
                                    <span className="block text-slate-400 truncate">{photoDescriptions[k.url || ""] || k.aciklama}</span>
                                )}
                            </span>
                            <button type="button" disabled={kaydediliyor} title="Kanıtı kaldır"
                                onClick={() => onKaydet(kanitlar.filter(x => x.id !== k.id))}
                                className="absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white">
                                <X size={11} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {secici && (
                <div className="space-y-2 pt-1">
                    {adaylar.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                            Galeride bağlanabilir fotoğraf yok. Önce "Fotoğraflar" bölümünden fotoğraf ekleyin.
                        </p>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5 max-h-56 overflow-y-auto">
                            {adaylar.map(u => {
                                const on = secili.has(u);
                                return (
                                    <button key={u} type="button" title={photoDescriptions[u] || kanitEtiketi({ id: "", tur: "foto", url: u }, photos)}
                                        onClick={() => setSecili(s => { const n = new Set(s); if (n.has(u)) n.delete(u); else n.add(u); return n; })}
                                        className={`relative aspect-square rounded-lg overflow-hidden border-2 ${on ? "border-blue-500" : "border-transparent"}`}>
                                        <img src={getSafeImageUrl(u)} onError={handleImageError} alt="" className="w-full h-full object-cover" />
                                        <span className="absolute bottom-0 left-0 text-[9px] font-black bg-black/60 text-white px-1">{photos.indexOf(u) + 1}</span>
                                        {on && <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white rounded p-0.5"><Check size={10} /></span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {photos.length > adaylar.length && (
                        <p className="text-[10px] text-slate-400">Cihazda kalmış (sunucuya yüklenmemiş) {photos.length - adaylar.length} fotoğraf bağlanamaz.</p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setSecici(false)} className="text-[11px] font-bold text-slate-500 px-2 py-1">Vazgeç</button>
                        <button type="button" onClick={fotolariKaydet} disabled={adaylar.length === 0}
                            className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1">
                            Seçimi kaydet ({secili.size})
                        </button>
                    </div>
                </div>
            )}

            {belge && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <select value={belge.tur} onChange={e => setBelge({ ...belge, tur: e.target.value as "belge" | "not" })}
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] px-2">
                        <option value="belge">Belge</option>
                        <option value="not">Not</option>
                    </select>
                    <input autoFocus value={belge.ad} maxLength={300}
                        onChange={e => setBelge({ ...belge, ad: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") belgeEkle(); if (e.key === "Escape") setBelge(null); }}
                        placeholder={belge.tur === "belge" ? "Ör. Ek-3: 2025 yılı mizanı" : "Ör. Muhasebe yetkilisi ile görüşme, 12.03.2026"}
                        className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] px-2 outline-none" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setBelge(null)} className="text-[11px] font-bold text-slate-500 px-2">Vazgeç</button>
                        <button type="button" onClick={belgeEkle} disabled={!belge.ad.trim()}
                            className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 h-8">Ekle</button>
                    </div>
                </div>
            )}
        </div>
    );
}
