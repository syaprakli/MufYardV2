import { useState, useMemo } from "react";
import { 
    X, Plus, Trash2, Eye, ListOrdered, 
    Search, Layers, RefreshCw, CheckCircle2,
    PlusCircle
} from "lucide-react";
import { Button } from "../ui/Button";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { 
    detectReportSections, 
    analyzeDocumentSections, 
    insertClauseToSection, 
    removeClauseAndRenumber,
    removeSectionFromDoc,
    restoreSectionToDoc,
    type ReportSectionDef
} from "../../lib/reportSectionManager";
import { toast } from "react-hot-toast";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    reportTitle?: string;
    onUpdateContent: (newHtml: string) => void;
    onScrollToSection?: (sectionId: string) => void;
    onSwitchToBuilder?: () => void;
}

export default function ReportEditorSectionPanel({
    isOpen,
    onClose,
    content,
    reportTitle = "",
    onUpdateContent,
    onScrollToSection,
    onSwitchToBuilder
}: Props) {
    const confirm = useConfirm();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "inDoc" | "notInDoc">("all");

    // 1. Raporun türüne uygun bölüm şemasını tespit et (İl 14 Başlık / Fed 8 Başlık vb.)
    const sectionDefs = useMemo(() => {
        return detectReportSections(content, reportTitle);
    }, [content, reportTitle]);

    // 2. Belge içerisindeki bölümleri ve maddeleri tara
    const sectionAnalysisList = useMemo(() => {
        return analyzeDocumentSections(content, sectionDefs);
    }, [content, sectionDefs]);

    // Toplam madde sayısı
    const totalClauses = useMemo(() => {
        return sectionAnalysisList.reduce((acc, curr) => acc + curr.clauseCount, 0);
    }, [sectionAnalysisList]);

    // Raporda mevcut ve çıkarılmış bölüm sayıları
    const inDocCount = useMemo(() => sectionAnalysisList.filter(s => s.existsInDoc).length, [sectionAnalysisList]);
    const notInDocCount = useMemo(() => sectionAnalysisList.filter(s => !s.existsInDoc).length, [sectionAnalysisList]);

    // Arama ve durum filtrelemesi
    const filteredSections = useMemo(() => {
        return sectionAnalysisList.filter(item => {
            if (statusFilter === "inDoc" && !item.existsInDoc) return false;
            if (statusFilter === "notInDoc" && item.existsInDoc) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                item.section.title.toLowerCase().includes(q) ||
                item.section.description.toLowerCase().includes(q) ||
                item.clauses.some(c => c.title.toLowerCase().includes(q))
            );
        });
    }, [sectionAnalysisList, statusFilter, searchQuery]);

    // Madde ekleme işlemi
    const handleAddClause = (section: ReportSectionDef) => {
        const { updatedHtml, clauseNumber } = insertClauseToSection(content, section.id, sectionDefs);
        onUpdateContent(updatedHtml);
        toast.success(`"${section.title}" altına Madde ${clauseNumber} eklendi.`);
        
        // Eklenen bölüme odaklan
        if (onScrollToSection) {
            setTimeout(() => onScrollToSection(section.id), 100);
        }
    };

    // Madde silme işlemi
    const handleDeleteClause = (clauseId: string) => {
        const updatedHtml = removeClauseAndRenumber(content, clauseId);
        onUpdateContent(updatedHtml);
        toast.success(`Madde silindi ve kalan maddeler yeniden sıralandı.`);
    };

    // Bölümü rapordan tamamen kaldırma (Silme)
    const handleRemoveSection = async (section: ReportSectionDef, clauseCount: number) => {
        if (clauseCount > 0) {
            const confirmed = await confirm({
                title: "Bölümü Kaldır",
                message: `"${section.title}" başlığı ve altındaki ${clauseCount} adet tenkit maddesi rapordan tamamen silinecektir. Kalan maddeler ardışık olarak yeniden numaralandırılacaktır. Devam etmek istiyor musunuz?`,
                confirmText: "Evet, Bölümü ve Maddeleri Sil",
                cancelText: "İptal",
                variant: "danger"
            });
            if (!confirmed) return;
        }

        const updatedHtml = removeSectionFromDoc(content, section.id, sectionDefs);
        onUpdateContent(updatedHtml);
        toast.success(`"${section.title}" bölümü rapordan kaldırıldı.`);
    };

    // Çıkarılmış bölümü resmi sırasına geri ekleme
    const handleRestoreSection = (section: ReportSectionDef) => {
        const updatedHtml = restoreSectionToDoc(content, section.id, sectionDefs);
        onUpdateContent(updatedHtml);
        toast.success(`"${section.title}" resmi sırasındaki yerine eklendi.`);
        if (onScrollToSection) {
            setTimeout(() => onScrollToSection(section.id), 120);
        }
    };

    // Tüm maddeleri sırayla yeniden numaralandırma
    const handleRenumberAll = () => {
        let counter = 1;
        const renumbered = content.replace(/<strong>\s*Madde\s+\d+\s*:\s*<\/strong>/gi, () => {
            const repl = `<strong>Madde ${counter}: </strong>`;
            counter++;
            return repl;
        });
        onUpdateContent(renumbered);
        toast.success(`Tüm maddeler 1'den ${counter - 1}'e kadar sırayla güncellendi.`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-[120] w-full sm:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <Layers size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 font-outfit flex items-center gap-2">
                            Rapor Yapısı & Maddeler
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {totalClauses} Madde
                            </span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {inDocCount}/{sectionDefs.length} Aktif Bölüm • Sıralı Madde Yönetimi
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {onSwitchToBuilder && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                onClose();
                                onSwitchToBuilder();
                            }} 
                            className="h-7 px-2.5 text-[10px] font-black text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/50 hover:bg-blue-100 rounded-lg"
                        >
                            Dinamik Editöre Geç ➔
                        </Button>
                    )}
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    >
                        <X size={16} />
                    </Button>
                </div>
            </div>

            {/* Durum Filtre Tabları */}
            <div className="px-3 pt-2.5 pb-0 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                        statusFilter === "all"
                            ? "text-blue-600 border-blue-600 bg-white dark:bg-slate-900 shadow-2xs"
                            : "text-slate-400 hover:text-slate-600 border-transparent"
                    }`}
                >
                    Tümü ({sectionDefs.length})
                </button>
                <button
                    type="button"
                    onClick={() => setStatusFilter("inDoc")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
                        statusFilter === "inDoc"
                            ? "text-blue-600 border-blue-600 bg-white dark:bg-slate-900 shadow-2xs"
                            : "text-slate-400 hover:text-slate-600 border-transparent"
                    }`}
                >
                    <span>Raporda Olanlar</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600">{inDocCount}</span>
                </button>
                {notInDocCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setStatusFilter("notInDoc")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
                            statusFilter === "notInDoc"
                                ? "text-amber-600 border-amber-600 bg-white dark:bg-slate-900 shadow-2xs"
                                : "text-slate-400 hover:text-slate-600 border-transparent"
                        }`}
                    >
                        <span>Çıkarılanlar</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600">{notInDocCount}</span>
                    </button>
                )}
            </div>

            {/* Arama ve Hızlı Aksiyon Çubuğu */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Bölüm veya madde ara (Örn: Spor, Yurt)..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRenumberAll}
                    title="Madde numaralandırmalarını kontrol et ve baştan hizala"
                    className="h-8 px-2.5 text-[10px] font-bold border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                >
                    <RefreshCw size={11} className="mr-1" /> Sırala
                </Button>
            </div>

            {/* Bölüm & Madde Listesi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredSections.map((item) => {
                    const sec = item.section;

                    if (!item.existsInDoc) {
                        return (
                            <div 
                                key={sec.id}
                                className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all hover:border-slate-400"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 opacity-70">
                                    <span className="w-5 h-5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                                        {sec.code}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                                                {sec.title}
                                            </h4>
                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 shrink-0">
                                                Raporda Yok
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {sec.description}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestoreSection(sec)}
                                    className="h-7 px-2.5 text-[10px] font-bold border-blue-200 dark:border-blue-900/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg flex items-center gap-1 shrink-0"
                                >
                                    <PlusCircle size={11} /> Bölümü Ekle
                                </Button>
                            </div>
                        );
                    }

                    return (
                        <div 
                            key={sec.id}
                            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                item.clauseCount > 0 
                                    ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/40 shadow-xs" 
                                    : "bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300"
                            }`}
                        >
                            {/* Bölüm Başlık Çubuğu */}
                            <div className="p-3 sm:p-3.5 flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <span className="w-5 h-5 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {sec.code}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                                                {sec.title}
                                            </h4>
                                            {item.clauseCount > 0 && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                                    {item.clauseCount} Madde
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                                            {sec.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Aksiyonlar */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {onScrollToSection && (
                                        <button
                                            type="button"
                                            onClick={() => onScrollToSection(sec.id)}
                                            title="Editörde bu başlığa odaklan"
                                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center transition-colors"
                                        >
                                            <Eye size={13} />
                                        </button>
                                    )}
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddClause(sec)}
                                        className="h-7 px-2.5 text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 shadow-xs"
                                    >
                                        <Plus size={11} /> Madde Ekle
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSection(sec, item.clauseCount)}
                                        title="Bölümü Rapordan Kaldır"
                                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Bu bölüm altındaki maddeler */}
                            {item.clauseCount > 0 && (
                                <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-slate-800/60 bg-blue-50/20 dark:bg-blue-950/10 space-y-1.5 mt-1">
                                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 pt-2">
                                        Eklenen Tenkit/Tespitler:
                                    </p>
                                    {item.clauses.map((clause) => (
                                        <div 
                                            key={clause.id}
                                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-2xs group"
                                        >
                                            <div className="flex items-center gap-1.5 truncate min-w-0">
                                                <ListOrdered size={12} className="text-blue-500 shrink-0" />
                                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                    {clause.title}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteClause(clause.id)}
                                                title="Maddeyi Sil"
                                                className="w-6 h-6 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors shrink-0"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Bilgilendirme */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between text-[11px] font-bold text-slate-400 shrink-0">
                <span className="flex items-center gap-1 text-[10px]">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    Resmi Mevzuat Sıralaması Kilitli
                </span>
                <span className="text-[10px]">
                    Toplam {totalClauses} Tenkit Maddesi
                </span>
            </div>
        </div>
    );
}
