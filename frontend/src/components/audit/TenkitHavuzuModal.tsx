import React, { useState, useEffect, useMemo } from "react";
import { 
    X, 
    Sparkles, 
    Check, 
    AlertTriangle, 
    ShieldAlert, 
    Plus, 
    CheckCircle2, 
    Filter,
    Edit3,
    Loader2
} from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "react-hot-toast";
import { analyzeAuditTables } from "../../lib/auditTenkitEngine";
import type { TenkitFinding } from "../../lib/auditTenkitEngine";
import { updateAudit } from "../../lib/api/audit";

interface TenkitHavuzuModalProps {
    isOpen: boolean;
    onClose: () => void;
    tables: any;
    years: (number | string)[];
    ilAdi: string;
    selectedReport: any;
    onSaveAuditData?: (data: any) => Promise<void>;
    localAuditData: any;
    setLocalAuditData: (data: any) => void;
}

export const TenkitHavuzuModal: React.FC<TenkitHavuzuModalProps> = ({
    isOpen,
    onClose,
    tables,
    years,
    ilAdi,
    selectedReport,
    onSaveAuditData,
    localAuditData,
    setLocalAuditData
}) => {
    const [findings, setFindings] = useState<TenkitFinding[]>([]);
    const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
    const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
    const [isTransferring, setIsTransferring] = useState<boolean>(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Run engine when modal opens or tables change
    useEffect(() => {
        if (isOpen) {
            const res = analyzeAuditTables(tables, years, ilAdi || "İl");
            const existingSaved = localAuditData?.istenecekTablolar?.tenkitHavuzu?.addedIds || [];
            setAddedIds(new Set(existingSaved));
            setFindings(res.findings);
        }
    }, [isOpen, tables, years, ilAdi]);

    const summary = useMemo(() => {
        return {
            total: findings.length,
            critical: findings.filter(f => f.severity === "critical").length,
            warning: findings.filter(f => f.severity === "warning").length,
            info: findings.filter(f => f.severity === "info").length,
            selectedCount: findings.filter(f => f.isSelected).length
        };
    }, [findings]);

    const filteredFindings = useMemo(() => {
        if (activeGroupFilter === "ALL") return findings;
        return findings.filter(f => f.groupCode === activeGroupFilter);
    }, [findings, activeGroupFilter]);

    const toggleSelect = (id: string) => {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, isSelected: !f.isSelected } : f));
    };

    const selectAll = (select: boolean) => {
        setFindings(prev => prev.map(f => ({ ...f, isSelected: select })));
    };

    const handleTextChange = (id: string, newText: string) => {
        setFindings(prev => prev.map(f => f.id === id ? { ...f, recommendationText: newText } : f));
    };

    // Format single finding to official audit report paragraph
    const formatFindingToHtml = (f: TenkitFinding): string => {
        const letter = f.itemLetter ? `${f.itemLetter}-) ` : "";
        return `<p class="ql-align-justify"><strong>${letter}${f.title}:</strong> ${f.recommendationText}</p>\n`;
    };

    // Append findings to report
    const transferFindings = async (itemsToTransfer: TenkitFinding[]) => {
        if (!selectedReport?.id) {
            toast.error("Aktarılacak aktif bir denetim raporu bulunamadı.");
            return;
        }
        if (itemsToTransfer.length === 0) {
            toast("Aktarılacak tenkit maddesi seçilmedi.", { icon: "⚠️" });
            return;
        }

        setIsTransferring(true);
        const toastId = toast.loading(`${itemsToTransfer.length} adet tenkit maddesi resmi rapora aktarılıyor...`);

        try {
            const currentReportContent = selectedReport.report_content || "";
            
            let htmlToAppend = `\n<p class="ql-align-justify">&nbsp;</p>\n<p class="ql-align-justify"><strong>(SPOR, TESİS VE MALİ VERİ ANALİZİ BİRİMİ)</strong></p>\n<p class="ql-align-justify"><strong>Madde 1:</strong> 2021-2025 Denetim Dönemi Özet Bilgiler ve İstatistik Tabloları (Sporcu, Antrenör, Hakem, Kulüp, Tesis, Temsilcilik ve Harcama İcmalleri) üzerinde yapılan detaylı veri analizi ve mevzuata uygunluk denetimi neticesinde;</p>\n`;

            itemsToTransfer.forEach((f) => {
                htmlToAppend += formatFindingToHtml(f);
            });
            htmlToAppend += `<p class="ql-align-justify">&nbsp;</p>\n`;

            // Insert into report
            let updatedContent = "";
            const marker = "--- RAPOR METNİ BAŞLANGICI ---</p>";
            const markerAlt = "--- RAPOR METN";
            if (currentReportContent.includes(marker)) {
                const pIdx = currentReportContent.indexOf(marker);
                const endP = currentReportContent.indexOf("</p>", pIdx) + 4;
                updatedContent = currentReportContent.slice(0, endP) + htmlToAppend + currentReportContent.slice(endP);
            } else if (currentReportContent.includes(markerAlt)) {
                const pIdx = currentReportContent.indexOf(markerAlt);
                const endP = currentReportContent.indexOf("</p>", pIdx) + 4;
                updatedContent = currentReportContent.slice(0, endP) + htmlToAppend + currentReportContent.slice(endP);
            } else {
                updatedContent = currentReportContent ? `${currentReportContent}\n${htmlToAppend}` : htmlToAppend;
            }

            // 1. Update audit in Firestore
            await updateAudit(selectedReport.id, {
                report_content: updatedContent,
                report_created: true
            });

            // 2. Update local state
            selectedReport.report_content = updatedContent;

            // 3. Mark IDs as added
            const newAddedIds = new Set(addedIds);
            itemsToTransfer.forEach(f => newAddedIds.add(f.id));
            setAddedIds(newAddedIds);

            // 4. Save metadata in localAuditData
            if (onSaveAuditData && localAuditData) {
                const updatedAuditData = {
                    ...localAuditData,
                    istenecekTablolar: {
                        ...(localAuditData.istenecekTablolar || {}),
                        tenkitHavuzu: {
                            addedIds: Array.from(newAddedIds),
                            lastUpdated: new Date().toISOString()
                        }
                    }
                };
                setLocalAuditData(updatedAuditData);
                await onSaveAuditData(updatedAuditData);
            }

            toast.success(`${itemsToTransfer.length} adet resmi tenkit maddesi teftiş raporuna başarıyla işlendi!`, { id: toastId, duration: 4000 });
        } catch (err: any) {
            console.error("Tenkit aktarım hatası:", err);
            toast.error("Rapora aktarım esnasında hata oluştu: " + (err.message || err), { id: toastId });
        } finally {
            setIsTransferring(false);
        }
    };

    if (!isOpen) return null;

    const GROUPS = [
        { id: "ALL", label: "Tümü (a-l)", count: findings.length },
        { id: "GRUP-1", label: "1. Sporcu & Başarı (a-f)", count: findings.filter(f => f.groupCode === "GRUP-1").length },
        { id: "GRUP-4", label: "2. Bütçe & Harcama (g)", count: findings.filter(f => f.groupCode === "GRUP-4").length },
        { id: "GRUP-3", label: "3. Kulüpler & Hakem (h)", count: findings.filter(f => f.groupCode === "GRUP-3").length },
        { id: "GRUP-2", label: "4. Tesis & Antrenör (i-j)", count: findings.filter(f => f.groupCode === "GRUP-2").length },
        { id: "GRUP-6", label: "5. Temsilciler (k)", count: findings.filter(f => f.groupCode === "GRUP-6").length },
        { id: "GRUP-5", label: "6. Gençlik (l)", count: findings.filter(f => f.groupCode === "GRUP-5").length },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* MODAL BAŞLIK */}
                <div className="px-5 py-4 bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                    Resmi Denetim Raporu Tenkit ve Bulgu Havuzu
                                </h3>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                    {ilAdi || "İl"} Müdürlüğü (2021-2025)
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Resmi teftiş raporu standartlarında hazırlanan analitik tenkit maddeleri (a, b, c, d, e, f, g, h, i, j, k, l).
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ÖZET İSTATİSTİK BARI */}
                <div className="px-5 py-2.5 bg-indigo-50/40 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Hazır Tenkit Maddesi: <strong className="text-slate-900 dark:text-white font-bold">{summary.total}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50 px-2 py-0.5 rounded-md">
                            <ShieldAlert size={13} /> Kritik Bulgu: {summary.critical}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                            <AlertTriangle size={13} /> Uyarı &amp; Tespit: {summary.warning}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => selectAll(true)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Tümünü Seç
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button
                            onClick={() => selectAll(false)}
                            className="text-[11px] font-bold text-slate-500 hover:underline"
                        >
                            Seçimi Kaldır
                        </button>
                    </div>
                </div>

                {/* KATEGORİ FİLTRE SEKMELERİ */}
                <div className="px-5 py-2 bg-slate-100/60 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    <Filter size={13} className="text-slate-400 shrink-0 ml-1 mr-1" />
                    {GROUPS.map(g => (
                        <button
                            key={g.id}
                            onClick={() => setActiveGroupFilter(g.id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                activeGroupFilter === g.id
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700"
                            }`}
                        >
                            <span>{g.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeGroupFilter === g.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                            }`}>
                                {g.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* BULGU LİSTESİ */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/50">
                    {filteredFindings.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                            <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">Bu grupta herhangi bir tenkit maddesi bulunamadı.</div>
                        </div>
                    ) : (
                        filteredFindings.map((finding) => {
                            const isAdded = addedIds.has(finding.id);
                            const isEditing = editingId === finding.id;

                            return (
                                <div
                                    key={finding.id}
                                    className={`rounded-2xl border transition-all p-4 ${
                                        finding.isSelected
                                            ? "bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 shadow-sm ring-1 ring-indigo-500/20"
                                            : "bg-white/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 opacity-80"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Sol Taraf: Checkbox & Başlık */}
                                        <div className="flex items-start gap-3 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={finding.isSelected}
                                                onChange={() => toggleSelect(finding.id)}
                                                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />

                                            <div className="space-y-2 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-700 text-white shadow-xs">
                                                        {finding.itemLetter ? `Madde ${finding.itemLetter}-)` : finding.ruleCode}
                                                    </span>

                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                        finding.severity === "critical"
                                                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                                    }`}>
                                                        {finding.groupName}
                                                    </span>

                                                    {isAdded && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                            <Check size={11} /> Rapora Eklendi
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="text-sm font-bold text-slate-850 dark:text-slate-100 leading-snug">
                                                    {finding.title}
                                                </h4>

                                                {/* Tetikleyici Özeti */}
                                                <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11.5px] text-slate-600 dark:text-slate-300">
                                                    <strong className="text-slate-800 dark:text-slate-100">İstatistiksel Tespit:</strong> {finding.trigger}
                                                </div>

                                                {/* Resmi Teftiş Tenkit Metni */}
                                                <div className="pt-1">
                                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                                                        <span>Resmi Teftiş Raporu Metni:</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingId(isEditing ? null : finding.id)}
                                                            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                                                        >
                                                            <Edit3 size={11} /> {isEditing ? "Tamamla" : "Metni Düzenle"}
                                                        </button>
                                                    </div>

                                                    {isEditing ? (
                                                        <textarea
                                                            value={finding.recommendationText}
                                                            onChange={(e) => handleTextChange(finding.id, e.target.value)}
                                                            rows={4}
                                                            className="w-full text-xs p-3 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                                                        />
                                                    ) : (
                                                        <p className="text-xs text-slate-800 dark:text-slate-200 bg-indigo-50/30 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 leading-relaxed text-justify font-sans">
                                                            {finding.recommendationText}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sağ Taraf: Tekli Ekle Butonu */}
                                        <div className="shrink-0 flex flex-col gap-1.5">
                                            <Button
                                                size="sm"
                                                variant={isAdded ? "outline" : "primary"}
                                                onClick={() => transferFindings([finding])}
                                                disabled={isTransferring}
                                                className={`rounded-xl text-[11px] font-bold h-8 px-3 ${
                                                    isAdded 
                                                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950" 
                                                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                                }`}
                                            >
                                                {isAdded ? (
                                                    <>
                                                        <Check size={12} className="mr-1" /> Tekrar Ekle
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={12} className="mr-1" /> Rapora Ekle
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* MODAL ALT ARAÇ ÇUBUĞU */}
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        Seçilen <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{summary.selectedCount}</strong> tenkit maddesi teftiş raporunun <em>"Özet Bilgiler ve İstatistik Tabloları"</em> tenkit bölümüne resmi formatta eklenecektir.
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="rounded-xl text-xs h-9 px-4 flex-1 sm:flex-initial"
                        >
                            Kapat
                        </Button>

                        <Button
                            onClick={() => {
                                const selectedItems = findings.filter(f => f.isSelected);
                                transferFindings(selectedItems);
                            }}
                            disabled={isTransferring || summary.selectedCount === 0}
                            className="rounded-xl text-xs font-bold h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 flex-1 sm:flex-initial"
                        >
                            {isTransferring ? (
                                <>
                                    <Loader2 size={13} className="animate-spin mr-1.5" /> Rapora Aktarılıyor...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={13} className="mr-1.5" /> Seçilen Maddeleri Rapora Aktar ({summary.selectedCount})
                                </>
                            )}
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
};
