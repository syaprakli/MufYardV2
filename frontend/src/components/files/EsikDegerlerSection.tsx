import React, { useState } from 'react';
import { 
    FileText, Download, ExternalLink, Calendar, Scale, Eye, Building, Briefcase
} from 'lucide-react';
import { Button } from '../ui/Button';
import { 
    ESIK_DEGERLER_DATA, ALL_YEARS, openEsikDegerPdf, downloadEsikDegerPdf
} from '../../lib/esikDegerlerData';
import { cn } from '../../lib/utils';

export const EsikDegerlerSection: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState<string>('2026');

    const currentItem = ESIK_DEGERLER_DATA[selectedYear] || ESIK_DEGERLER_DATA['2026'];

    return (
        <div className="flex flex-col gap-3 font-outfit">
            
            {/* Top Bar: Year Pills + Selected Year PDF Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 shrink-0">
                        Yıl:
                    </span>
                    {ALL_YEARS.map((yr) => {
                        const isSelected = selectedYear === yr;
                        const isCur = yr === '2026';
                        return (
                            <button
                                key={yr}
                                type="button"
                                onClick={() => setSelectedYear(yr)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                    isSelected
                                        ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/50"
                                )}
                            >
                                <span>{yr}</span>
                                {isCur && (
                                    <span className={cn(
                                        "text-[8px] px-1 rounded font-black uppercase",
                                        isSelected ? "bg-slate-950 text-amber-300" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                    )}>
                                        GÜNCEL
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* PDF Actions for Active Year */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => openEsikDegerPdf(currentItem)}
                        className="rounded-lg h-7 text-[10px] font-black uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2.5 shadow-sm shadow-amber-600/20"
                    >
                        <Eye size={12} />
                        <span>{selectedYear} PDF Aç</span>
                        <ExternalLink size={10} />
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadEsikDegerPdf(currentItem)}
                        className="rounded-lg h-7 text-[10px] font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1 px-2"
                        title="PDF'i Bilgisayara İndir"
                    >
                        <Download size={11} />
                        <span>İndir</span>
                    </Button>
                </div>
            </div>

            {/* Selected Year Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                        <Calendar size={12} className="text-amber-500" />
                        Dönem: <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{currentItem.donem}</span>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{currentItem.tebligNo}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">RG: {currentItem.resmiGazete}</span>
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                    {currentItem.pdfFileName}
                </div>
            </div>

            {/* Compact 3-Column Key Numbers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                
                {/* 1. Madde 8: Eşik Değerler */}
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Scale size={13} className="text-amber-500" />
                            Eşik Değerler (Md. 8)
                        </h5>
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            4734 / 8
                        </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">8/a Mal-Hizmet (Genel Bütçe)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.esikDegerler.malHizmetGenel}</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">8/b Mal-Hizmet (Diğer İdareler)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.esikDegerler.malHizmetDiger}</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold">
                            <span className="text-[10px]">8/c Yapım İşleri</span>
                            <span className="font-mono">{currentItem.esikDegerler.yapim}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Doğrudan Temin (Md. 22/d) */}
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Building size={13} className="text-amber-500" />
                            Doğrudan Temin (Md. 22/d)
                        </h5>
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            KDV Hariç
                        </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <div>
                                <div className="font-bold text-amber-900 dark:text-amber-200 text-[10px]">Büyükşehir Belediyeleri</div>
                                <div className="text-[8px] text-slate-400">B.Ş.B. Dahilindeki İdareler</div>
                            </div>
                            <span className="font-mono font-black text-xs text-amber-700 dark:text-amber-300">
                                {currentItem.parasalLimitler.dogrudanTeminBuyuksehir}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-[10px]">Diğer İdareler</div>
                                <div className="text-[8px] text-slate-400">Büyükşehir Dışındaki İdareler</div>
                            </div>
                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                {currentItem.parasalLimitler.dogrudanTeminDiger}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 3. Pazarlık & Diğer Limitler */}
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 shadow-sm flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Briefcase size={13} className="text-amber-500" />
                            Pazarlık & Özel Limitler
                        </h5>
                        <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                            Kanuni Sınırlar
                        </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">21/f Pazarlık (Mal-Hizmet)</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.parasalLimitler.pazarlik21f}</span>
                        </div>
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">3/g Ticari & Sınai İstisna</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.parasalLimitler.istisna3g}</span>
                        </div>
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">62/h Mühendis-Mimar Deneyim</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.parasalLimitler.muhendisMimarDeneyim62h}</span>
                        </div>
                        <div className="flex items-center justify-between p-1 rounded bg-slate-50 dark:bg-slate-800/40">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px]">53/j KİK Kurum Payı</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentItem.parasalLimitler.kurumPayiLimit53j1}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* 2020 - 2026 Compact Comparative Matrix Table & Direct PDF Access */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <FileText size={13} className="text-amber-500" />
                        2020 - 2026 Yıllara Göre Karşılaştırma & Resmi PDF Arşivi
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium hidden sm:inline">
                        Satıra tıklayarak o yılı seçebilir veya doğrudan PDF'i açabilirsiniz
                    </span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 uppercase text-[8px] font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                                <th className="py-1 px-2.5 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Yıl</th>
                                <th className="py-1 px-2 text-right">8/a Mal-Hizmet (Genel)</th>
                                <th className="py-1 px-2 text-right">8/b Mal-Hizmet (Diğer)</th>
                                <th className="py-1 px-2 text-right">8/c Yapım İşleri</th>
                                <th className="py-1 px-2 text-right text-amber-600 dark:text-amber-400 font-black">22/d Doğrudan Temin (BŞB)</th>
                                <th className="py-1 px-2 text-right">22/d Doğrudan Temin (Diğer)</th>
                                <th className="py-1 px-2 text-right">21/f Pazarlık</th>
                                <th className="py-1 px-2 text-right">62/h Deneyim</th>
                                <th className="py-1 px-2 text-center">Resmi PDF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                            {ALL_YEARS.map((yr) => {
                                const row = ESIK_DEGERLER_DATA[yr];
                                const isCur = yr === '2026';
                                const isSelected = selectedYear === yr;
                                return (
                                    <tr 
                                        key={yr} 
                                        onClick={() => setSelectedYear(yr)}
                                        className={cn(
                                            "hover:bg-amber-500/5 transition-colors cursor-pointer",
                                            isSelected && "bg-amber-500/10 font-bold text-slate-900 dark:text-slate-100",
                                            isCur && !isSelected && "bg-amber-500/[0.03]"
                                        )}
                                    >
                                        <td className="py-1 px-2.5 sticky left-0 bg-white/95 dark:bg-slate-900/95 z-10 flex items-center gap-1 font-bold font-mono text-[11px]">
                                            <span>{yr}</span>
                                            {isCur && (
                                                <span className="text-[7px] bg-amber-500 text-slate-950 px-1 rounded font-black">
                                                    GÜNCEL
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px]">{row.esikDegerler.malHizmetGenel}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px]">{row.esikDegerler.malHizmetDiger}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px] font-bold text-slate-900 dark:text-slate-100">{row.esikDegerler.yapim}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/5">{row.parasalLimitler.dogrudanTeminBuyuksehir}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px]">{row.parasalLimitler.dogrudanTeminDiger}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px]">{row.parasalLimitler.pazarlik21f}</td>
                                        <td className="py-1 px-2 text-right font-mono text-[10px]">{row.parasalLimitler.muhendisMimarDeneyim62h}</td>
                                        <td className="py-1 px-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEsikDegerPdf(row);
                                                    }}
                                                    className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline px-1.5 py-0.2 rounded hover:bg-amber-500/10"
                                                    title="PDF'i Görüntüle"
                                                >
                                                    <Eye size={10} /> PDF Aç
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadEsikDegerPdf(row);
                                                    }}
                                                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                                    title="PDF'i İndir"
                                                >
                                                    <Download size={10} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};
