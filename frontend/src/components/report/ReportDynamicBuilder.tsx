import { useState, useMemo, useEffect } from "react";
import { 
    Layers, Plus, Trash2, Search, ArrowRight, 
    CheckCircle2, PlusCircle, X
} from "lucide-react";
import { Button } from "../ui/Button";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { 
    detectReportSections, 
    parseHtmlToStructuredReport, 
    compileStructuredReportToHtml,
    cleanCorruptedNarrativeText,
    type ReportSectionDef,
    type StructuredReportState,
    type DynamicSectionItem
} from "../../lib/reportSectionManager";
import { REPORT_TEMPLATES } from "../../lib/reportTemplates";
import { toast } from "react-hot-toast";

interface Props {
    htmlContent: string;
    reportTitle?: string;
    templateId?: string;
    onCompileAndSwitchToDoc: (compiledHtml: string) => void;
    onStateChange?: (state: StructuredReportState) => void;
}

export default function ReportDynamicBuilder({
    htmlContent,
    reportTitle = "",
    templateId,
    onCompileAndSwitchToDoc,
    onStateChange
}: Props) {
    const confirm = useConfirm();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");

    // 1. Rapor şablonuna göre resmi bölüm tanımlarını belirle
    const sectionDefs = useMemo(() => {
        return detectReportSections(htmlContent, reportTitle);
    }, [htmlContent, reportTitle]);

    // 2. Mevcut HTML'den yapılandırılmış durumu yükle
    const [reportState, setReportState] = useState<StructuredReportState>(() => {
        return parseHtmlToStructuredReport(htmlContent, sectionDefs);
    });

    // Bölüm tanımları değişirse durumu güncelle
    useEffect(() => {
        setReportState(parseHtmlToStructuredReport(htmlContent, sectionDefs));
    }, [sectionDefs]);

    // Toplam aktif bölüm ve madde sayıları
    const activeSections = useMemo(() => {
        return reportState.sections.filter(s => s.isActive);
    }, [reportState.sections]);

    const inactiveSections = useMemo(() => {
        return reportState.sections.filter(s => !s.isActive);
    }, [reportState.sections]);

    const totalClauses = useMemo(() => {
        return activeSections
            .filter(s => !s.sectionDef.isNarrative)
            .reduce((acc, curr) => acc + curr.clauses.length, 0);
    }, [activeSections]);

    // Her maddenin rapor genelindeki ardışık sıra numarasını hesaplayan harita (Giriş gibi açıklama bölümleri atlanır)
    const clauseSequenceMap = useMemo(() => {
        const map = new Map<string, number>();
        let counter = 1;
        activeSections.forEach(sec => {
            if (sec.sectionDef.isNarrative) return;
            sec.clauses.forEach(clause => {
                map.set(clause.id, counter++);
            });
        });
        return map;
    }, [activeSections]);

    // Arama filtrelemesi
    const filteredSections = useMemo(() => {
        return reportState.sections.filter(item => {
            if (statusFilter === "active" && !item.isActive) return false;
            if (statusFilter === "inactive" && item.isActive) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                item.sectionDef.title.toLowerCase().includes(q) ||
                item.sectionDef.description.toLowerCase().includes(q) ||
                item.clauses.some(c => c.text.toLowerCase().includes(q))
            );
        });
    }, [reportState.sections, statusFilter, searchQuery]);

    // Yeni madde ekleme
    const handleAddClause = (sectionId: string) => {
        const newClauseId = `clause-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionId) {
                    return {
                        ...s,
                        clauses: [
                            ...s.clauses,
                            { id: newClauseId, text: "" }
                        ]
                    };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });

        toast.success("Yeni tenkit maddesi eklendi.");
    };

    // Madde metnini güncelleme
    const handleUpdateClauseText = (sectionId: string, clauseId: string, newText: string) => {
        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionId) {
                    return {
                        ...s,
                        clauses: s.clauses.map(c => c.id === clauseId ? { ...c, text: newText } : c)
                    };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });
    };

    // Giriş / Açıklama metnini güncelleme
    const handleUpdateNarrativeText = (sectionId: string, text: string) => {
        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionId) {
                    return { ...s, narrativeText: text };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });
    };

    // Madde silme
    const handleDeleteClause = (sectionId: string, clauseId: string) => {
        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionId) {
                    return {
                        ...s,
                        clauses: s.clauses.filter(c => c.id !== clauseId)
                    };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });
        toast.success("Tenkit maddesi silindi; kalan maddeler baştan sıralandı.");
    };

    // Bölümü bu denetimden kaldırma (Pasife alma)
    const handleRemoveSection = async (sectionItem: DynamicSectionItem) => {
        if (sectionItem.clauses.length > 0) {
            const confirmed = await confirm({
                title: "Bölümü Kaldır",
                message: `"${sectionItem.sectionDef.title}" başlığı ve altındaki ${sectionItem.clauses.length} adet tenkit maddesi rapordan çıkarılacaktır. Devam etmek istiyor musunuz?`,
                confirmText: "Evet, Bölümü Kaldır",
                cancelText: "İptal",
                variant: "danger"
            });
            if (!confirmed) return;
        }

        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionItem.sectionDef.id) {
                    return { ...s, isActive: false };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });
        toast.success(`"${sectionItem.sectionDef.title}" bölümü bu denetimden çıkarıldı.`);
    };

    // Bölümü denetime dahil etme (Aktifleştirme)
    const handleRestoreSection = (sectionDef: ReportSectionDef) => {
        setReportState(prev => {
            const nextSections = prev.sections.map(s => {
                if (s.sectionDef.id === sectionDef.id) {
                    return { ...s, isActive: true };
                }
                return s;
            });
            const newState = { ...prev, sections: nextSections };
            if (onStateChange) onStateChange(newState);
            return newState;
        });
        toast.success(`"${sectionDef.title}" resmi sırasındaki yerine eklendi.`);
    };

    // TinyMCE editörüne derleme ve geçiş
    const handleCompileAndProceed = () => {
        // İlgili resmi kapağı bul
        const coverObj = REPORT_TEMPLATES.find(t => (templateId && t.id === templateId) || t.id === "1-_genel_teftiş_rapor_kapağı_taslağı_docx" || t.id.includes("kapağı"));
        const compiledHtml = compileStructuredReportToHtml(reportState, coverObj?.html);
        onCompileAndSwitchToDoc(compiledHtml);
        toast.success("Rapor derlendi ve resmi belge editörüne aktarıldı!");
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Üst Bilgi ve Aksiyon Çubuğu */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-xs">
                        <Layers size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 font-outfit">
                                Dinamik Rapor Yapılandırıcı
                            </h2>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {activeSections.length}/{sectionDefs.length} Resmi Bölüm
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                {totalClauses} Tenkit Maddesi
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Bölüm ve maddeleri dinamik olarak yönetin; hazır olduğunda resmi belge editörüne aktarın.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        size="md"
                        onClick={handleCompileAndProceed}
                        className="h-10 px-5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
                    >
                        <span>Rapora Derle & Editöre Geç</span>
                        <ArrowRight size={15} />
                    </Button>
                </div>
            </div>

            {/* Arama ve Filtreleme Şeridi */}
            <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                {/* Sekmeler */}
                <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <button
                        type="button"
                        onClick={() => setStatusFilter("active")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            statusFilter === "active"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        Aktif Bölümler ({activeSections.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            statusFilter === "all"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        Tüm Bölümler ({sectionDefs.length})
                    </button>
                    {inactiveSections.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter("inactive")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                statusFilter === "inactive"
                                    ? "bg-amber-600 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            Çıkarılanlar ({inactiveSections.length})
                        </button>
                    )}
                </div>

                {/* Arama Kutusu */}
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Bölüm veya tenkit ara..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Bölüm & Madde Kartları Alanı */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-5xl mx-auto w-full">
                {filteredSections.map(item => {
                    const sec = item.sectionDef;

                    // Pasif / Olmayan Bölüm Kartı
                    if (!item.isActive) {
                        return (
                            <div 
                                key={sec.id}
                                className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 p-4 sm:p-5 flex items-center justify-between gap-4 transition-all hover:border-slate-400"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1 opacity-70">
                                    <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                                        {sec.code}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate">
                                                {sec.title}
                                            </h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-500 shrink-0">
                                                Bu Denetimde Yok
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate mt-0.5">
                                            {sec.description}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestoreSection(sec)}
                                    className="h-9 px-3.5 text-xs font-bold border-blue-200 dark:border-blue-900 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl flex items-center gap-1.5 shrink-0"
                                >
                                    <PlusCircle size={14} /> Bu Bölümü Dahil Et
                                </Button>
                            </div>
                        );
                    }

                    // Aktif Bölüm Kartı
                    return (
                        <div 
                            key={sec.id}
                            className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
                        >
                            {/* Bölüm Başlığı */}
                            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                        {sec.code}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                                {sec.title}
                                            </h3>
                                            {sec.isNarrative ? (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                                    Açıklama / Giriş Bölümü
                                                </span>
                                            ) : item.clauses.length > 0 ? (
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                                    {item.clauses.length} Tenkit Maddesi
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                                                    Tenkit Yok
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                            {sec.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Aksiyonlar */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {!sec.isNarrative && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleAddClause(sec.id)}
                                            className="h-8 px-3 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-xs"
                                        >
                                            <Plus size={13} /> Madde Ekle
                                        </Button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSection(item)}
                                        title="Bölümü bu denetimden çıkar"
                                        className="w-8 h-8 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Bölüm İçeriği: Açıklama / Giriş veya Tenkit Maddeleri */}
                            <div className="p-4 sm:p-5 space-y-3.5">
                                {sec.isNarrative ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                                                Giriş ve Genel Açıklama Metni (Tenkit maddesi içermez):
                                            </span>
                                            <span className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200/50">
                                                Madde 1- sonraki teftiş bölümlerinde başlar
                                            </span>
                                        </div>
                                        <textarea
                                            rows={5}
                                            value={cleanCorruptedNarrativeText(item.narrativeText ?? sec.defaultNarrativeText ?? "", sec.defaultNarrativeText ?? "")}
                                            onChange={(e) => handleUpdateNarrativeText(sec.id, e.target.value)}
                                            placeholder="Makam onayı, görev emri, denetlenen birimler, teftiş tarihleri ve denetim kapsamı hakkında genel açıklama metni..."
                                            className="w-full p-3 text-xs rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium leading-relaxed resize-y shadow-2xs"
                                        />
                                        <p className="text-[11px] text-slate-400">
                                            ℹ️ Bu bölüm resmi rapor mevzuatı uyarınca tenkit maddesi numaralandırmasına tabi değildir. Teftiş tenkit maddeleri ("Madde 1-", "Madde 2-") Önceki Teftiş veya Spor Hizmetleri gibi takip eden bölümlerde sıralanır.
                                        </p>
                                    </div>
                                ) : item.clauses.length === 0 ? (
                                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-center">
                                        <p className="text-xs text-slate-400 font-medium mb-2">
                                            Bu bölüm için henüz bir tenkit veya tespit maddesi eklenmedi.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleAddClause(sec.id)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Bu bölüme tenkit maddesi ekle
                                        </button>
                                    </div>
                                ) : (
                                    item.clauses.map(clause => {
                                        const seqNum = clauseSequenceMap.get(clause.id) || 1;

                                        return (
                                            <div 
                                                key={clause.id}
                                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 shadow-2xs hover:border-blue-200 dark:hover:border-blue-900 transition-all"
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-400 font-outfit bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/50">
                                                        Madde {seqNum}-
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClause(sec.id, clause.id)}
                                                        title="Maddeyi Sil"
                                                        className="w-6 h-6 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                                <textarea
                                                    rows={3}
                                                    value={clause.text}
                                                    onChange={(e) => handleUpdateClauseText(sec.id, clause.id, e.target.value)}
                                                    placeholder="Tespit edilen aksaklık ve tenkit konusunu buraya yazın..."
                                                    className="w-full p-2.5 text-xs rounded-lg bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 font-medium leading-relaxed resize-y"
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Alt Footer Çubuğu */}
            <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between text-xs font-bold text-slate-400 shrink-0">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Resmi Mevzuat Sıralaması Kilitli • {activeSections.length} Aktif Bölüm
                </span>
                <Button
                    size="sm"
                    onClick={handleCompileAndProceed}
                    className="h-8 px-4 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                    <span>Editöre Aktar</span>
                    <ArrowRight size={13} />
                </Button>
            </div>
        </div>
    );
}
