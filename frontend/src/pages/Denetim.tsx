import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Shield, BookOpen, ClipboardCheck, Bot, Plus, Edit2, Trash2, Search,
    Tag, ChevronRight, X, Check, Loader2, Database, Sparkles, FileText,
    ArrowRight, Info, AlertCircle, Save, ExternalLink
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { API_URL } from "../lib/config";
import { toast } from "react-hot-toast";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { createAudit, updateAudit } from "../lib/api/audit";

interface KnowledgeItem {
    id: string;
    category: string;
    topic: string;
    description: string;
    standard_remark: string;
    tags: string[];
    created_at: string;
    updated_at?: string;
}

const PRESET_CATEGORIES = [
    "Yurt İşlemleri", "Spor Tesisi", "Federasyon", "Denetim Genel",
    "İdari İşlemler", "Mali İşlemler", "Teknik Kontrol", "Diğer"
];

const emptyForm = {
    category: "",
    topic: "",
    description: "",
    standard_remark: "",
    tags: [] as string[],
};

export default function Denetim() {
    const confirm = useConfirm();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { data: cachedData, refreshAudits } = useGlobalData();

    // 1. Sidebar / Category Navigation
    const [activeTab, setActiveTab] = useState<string>("il");

    // 2. Active Task / Selection States
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // 3. AI Knowledge base states (CRUD)
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [knowledgeSearch, setKnowledgeSearch] = useState("");
    const [knowledgeCategoryFilter, setKnowledgeCategoryFilter] = useState<string | null>(null);
    const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
    const [editingKnowledgeItem, setEditingKnowledgeItem] = useState<KnowledgeItem | null>(null);
    const [knowledgeSaving, setKnowledgeSaving] = useState(false);
    const [knowledgeTagInput, setKnowledgeTagInput] = useState("");
    const [knowledgeForm, setKnowledgeForm] = useState({ ...emptyForm });

    // 4. Integrated Report Editor States
    const [reportEditing, setReportEditing] = useState(false);
    const [reportContent, setReportContent] = useState("");
    const [reportSaving, setReportSaving] = useState(false);

    // 5. Tenkit Bank search inside Report view
    const [tenkitSearch, setTenkitSearch] = useState("");
    const [tenkitResults, setTenkitResults] = useState<KnowledgeItem[]>([]);

    // Map categories
    const AUDIT_CATEGORIES = [
        { id: "il", label: "İl Denetimi", icon: Shield },
        { id: "federasyon", label: "Federasyon Denetimi", icon: BookOpen },
        { id: "kyk", label: "Kyk Yurt Denetimi", icon: ClipboardCheck },
        { id: "ozel", label: "Özel Yurt Denetimi", icon: ClipboardCheck },
        { id: "spor", label: "Spor Kulüpleri Denetimi", icon: ClipboardCheck },
        { id: "bilgi_bankasi", label: "AI Bilgi Bankası", icon: Bot }
    ];

    const categoryMap: Record<string, string> = {
        il: "İl Denetimi",
        federasyon: "Federasyon Denetimi",
        kyk: "Kyk Yurt Denetimi",
        ozel: "Özel Yurt Denetimi",
        spor: "Spor Kulüpleri Denetimi"
    };

    const currentRaporTuru = categoryMap[activeTab];

    // Get tasks from global context
    const filteredTasks = useMemo(() => {
        if (!cachedData?.tasks || !currentRaporTuru) return [];
        return cachedData.tasks.filter(t => t.rapor_turu === currentRaporTuru);
    }, [cachedData?.tasks, currentRaporTuru]);

    // Selected Task Details
    const selectedTask = useMemo(() => {
        if (!selectedTaskId || !cachedData?.tasks) return null;
        return cachedData.tasks.find(t => t.id === selectedTaskId) || null;
    }, [selectedTaskId, cachedData?.tasks]);

    // Audit (Report) for selected task
    const selectedReport = useMemo(() => {
        if (!selectedTaskId || !cachedData?.audits) return null;
        return cachedData.audits.find(a => a.task_id === selectedTaskId) || null;
    }, [selectedTaskId, cachedData?.audits]);

    // Child Kyk Yurt Denetimleri (if selected is İl Denetimi)
    const childKykTasks = useMemo(() => {
        if (!selectedTaskId || activeTab !== "il" || !cachedData?.tasks) return [];
        return cachedData.tasks.filter(t => t.rapor_turu === "Kyk Yurt Denetimi" && t.parent_task_id === selectedTaskId);
    }, [selectedTaskId, activeTab, cachedData?.tasks]);

    // Parent İl Denetimi (if selected is Kyk Yurt Denetimi)
    const parentIlTask = useMemo(() => {
        if (!selectedTask || activeTab !== "kyk" || !selectedTask.parent_task_id || !cachedData?.tasks) return null;
        return cachedData.tasks.find(t => t.id === selectedTask.parent_task_id) || null;
    }, [selectedTask, activeTab, cachedData?.tasks]);

    // Reset report states when report changes
    useEffect(() => {
        if (selectedReport) {
            setReportContent(selectedReport.report_content || "");
        } else {
            setReportContent("");
        }
        setReportEditing(false);
    }, [selectedReport]);

    // Load AI Knowledge Base Items
    const loadKnowledgeItems = useCallback(async () => {
        setKnowledgeLoading(true);
        try {
            const url = knowledgeCategoryFilter
                ? `${API_URL}/ai-knowledge/?category=${encodeURIComponent(knowledgeCategoryFilter)}`
                : `${API_URL}/ai-knowledge/`;
            const headers = await getAuthHeaders();
            const res = await fetchWithTimeout(url, { headers });
            const data = await res.json();
            setKnowledgeItems(data);
            // Also update search presets
            setTenkitResults(data);
        } catch {
            toast.error("Bilgi bankası yüklenemedi.");
        } finally {
            setKnowledgeLoading(false);
        }
    }, [knowledgeCategoryFilter]);

    useEffect(() => {
        loadKnowledgeItems();
    }, [loadKnowledgeItems]);

    // Search Tenkit Bank internally for current report
    useEffect(() => {
        if (!tenkitSearch.trim()) {
            setTenkitResults(knowledgeItems);
            return;
        }
        const filtered = knowledgeItems.filter(item =>
            item.topic.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.description.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.standard_remark.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.category.toLowerCase().includes(tenkitSearch.toLowerCase())
        );
        setTenkitResults(filtered);
    }, [tenkitSearch, knowledgeItems]);

    // Knowledge CRUD functions
    const resetKnowledgeForm = () => {
        setKnowledgeForm({ ...emptyForm });
        setEditingKnowledgeItem(null);
        setKnowledgeTagInput("");
    };

    const openAddKnowledge = () => { resetKnowledgeForm(); setShowKnowledgeModal(true); };

    const openEditKnowledge = (item: KnowledgeItem) => {
        setEditingKnowledgeItem(item);
        setKnowledgeForm({
            category: item.category,
            topic: item.topic,
            description: item.description,
            standard_remark: item.standard_remark,
            tags: item.tags || [],
        });
        setShowKnowledgeModal(true);
    };

    const handleSaveKnowledge = async () => {
        if (!knowledgeForm.category || !knowledgeForm.topic || !knowledgeForm.standard_remark) {
            toast.error("Kategori, konu ve tenkit metni zorunludur.");
            return;
        }
        setKnowledgeSaving(true);
        try {
            if (editingKnowledgeItem) {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/${editingKnowledgeItem.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(knowledgeForm),
                });
                toast.success("Güncellendi.");
            } else {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(knowledgeForm),
                });
                toast.success("Tenkit maddesi eklendi.");
            }
            setShowKnowledgeModal(false);
            resetKnowledgeForm();
            loadKnowledgeItems();
        } catch {
            toast.error("Kaydedilemedi.");
        } finally {
            setKnowledgeSaving(false);
        }
    };

    const handleDeleteKnowledge = async (item: KnowledgeItem) => {
        const confirmed = await confirm({
            title: "Maddeyi Sil",
            message: `"${item.topic}" tenkit maddesini silmek istediğinize emin misiniz?`,
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        try {
            const headers = await getAuthHeaders();
            await fetchWithTimeout(`${API_URL}/ai-knowledge/${item.id}`, { method: "DELETE", headers });
            toast.success("Silindi.");
            loadKnowledgeItems();
        } catch {
            toast.error("Silinemedi.");
        }
    };

    const addKnowledgeTag = () => {
        const tag = knowledgeTagInput.trim();
        if (tag && !knowledgeForm.tags.includes(tag)) {
            setKnowledgeForm(f => ({ ...f, tags: [...f.tags, tag] }));
        }
        setKnowledgeTagInput("");
    };

    const removeKnowledgeTag = (tag: string) => {
        setKnowledgeForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
    };

    // Create Report
    const handleCreateReport = async () => {
        if (!selectedTask) return;
        try {
            const newAuditPayload = {
                task_id: selectedTask.id,
                title: `${selectedTask.rapor_adi} Denetim Raporu`,
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: profile?.full_name || user?.displayName || user?.email?.split('@')[0] || "Müfettiş",
                status: "Devam Ediyor",
                report_content: `<h1>${selectedTask.rapor_adi} DENETİM RAPORU</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`,
                owner_id: user?.uid,
                assigned_to: [user?.uid].filter(Boolean) as string[],
                report_seq: 1
            };
            await createAudit(newAuditPayload);
            toast.success("Rapor başarıyla oluşturuldu.");
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch (error) {
            console.error(error);
            toast.error("Rapor oluşturulamadı.");
        }
    };

    // Save report edits
    const handleSaveReport = async () => {
        if (!selectedReport) return;
        setReportSaving(true);
        try {
            await updateAudit(selectedReport.id, {
                report_content: reportContent
            });
            toast.success("Rapor başarıyla kaydedildi.");
            setReportEditing(false);
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch {
            toast.error("Rapor kaydedilemedi.");
        } finally {
            setReportSaving(false);
        }
    };

    // Append AI Tenkit Item to current report
    const handleAppendTenkit = async (item: KnowledgeItem) => {
        if (!selectedReport) return;
        
        // Append inside a clean paragraph
        const formattedRemark = `<p><strong>Bulgu: ${item.topic}</strong><br/>${item.standard_remark}</p>`;
        const updatedContent = reportContent + formattedRemark;
        
        setReportContent(updatedContent);
        
        try {
            await updateAudit(selectedReport.id, {
                report_content: updatedContent
            });
            toast.success(`"${item.topic}" rapora eklendi ve kaydedildi.`);
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch (error) {
            console.error(error);
            toast.error("Metin eklendi ancak otomatik kaydedilemedi. Lütfen manuel kaydedin.");
        }
    };

    // Filter Knowledge CRUD items
    const filteredKnowledge = knowledgeItems.filter(item => {
        const matchSearch = !knowledgeSearch ||
            item.topic.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.description.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.standard_remark.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.category.toLowerCase().includes(knowledgeSearch.toLowerCase());
        const matchCat = !knowledgeCategoryFilter || item.category === knowledgeCategoryFilter;
        return matchSearch && matchCat;
    });

    const knowledgeCategories = [...new Set(knowledgeItems.map(i => i.category))].sort();

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-110px)] overflow-hidden animate-in fade-in duration-300">
            {/* 1. Subcategory sidebar */}
            <div className="w-full lg:w-64 bg-slate-950/40 backdrop-blur-md border border-slate-900/50 rounded-2xl p-4 flex flex-col gap-2 flex-shrink-0 overflow-y-auto">
                <div className="px-3 py-2">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Denetim Türleri</h2>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Alt Kategoriler ve Bilgi Bankası</p>
                </div>
                
                <div className="h-px bg-slate-900/50 my-1" />

                {AUDIT_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isActive = activeTab === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setActiveTab(cat.id);
                                setSelectedTaskId(null);
                            }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold text-sm ${
                                isActive
                                    ? "bg-primary-light text-white shadow-md shadow-black/10 border-l-4 border-blue-500"
                                    : "text-slate-400 hover:bg-slate-900/30 hover:text-white"
                            }`}
                        >
                            <Icon size={16} className={isActive ? "text-blue-400 animate-pulse" : "text-slate-500"} />
                            <span className="flex-1 truncate">{cat.label}</span>
                            {cat.id !== "bilgi_bankasi" && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                    isActive ? "bg-blue-500/20 text-blue-400" : "bg-slate-900 text-slate-500"
                                }`}>
                                    {cachedData?.tasks?.filter(t => t.rapor_turu === categoryMap[cat.id]).length || 0}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Main content split */}
            {activeTab === "bilgi_bankasi" ? (
                // AI Knowledge Base Management Panel
                <div className="flex-1 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                                <Bot size={10} className="text-blue-500" />
                                <span>Kütüphane</span>
                                <ChevronRight size={10} />
                                <span className="text-blue-500">AI Bilgi Bankası</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Standart Tenkit Maddeleri</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">
                                Denetim ve inceleme raporlarında hazır şablon olarak kullanılabilecek resmi tenkit metinleri.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-4 py-2.5 rounded-xl text-[10px] font-black border border-blue-100 dark:border-blue-900/20 shadow-sm h-11">
                                <Database size={14} />
                                <span>{knowledgeItems.length} Madde</span>
                            </div>
                            <Button onClick={openAddKnowledge} size="sm" className="rounded-xl h-11 px-5 shadow-md shadow-primary/20">
                                <Plus size={16} className="mr-2" /> YENİ MADDE
                            </Button>
                        </div>
                    </div>

                    {/* Stats & filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={knowledgeSearch}
                                onChange={e => setKnowledgeSearch(e.target.value)}
                                placeholder="Madde, konu veya metin ara..."
                                className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 dark:border-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setKnowledgeCategoryFilter(null)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    !knowledgeCategoryFilter
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                Tümü ({knowledgeItems.length})
                            </button>
                            {knowledgeCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setKnowledgeCategoryFilter(cat === knowledgeCategoryFilter ? null : cat)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                        knowledgeCategoryFilter === cat
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    {cat} ({knowledgeItems.filter(i => i.category === cat).length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Knowledge items grid */}
                    {knowledgeLoading ? (
                        <div className="flex-1 flex items-center justify-center py-20">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                        </div>
                    ) : filteredKnowledge.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                                <BookOpen size={28} className="text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-slate-600 dark:text-slate-350 font-bold">
                                    {knowledgeSearch ? "Arama sonucu bulunamadı." : "Henüz tenkit maddesi eklenmemiş."}
                                </p>
                                <p className="text-slate-400 text-sm mt-1">
                                    {knowledgeSearch ? "Farklı bir arama terimi deneyin." : "Sistemdeki ilk tenkit metninizi ekleyin."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pr-1">
                            {filteredKnowledge.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/40 p-6 flex flex-col justify-between hover:shadow-md transition-all group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div>
                                                <span className="inline-block bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mb-1">
                                                    {item.category}
                                                </span>
                                                <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{item.topic}</h3>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button
                                                    onClick={() => openEditKnowledge(item)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteKnowledge(item)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 flex items-center justify-center transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {item.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 leading-relaxed">{item.description}</p>
                                        )}

                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Resmi Tenkit Metni</p>
                                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{item.standard_remark}</p>
                                        </div>
                                    </div>

                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-4">
                                            {item.tags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider"
                                                >
                                                    <Tag size={8} /> {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // Standard Audit Category - Lists tasks and reports
                <>
                    {/* 2. Tasks list pane */}
                    <div className="w-full lg:w-80 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">
                        <div className="px-1">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{currentRaporTuru}</h3>
                            <p className="text-[10px] text-slate-400 font-bold">Aktif denetim görevleri listesi</p>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800/50" />

                        {filteredTasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-2">
                                <ClipboardCheck size={24} className="text-slate-300 dark:text-slate-700" />
                                <p className="text-xs font-bold text-slate-400 uppercase">Görev Bulunmamaktadır</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredTasks.map(task => {
                                    const isSelected = selectedTaskId === task.id;
                                    return (
                                        <button
                                            key={task.id}
                                            onClick={() => setSelectedTaskId(task.id)}
                                            className={`p-3.5 rounded-xl border text-left transition-all duration-200 ${
                                                isSelected
                                                    ? "bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/5"
                                                    : "bg-slate-50 dark:bg-slate-950/10 border-slate-100 dark:border-slate-900 hover:border-slate-200 dark:hover:border-slate-800"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-2 mb-1.5">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                                    task.rapor_durumu === "Tamamlandı"
                                                        ? "bg-green-500/10 text-green-500"
                                                        : task.rapor_durumu === "Devam Ediyor"
                                                        ? "bg-amber-500/10 text-amber-500"
                                                        : "bg-slate-500/10 text-slate-400"
                                                }`}>
                                                    {task.rapor_durumu}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 font-mono">{task.rapor_kodu}</span>
                                            </div>
                                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">{task.rapor_adi}</h4>
                                            <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-400 font-semibold">
                                                <span>Başlama: {task.baslama_tarihi}</span>
                                                <span>•</span>
                                                <span>{task.sure_gun} Gün</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. Detail Pane */}
                    <div className="flex-1 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-6 flex flex-col overflow-y-auto">
                        {!selectedTask ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950/20 flex items-center justify-center">
                                    <Info className="text-slate-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Denetim Detayları</h4>
                                    <p className="text-xs text-slate-400 mt-0.5 max-w-[280px]">
                                        İçerik, bağlı yurt/il ilişkileri ve tenkit ekleme panelini görmek için soldan bir görev seçin.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1">
                                {/* Header */}
                                <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">
                                            <span>{selectedTask.rapor_turu}</span>
                                            <ChevronRight size={8} />
                                            <span className="font-mono text-blue-500">{selectedTask.rapor_kodu}</span>
                                        </div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white leading-snug">{selectedTask.rapor_adi}</h2>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                                            selectedTask.rapor_durumu === "Tamamlandı"
                                                ? "bg-green-500/10 text-green-500"
                                                : selectedTask.rapor_durumu === "Devam Ediyor"
                                                ? "bg-amber-500/10 text-amber-500"
                                                : "bg-slate-500/10 text-slate-400"
                                        }`}>
                                            Durum: {selectedTask.rapor_durumu}
                                        </span>
                                    </div>
                                </div>

                                {/* Relationships (KYK Yurt <-> İl) */}
                                {activeTab === "il" && (
                                    <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl p-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Bu İle Bağlı KYK Yurt Denetimleri</h4>
                                        {childKykTasks.length === 0 ? (
                                            <p className="text-xs text-slate-400 font-medium">Bu il genel denetimine henüz bağlı bir KYK yurt denetimi atanmamış.</p>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                {childKykTasks.map(child => (
                                                    <button
                                                        key={child.id}
                                                        onClick={() => {
                                                            setActiveTab("kyk");
                                                            setSelectedTaskId(child.id);
                                                        }}
                                                        className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg hover:border-blue-500 transition-colors text-left"
                                                    >
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{child.rapor_adi}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-mono text-slate-400">{child.rapor_kodu}</span>
                                                            <ArrowRight size={12} className="text-blue-500" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === "kyk" && (
                                    <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl p-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Bağlı Olduğu İl Genel Denetimi</h4>
                                        {!selectedTask.parent_task_id ? (
                                            <p className="text-xs text-slate-400 font-medium">
                                                Bu yurt denetimi herhangi bir İl Genel Denetimi ile ilişkilendirilmemiş. Görevler sayfasından ilişki ekleyebilirsiniz.
                                            </p>
                                        ) : parentIlTask ? (
                                            <button
                                                onClick={() => {
                                                    setActiveTab("il");
                                                    setSelectedTaskId(parentIlTask.id);
                                                }}
                                                className="flex items-center justify-between w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg hover:border-blue-500 transition-colors text-left"
                                            >
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{parentIlTask.rapor_adi}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono text-slate-400">{parentIlTask.rapor_kodu}</span>
                                                    <ArrowRight size={12} className="text-blue-500" />
                                                </div>
                                            </button>
                                        ) : (
                                            <p className="text-xs text-slate-400 font-medium">Bağlı görev bulunamadı.</p>
                                        )}
                                    </div>
                                )}

                                {/* Report Editor & Content */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/30 pb-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <FileText size={14} className="text-blue-500" />
                                            <span>Denetim Raporu İçeriği</span>
                                        </h3>
                                        {selectedReport && (
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-lg text-[10px] h-8"
                                                    onClick={() => navigate(`/audit/${selectedReport.id}/report`)}
                                                >
                                                    <ExternalLink size={12} className="mr-1" /> Editörde Aç
                                                </Button>
                                                {reportEditing ? (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-lg text-[10px] h-8 text-slate-400"
                                                            onClick={() => {
                                                                setReportContent(selectedReport.report_content || "");
                                                                setReportEditing(false);
                                                            }}
                                                        >
                                                            İptal
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="rounded-lg text-[10px] h-8"
                                                            onClick={handleSaveReport}
                                                            disabled={reportSaving}
                                                        >
                                                            {reportSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="mr-1" />}
                                                            Kaydet
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-[10px] h-8"
                                                        onClick={() => setReportEditing(true)}
                                                    >
                                                        Manuel Düzenle
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!selectedReport ? (
                                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center gap-3">
                                            <AlertCircle size={24} className="text-slate-350 dark:text-slate-650" />
                                            <div>
                                                <h4 className="font-bold text-xs text-slate-850 dark:text-slate-250">Henüz Rapor Oluşturulmamış</h4>
                                                <p className="text-[11px] text-slate-400 mt-0.5">Bu denetim görevi için henüz taslak bir rapor kaydı bulunmuyor.</p>
                                            </div>
                                            <Button size="sm" onClick={handleCreateReport} className="rounded-xl mt-1 h-9 text-xs">
                                                <Plus size={14} className="mr-1" /> Rapor Oluştur
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[300px]">
                                            {/* Left: Editor Area */}
                                            <div className="xl:col-span-7 flex flex-col gap-2">
                                                {reportEditing ? (
                                                    <textarea
                                                        value={reportContent}
                                                        onChange={e => setReportContent(e.target.value)}
                                                        className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed resize-none h-[350px] lg:h-full"
                                                        placeholder="Rapor içeriğini HTML formatında yazın..."
                                                    />
                                                ) : (
                                                    <div 
                                                        className="flex-1 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/5 text-xs text-slate-800 dark:text-slate-255 leading-relaxed overflow-y-auto select-text prose prose-sm dark:prose-invert max-w-none h-[350px] lg:h-full"
                                                        dangerouslySetInnerHTML={{ __html: reportContent || "<p className='text-slate-400 italic'>Rapor içeriği boş.</p>" }}
                                                    />
                                                )}
                                                <p className="text-[10px] text-slate-400 font-bold">
                                                    * Rapor içeriği HTML formatındadır. TinyMCE zengin metin düzenleyiciyle düzenlemek için sağ üstteki "Editörde Aç" butonunu kullanın.
                                                </p>
                                            </div>

                                            {/* Right: AI Tenkit Bankası Panel */}
                                            <div className="xl:col-span-5 flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/40 p-4 rounded-xl max-h-[450px] xl:max-h-full overflow-y-auto">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <Sparkles size={12} className="text-blue-500" />
                                                        <span>AI Tenkit Bankası</span>
                                                    </h4>
                                                    <span className="text-[9px] font-bold text-slate-400">{tenkitResults.length} Tenkit</span>
                                                </div>

                                                <div className="relative">
                                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        value={tenkitSearch}
                                                        onChange={e => setTenkitSearch(e.target.value)}
                                                        placeholder="Tenkit maddelerinde arama..."
                                                        className="w-full pl-8 pr-3 h-8.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950/20 text-slate-800 dark:text-white"
                                                    />
                                                </div>

                                                <div className="h-px bg-slate-100 dark:bg-slate-800/50" />

                                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                                                    {tenkitResults.length === 0 ? (
                                                        <p className="text-[11px] text-slate-400 text-center py-4 font-bold">Sonuç bulunamadı.</p>
                                                    ) : (
                                                        tenkitResults.map(item => (
                                                            <div
                                                                key={item.id}
                                                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-lg flex flex-col gap-2 hover:border-blue-500/50 transition-colors"
                                                            >
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="min-w-0">
                                                                        <span className="inline-block text-[8px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded mb-1">
                                                                            {item.category}
                                                                        </span>
                                                                        <h5 className="text-[11px] font-black text-slate-850 dark:text-slate-200 leading-tight truncate">{item.topic}</h5>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="rounded-lg text-[9px] h-7 bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all flex-shrink-0"
                                                                        onClick={() => handleAppendTenkit(item)}
                                                                    >
                                                                        Rapora Ekle
                                                                    </Button>
                                                                </div>
                                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 bg-slate-50 dark:bg-slate-950/5 p-2 rounded font-medium border border-slate-100 dark:border-slate-800/20">
                                                                    {item.standard_remark}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* AI Knowledge Add/Edit Modal */}
            {showKnowledgeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                    {editingKnowledgeItem ? "Maddeyi Düzenle" : "Yeni Tenkit Maddesi"}
                                </h2>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    AI asistanının ve denetim raporlarının kullanacağı şablon metin
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowKnowledgeModal(false); resetKnowledgeForm(); }}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-500"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                        Kategori *
                                    </label>
                                    <select
                                        value={knowledgeForm.category}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                        Konu / Başlık *
                                    </label>
                                    <input
                                        value={knowledgeForm.topic}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, topic: e.target.value }))}
                                        placeholder="Örn: Asansör Yeşil Etiket Eksikliği"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Açıklama / Kriter Özeti
                                </label>
                                <input
                                    value={knowledgeForm.description}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Kısaca eksikliğin veya hatanın tanımı..."
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Resmi Tenkit Metni *
                                </label>
                                <textarea
                                    value={knowledgeForm.standard_remark}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, standard_remark: e.target.value }))}
                                    placeholder="Raporlarda doğrudan kullanılacak resmi tenkit paragrafı..."
                                    rows={5}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Anahtar Kelimeler / Etiketler
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        value={knowledgeTagInput}
                                        onChange={e => setKnowledgeTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); addKnowledgeTag(); }
                                        }}
                                        placeholder="Etiket yazıp Ekle'ye veya Enter'a basın..."
                                        className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={addKnowledgeTag}
                                        className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all text-slate-700 dark:text-slate-300"
                                    >
                                        Ekle
                                    </button>
                                </div>
                                {knowledgeForm.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {knowledgeForm.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => removeKnowledgeTag(tag)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800/50">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowKnowledgeModal(false); resetKnowledgeForm(); }}
                                className="rounded-xl h-10 px-5"
                            >
                                İptal
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveKnowledge}
                                disabled={knowledgeSaving}
                                className="rounded-xl h-10 px-6 shadow-md shadow-primary/20"
                            >
                                {knowledgeSaving
                                    ? <Loader2 size={14} className="animate-spin mr-2" />
                                    : <Check size={14} className="mr-2" />
                                }
                                {editingKnowledgeItem ? "Güncelle" : "Kaydet"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
