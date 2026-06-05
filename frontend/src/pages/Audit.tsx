import { Plus, Search, Filter, FileText, Loader2, FileSpreadsheet, Shield, ChevronRight, UserPlus, Upload, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { API_URL as API_BASE_URL } from "../lib/config";
import { Suspense, lazy, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { createAudit, deleteAudit, updateAudit, exportAuditsToExcel, exportAuditToWord, acceptAudit, type Audit as AuditType } from "../lib/api/audit";
import { updateTask } from "../lib/api/tasks";
import { useAuth } from "../lib/hooks/useAuth";
import { isElectron } from "../lib/firebase";
import { cn } from "../lib/utils";

import { useGlobalData } from "../lib/context/GlobalDataContext";

const toPlainSearchText = (value?: string) =>
    String(value || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("tr-TR");

const AuditList = lazy(() => import("../components/audit/AuditList"));
const ShareModalLazy = lazy(() => import("../components/ShareModal"));
const ModalLazy = lazy(() => import("../components/ui/Modal").then((module) => ({ default: module.Modal })));

type ReportTemplateItem = {
    id: string;
    name: string;
    category: string;
    html: string;
};

export default function Audit() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const { data: cachedData, refreshAll, refreshAudits, refreshTasks } = useGlobalData();
    
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState("kisisel");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState("Tümü");
    const [filterInspector, setFilterInspector] = useState("Tümü");
    const [filterTaskType, setFilterTaskType] = useState("Tümü");
    const [filterRole, setFilterRole] = useState("Tümü");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [shareAudit, setShareAudit] = useState<AuditType | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [reportTemplates, setReportTemplates] = useState<ReportTemplateItem[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    
    // Gelişmiş Arama States
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState("");
    const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

    const handleGlobalSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (globalSearchQuery.trim().length < 2) {
            toast.error("Lütfen en az 2 karakter giriniz.");
            return;
        }

        setGlobalSearchLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/search/search-reports?q=${encodeURIComponent(globalSearchQuery.trim())}`);
            if (!res.ok) throw new Error("Arama servisinde hata oluştu.");
            const data = await res.json();
            setGlobalSearchResults(data.results || []);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Arama yapılamadı.");
        } finally {
            setGlobalSearchLoading(false);
        }
    };

    const [newAudit, setNewAudit] = useState({
        task_id: "",
        title: "",
        location: "",
        date: new Date().toLocaleDateString("tr-TR"),
        inspector: user?.displayName || user?.email?.split('@')[0] || "Sefa YAPRAKLI",
        status: "Devam Ediyor",
        template: "Boş Rapor",
        report_seq: 1
    });

    // Search Debouncer
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Memoized derived data from global cache
    const { audits, tasks, invitations } = useMemo(() => {
        if (!user) return { audits: [], tasks: [], invitations: [] };
        const uid = user.uid;
        const email = (user.email || '').toLowerCase();
        const userKeys = [uid, email].filter(Boolean) as string[];

        const allAudits = cachedData.audits || [];
        const allTasks = cachedData.tasks || [];

        const pending = allAudits.filter((a: any) =>
            (a.pending_collaborators || []).some((v: string) => userKeys.includes(v)) &&
            !userKeys.includes(a.owner_id || '')
        );

        return { audits: allAudits, tasks: allTasks, invitations: pending };
    }, [cachedData.audits, cachedData.tasks, user]);

    useEffect(() => {
        if (user?.uid) {
            refreshAll(user.uid, user.email || undefined, user.displayName || undefined);
        }
    }, [user, refreshAll]);

    useEffect(() => {
        let cancelled = false;

        const loadTemplates = async () => {
            if (!isModalOpen || activeTab === "ortak") return;
            if (reportTemplates.length > 0) return;

            try {
                setTemplatesLoading(true);
                const module = await import("../lib/reportTemplates");
                if (!cancelled) {
                    setReportTemplates(module.REPORT_TEMPLATES || []);
                }
            } catch {
                if (!cancelled) {
                    setReportTemplates([]);
                }
            } finally {
                if (!cancelled) {
                    setTemplatesLoading(false);
                }
            }
        };

        loadTemplates();
        return () => {
            cancelled = true;
        };
    }, [isModalOpen, activeTab, reportTemplates.length]);

    // Web sürümü uyarısı - Kullanıcı isteğiyle kaldırıldı
    useEffect(() => {
        // Uyarı kaldırıldı
    }, []);

    const loadData = async (silent = false) => {
        if (!user) return;
        if (!silent) setLoading(true);
        try {
            await Promise.all([
                refreshAudits(user.uid, user.email || undefined),
                refreshTasks(user.uid)
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAudit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isElectron) {
            toast.error("Rapor oluşturma işlemi sadece masaüstü uygulamasında tam fonksiyonel olarak gerçekleştirilebilir.");
            return;
        }

        if (!newAudit.task_id) {
            toast.error("Lütfen önce bu denetimle ilişkili bir Görev seçiniz.");
            return;
        }

        if (activeTab === 'ortak' && !selectedFile) {
            toast.error("Lütfen bir arşiv rapor dosyası (PDF/Word) seçiniz.");
            return;
        }

        try {
            if (!user) return;
            setUploading(true);
            const currentUser = user;
            const selectedTask = tasks.find(t => t.id === newAudit.task_id);
            const taskAssigned = selectedTask?.assigned_to || [];
            const taskShared = selectedTask?.shared_with || [];
            const isPublic = (selectedTask as any)?.is_public === true;
            
            const combinedAssigned = Array.from(new Set([...taskAssigned, currentUser.uid]));

            let fileUrl = "";
            if (activeTab === 'ortak' && selectedFile) {
                const { uploadFile } = await import("../lib/api/files");
                const path = `audits/${newAudit.task_id}`;
                const uploaded = await uploadFile(selectedFile, path, currentUser.uid);
                fileUrl = uploaded.url;
            }

            let selectedTemplateHtml = "";
            if (newAudit.template) {
                const { AUDIT_DRAFT_TEMPLATES } = await import("../lib/auditDraftTemplates");
                if (AUDIT_DRAFT_TEMPLATES[newAudit.template] !== undefined) {
                    selectedTemplateHtml = AUDIT_DRAFT_TEMPLATES[newAudit.template];
                } else {
                    const pool = reportTemplates.length > 0 ? reportTemplates : (await import("../lib/reportTemplates")).REPORT_TEMPLATES;
                    const found = pool.find(t => t.id === newAudit.template);
                    if (found) {
                        selectedTemplateHtml = found.html;
                    }
                }
            }

            const auditPayload: any = {
                task_id: newAudit.task_id,
                title: newAudit.title,
                location: newAudit.location,
                date: newAudit.date,
                inspector: newAudit.inspector,
                status: activeTab === 'ortak' ? "Tamamlandı" : newAudit.status,
                report_content: activeTab === 'ortak' ? "" : selectedTemplateHtml,
                file_url: fileUrl,
                owner_id: currentUser.uid,
                assigned_to: combinedAssigned,
                shared_with: taskShared,
                is_public: isPublic,
                report_seq: newAudit.report_seq || 1
            };
            
            const created = await createAudit(auditPayload);
            
            // Görev durumunu güncelle
            if (selectedTask && selectedTask.rapor_durumu === "Başlanmadı") {
                await updateTask(selectedTask.id, { rapor_durumu: activeTab === 'ortak' ? "Tamamlandı" : "Devam Ediyor" });
            }

            setIsModalOpen(false);
            setNewAudit({
                task_id: "",
                title: "",
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: user?.displayName || user?.email?.split('@')[0] || "Sefa YAPRAKLI",
                status: "Devam Ediyor",
                template: "Boş Rapor",
                report_seq: 1
            });
            setSelectedFile(null);
            toast.success(activeTab === 'ortak' ? "Arşiv raporu başarıyla yüklendi." : "Denetim başarıyla oluşturuldu.");
            
            if (activeTab !== 'ortak') {
                navigate(`/audit/${created.id}/report`);
            } else {
                loadData(true);
            }
        } catch (error) {
            console.error(error);
            toast.error("Denetim oluşturulurken hata oluştu.");
        } finally {
            setUploading(false);
        }
    };

    const handleTaskSelect = (taskId: string) => {
        const selectedTask = tasks.find(t => t.id === taskId);
        if (selectedTask) {
            const taskAudits = audits.filter(a => a.task_id === taskId);
            const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;
            
            setNewAudit({
                ...newAudit,
                task_id: taskId,
                title: nextSeq === 1 ? selectedTask.rapor_adi : `${selectedTask.rapor_adi} - Ek Rapor`,
                location: "",
                report_seq: nextSeq
            });
        } else {
            setNewAudit({ ...newAudit, task_id: taskId, report_seq: 1 });
        }
    };

    const availableTasks = useMemo(() => {
        const TWO_YEARS_MS = 730 * 24 * 60 * 60 * 1000;
        return tasks.filter(t => {
            const isOld = t.baslama_tarihi ? (Date.now() - new Date(t.baslama_tarihi).getTime() > TWO_YEARS_MS) : false;
            // Arşiv Şartı: Görev Tamamlandı VE 2 yıl geçmiş
            const isArchived = (t.rapor_durumu === "Tamamlandı") && isOld;
            
            if (activeTab === 'ortak') {
                return isArchived;
            } else {
                // Aktif sekmesinde sadece arşivlenmemişleri göster
                return !isArchived;
            }
        }).sort((a, b) => {
            // Yeni görevleri (yılına göre) üste alalım
            const aYear = a.rapor_kodu?.split('/')[1]?.split('-')[0] || "0";
            const bYear = b.rapor_kodu?.split('/')[1]?.split('-')[0] || "0";
            if (aYear !== bYear) return bYear.localeCompare(aYear);
            return (b.rapor_kodu || "").localeCompare(a.rapor_kodu || "", "tr", { numeric: true });
        });
    }, [tasks, activeTab]);

    const handleExportExcel = () => {
        exportAuditsToExcel();
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.length === filteredAudits.length && filteredAudits.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredAudits.map(a => a.id));
        }
    };

    const handleToggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleUpdateAudit = async (id: string, updates: Partial<AuditType>) => {
        try {
            await updateAudit(id, updates);
            toast.success("Denetim başarıyla güncellendi.");
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Güncelleme sırasında bir hata oluştu.");
        }
    };

    const handleSingleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Denetimi Sil",
            message: "Bu denetimi silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        try {
            setLoading(true);
            await deleteAudit(id);
            toast.success("Denetim başarıyla silindi.");
            await loadData();
        } catch (error) {
            console.error(error);
            toast.error("Silme işlemi sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        
        const confirmed = await confirm({
            title: "Denetimleri Sil",
            message: `${selectedIds.length} adet denetimi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        
        try {
            setLoading(true);
            await Promise.all(selectedIds.map(id => deleteAudit(id)));
            setSelectedIds([]);
            toast.success(`${selectedIds.length} adet denetim başarıyla silindi.`);
            await loadData();
        } catch (error) {
            console.error("Silme hatası:", error);
            toast.error("Silme işlemi sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvitation = async (auditId: string) => {
        if (!user?.uid) return;

        if (!isElectron) {
            toast.error("Rapor daveti kabul etme işlemi sadece masaüstü uygulamasında güvenli protokol ile gerçekleştirilebilir.");
            return;
        }

        try {
            await acceptAudit(auditId, user.uid, user.email || undefined);
            toast.success("Rapor kabul edildi ve listenize eklendi.");
            loadData();
        } catch (error) {
            toast.error("Rapor kabul edilemedi.");
        }
    };

    const handleShareAuditUpdate = async (newSharedWith: string[]) => {
        if (!shareAudit) return;
        try {
            await updateAudit(shareAudit.id, { pending_collaborators: newSharedWith } as any);
            toast.success("Rapor paylaşım davetleri gönderildi.");
            setShareAudit(null);
            loadData();
        } catch { toast.error("Paylaşım güncellenemedi."); }
    };

    const currentUserKeys = useMemo(() => {
        const keys = [user?.uid, user?.email?.toLowerCase()].filter(Boolean) as string[];
        return Array.from(new Set(keys));
    }, [user?.uid, user?.email]);

    const filteredAudits = useMemo(() => {
        const resolveAuditRoleForUser = (audit: AuditType) => {
            const normalizedUserKeys = currentUserKeys.map((k) => String(k).toLowerCase());
            const owner = String((audit as any).owner_id || "").toLowerCase();
            if (owner && normalizedUserKeys.includes(owner)) return "Sahip";

            const sharedRoles = ((audit as any).shared_roles || {}) as Record<string, "view" | "comment" | "edit">;
            const explicitRole = Object.entries(sharedRoles).find(([k]) => normalizedUserKeys.includes(String(k).toLowerCase()))?.[1];
            if (explicitRole === "edit") return "Düzenle";
            if (explicitRole === "comment") return "Yorumla";
            if (explicitRole === "view") return "Görüntüle";

            const sharedWith = (((audit as any).shared_with || []) as string[]).map((k) => String(k).toLowerCase());
            if (normalizedUserKeys.some((k) => sharedWith.includes(k))) return "Düzenle";

            const pending = (((audit as any).pending_collaborators || []) as string[]).map((k) => String(k).toLowerCase());
            if (normalizedUserKeys.some((k) => pending.includes(k))) return "Davet";

            return "Yok";
        };

        return audits.filter(a => {
            const relatedTask = tasks.find(t => String(t.id).trim() === String(a.task_id).trim());
            const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase("tr-TR");
            const searchHaystack = [
                a.title,
                a.location,
                a.date,
                a.inspector,
                a.status,
                a.description,
                a.report_content,
                relatedTask?.rapor_adi,
                relatedTask?.rapor_kodu,
                relatedTask?.rapor_turu,
                relatedTask?.rapor_durumu
            ]
                .map((value) => toPlainSearchText(value))
                .filter(Boolean)
                .join(" ");
            const matchesSearch = !normalizedSearch || searchHaystack.includes(normalizedSearch);
            
            // 2 yıl kuralı (İlişkili görev üzerinden veya raporun kendi tarihi üzerinden)
            let isOld = false;
            if (relatedTask?.baslama_tarihi) {
                isOld = (Date.now() - new Date(relatedTask.baslama_tarihi).getTime() > 730 * 24 * 60 * 60 * 1000);
            } else if (a.date) {
                // Raporun kendi tarihi üzerinden kontrol (GG.AA.YYYY formatını da destekleyelim)
                try {
                    const parts = a.date.split('.');
                    const auditDate = parts.length === 3 
                        ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
                        : new Date(a.date);
                    isOld = (Date.now() - auditDate.getTime() > 730 * 24 * 60 * 60 * 1000);
                } catch { isOld = false; }
            }
            
            // Arşiv Şartı: Görev Tamamlandı VE 2 yıl geçmiş (Veya görev yoksa ve 2 yıl geçmişse de arşive atalım)
            const isArchived = ((relatedTask?.rapor_durumu === "Tamamlandı" || !relatedTask) && isOld);
            
            const matchesTab = activeTab === 'ortak' ? isArchived : !isArchived;

            if (a.report_created === false) return false;

            const effectiveStatus = relatedTask?.rapor_durumu || a.status;
            const matchesStatus = filterStatus === "Tümü" || effectiveStatus === filterStatus;
            const matchesInspector = filterInspector === "Tümü" || a.inspector === filterInspector;
            const matchesTaskType = filterTaskType === "Tümü" || relatedTask?.rapor_turu === filterTaskType;
            const matchesRole = filterRole === "Tümü" || resolveAuditRoleForUser(a) === filterRole;

            return matchesSearch && matchesTab && matchesStatus && matchesInspector && matchesTaskType && matchesRole;
        }).sort((a, b) => {
            if (a.task_id !== b.task_id) {
                return (a.task_id || "").localeCompare(b.task_id || "");
            }
            return (a.report_seq || 0) - (b.report_seq || 0);
        });
    }, [audits, tasks, currentUserKeys, debouncedSearch, activeTab, filterStatus, filterInspector, filterTaskType, filterRole]);

    const uniqueStatuses = useMemo(() => {
        return Array.from(new Set(audits.map((a) => {
            const relatedTask = tasks.find(t => String(t.id).trim() === String(a.task_id).trim());
            return relatedTask?.rapor_durumu || a.status;
        }).filter(Boolean))).sort();
    }, [audits, tasks]);

    const uniqueInspectors = useMemo(() => {
        return Array.from(new Set(audits.map((a) => a.inspector).filter(Boolean))).sort();
    }, [audits]);

    const uniqueTaskTypes = useMemo(() => {
        return Array.from(new Set(tasks.map((t) => t.rapor_turu).filter(Boolean))).sort();
    }, [tasks]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Rapor Yönetimi</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {activeTab === 'ortak' ? "Arşiv Raporlar" : "Rapor Yönetimi"}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        {activeTab === 'ortak' 
                            ? "2 yılı doldurmuş ve tamamlanmış eski raporlarınızın arşivi." 
                            : "Şu an üzerinde çalıştığınız veya güncel denetim raporları."}
                    </p>
                </div>
                
                <div className="flex bg-muted p-1.5 rounded-xl ml-auto mr-6">
                    <button 
                        onClick={() => setActiveTab("kisisel")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'kisisel' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground'}`}
                    >
                        Aktif Raporlar
                    </button>
                    <button 
                        onClick={() => setActiveTab("ortak")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'ortak' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground'}`}
                    >
                        Arşiv Raporlar
                    </button>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleExportExcel} className="h-12 px-6 border-emerald-100 text-emerald-600 hover:bg-emerald-50 rounded-xl font-bold shadow-sm">
                        <FileSpreadsheet className="mr-2" size={18} /> Excel'e Aktar
                    </Button>
                    {isElectron && (
                        <Button className="h-12 px-6 shadow-lg shadow-primary/20 rounded-xl" onClick={() => setIsModalOpen(true)}>
                            <Plus className="mr-2" size={20} /> {activeTab === 'ortak' ? "Arşiv Rapor Ekle" : "Yeni Rapor Başlat"}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-card h-12 px-4 rounded-xl border border-border shadow-sm">
                    <input 
                        type="checkbox" 
                        checked={filteredAudits.length > 0 && selectedIds.length === filteredAudits.length}
                        onChange={handleToggleSelectAll}
                        className="w-5 h-5 rounded-md border-slate-300 text-primary cursor-pointer focus:ring-primary/20"
                        title="Tümünü Seç/Bırak"
                    />
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{selectedIds.length} Seçili</span>
                    
                    {selectedIds.length > 0 && (
                        <div className="flex items-center animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="w-px h-6 bg-border mx-2" />
                            <button 
                                onClick={handleDeleteSelected}
                                className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-bold text-[11px] uppercase tracking-wider transition-colors"
                            >
                                <Trash2 size={14} /> Seçilenleri Sil
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 bg-card border border-border h-12 rounded-xl px-5 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                    <Search size={18} className="text-muted-foreground mr-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tam metin ara: başlık, içerik, görev kodu, müfettiş, tarih..."
                        className="bg-transparent border-none outline-none text-sm w-full font-outfit font-medium"
                    />
                    {debouncedSearch && (
                        <span className="hidden lg:inline text-[10px] font-black uppercase tracking-widest text-primary whitespace-nowrap">
                            Tam Metin
                        </span>
                    )}
                </div>
                <Button variant="outline" className="h-12 rounded-xl px-6" onClick={() => setIsFilterOpen((v) => !v)}>
                    <Filter className="mr-2" size={18} /> Filtrele
                </Button>
                <Button 
                    variant="outline" 
                    className="h-12 rounded-xl px-6 border-violet-100 text-violet-700 bg-violet-50/50 hover:bg-violet-50 transition-all font-bold"
                    onClick={() => setIsGlobalSearchOpen(true)}
                    title="Rapor içeriklerinde detaylı kelime araması yapın"
                >
                    <Search className="mr-2" size={18} /> İçeriklerde Ara
                </Button>
            </div>

            {debouncedSearch && (
                <div className="px-1 text-[11px] font-bold text-slate-500">
                    "{debouncedSearch}" için tam metin arama yapılıyor. {filteredAudits.length} rapor eşleşti.
                </div>
            )}

            {isFilterOpen && (
                <Card className="p-5 border border-border rounded-2xl bg-card shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durum</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="Tümü">Tümü</option>
                                {uniqueStatuses.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Müfettiş</label>
                            <select
                                value={filterInspector}
                                onChange={(e) => setFilterInspector(e.target.value)}
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="Tümü">Tümü</option>
                                {uniqueInspectors.map((inspector) => (
                                    <option key={inspector} value={inspector}>{inspector}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Görev Türü</label>
                            <select
                                value={filterTaskType}
                                onChange={(e) => setFilterTaskType(e.target.value)}
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="Tümü">Tümü</option>
                                {uniqueTaskTypes.map((taskType) => (
                                    <option key={taskType} value={taskType}>{taskType}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rol</label>
                            <select
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="Tümü">Tümü</option>
                                <option value="Sahip">Sahip</option>
                                <option value="Düzenle">Düzenle</option>
                                <option value="Yorumla">Yorumla</option>
                                <option value="Görüntüle">Görüntüle</option>
                                <option value="Davet">Davet</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setFilterStatus("Tümü");
                                setFilterInspector("Tümü");
                                setFilterTaskType("Tümü");
                                setFilterRole("Tümü");
                            }}
                            className="rounded-xl px-5"
                        >
                            Filtreyi Temizle
                        </Button>
                    </div>
                </Card>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground font-bold italic tracking-widest uppercase text-[10px]">Veriler Getiriliyor...</p>
                </div>
            ) : (
            <>
            {/* Bekleyen Rapor Davetleri */}
            {invitations.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mb-8">
                    <div className="flex items-center gap-2 px-1 text-blue-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black tracking-widest font-outfit">Bekleyen Rapor Davetleri ({invitations.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex flex-col justify-between group hover:bg-blue-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[9px] font-black rounded-lg tracking-widest">Paylaşılan Rapor</span>
                                        <FileText size={14} className="text-blue-500" />
                                    </div>
                                    <h4 className="font-bold text-foreground text-sm mb-1">{inv.title}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium mb-4 italic flex items-center gap-1">
                                        <UserPlus size={10} /> Gönderen: {inv.inspector || inv.owner_id}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleAcceptInvitation(inv.id)} 
                                    className={cn(
                                        "w-full rounded-xl h-10 font-bold text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95",
                                        isElectron 
                                            ? "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200/50" 
                                            : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                    )}
                                    title={!isElectron ? "Sadece Masaüstü Uygulamasında" : ""}
                                >
                                    {isElectron ? "Raporu Kabul Et ve Listeye Ekle" : "Kabul İçin Masaüstü Uygulamasını Açın"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {filteredAudits.length > 0 ? (
                <Suspense
                    fallback={
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <Card key={`audit-skeleton-${idx}`} className="p-6 rounded-2xl border border-border/60 bg-card">
                                    <div className="h-20 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                                </Card>
                            ))}
                        </div>
                    }
                >
                    <AuditList
                        audits={filteredAudits}
                        tasks={tasks}
                        currentUserKeys={currentUserKeys}
                        selectedIds={selectedIds}
                        isElectron={isElectron}
                        onToggleSelect={handleToggleSelect}
                        onExportWord={(auditId: string) => {
                            if (isElectron) {
                                exportAuditToWord(auditId);
                            } else {
                                toast.error("Rapor indirme ve dışa aktarma işlemleri sadece masaüstü uygulamasında aktiftir.");
                            }
                        }}
                        onEdit={(auditId: string) => navigate(`/audit/${auditId}/report`)}
                        onUpdate={handleUpdateAudit}
                        onDelete={handleSingleDelete}
                        onShare={(auditId: string) => {
                            const targetAudit = filteredAudits.find((a) => a.id === auditId);
                            if (targetAudit) setShareAudit(targetAudit);
                        }}
                        onRefresh={() => loadData(true)}
                    />
                </Suspense>
            ) : (
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-5 border-dashed border-2 rounded-3xl bg-card/50 border-border/50">
                    <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground/30">
                        <FileText size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-primary font-outfit">Kayıt Bulunamadı</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm font-medium">Aradığınız kriterlere uygun denetim bulunmuyor veya henüz hiç denetim başlatmadınız.</p>
                    </div>
                    {isElectron ? (
                        <Button variant="outline" className="rounded-xl px-8 h-12" onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} className="mr-2" /> İlk Raporu Oluştur
                        </Button>
                    ) : (
                        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
                            Web sürümünde rapor oluşturma kapalıdır. Görev oluşturulamadığı için bu ekranda sadece mevcut raporlar izlenebilir.
                        </div>
                    )}
                </Card>
            )}
            </>
            )}

            {isModalOpen && (
            <Suspense fallback={null}>
            <ModalLazy
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={activeTab === 'ortak' ? "Arşiv Rapor Ekle (Dosya Yükle)" : "Yeni Rapor Başlat"}
            >
                <form onSubmit={handleCreateAudit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">İlişkili Görev (Zorunlu)</label>
                        <select 
                            required
                            className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            value={newAudit.task_id}
                            onChange={(e) => handleTaskSelect(e.target.value)}
                        >
                            <option value="">Görev Seçiniz...</option>
                            {availableTasks.map(t => (
                                <option key={t.id} value={t.id} className="bg-card">
                                    {t.rapor_kodu} - {t.rapor_adi} {t.rapor_durumu === 'Tamamlandı' ? '(Tamamlandı)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Kurum Adı / Denetim Konusu</label>
                        <input 
                            required
                            className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                            placeholder="Örn: Ankara Şubesi Genel Denetimi"
                            value={newAudit.title}
                            onChange={(e) => setNewAudit({...newAudit, title: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tarih</label>
                            <input 
                                className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                value={newAudit.date}
                                onChange={(e) => setNewAudit({...newAudit, date: e.target.value})}
                            />
                        </div>
                        {activeTab === 'ortak' ? (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Arşiv Rapor Dosyası (PDF/DOCX)</label>
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="hidden" 
                                        id="archive-file-upload"
                                    />
                                    <label 
                                        htmlFor="archive-file-upload"
                                        className={cn(
                                            "flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                                            selectedFile ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-200 hover:border-primary hover:bg-slate-50 text-slate-400"
                                        )}
                                    >
                                        <Upload size={32} className="mb-2" />
                                        <span className="text-sm font-bold">{selectedFile ? selectedFile.name : "Dosya Seçin veya Sürükleyin"}</span>
                                        <span className="text-[10px] mt-1 opacity-60">Sadece PDF ve Word dökümanları</span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Taslak Şablon</label>
                                <select 
                                    className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                    value={newAudit.template}
                                    onChange={(e) => setNewAudit({...newAudit, template: e.target.value})}
                                >
                                    <option value="Boş Rapor" className="bg-card">Boş Rapor</option>
                                    {["Genel Teftiş", "Spor Kulüpleri", "Ön İnceleme", "İnceleme-Soruşturma"].map((cat) => {
                                        const templates = reportTemplates.filter((t) => t.category === cat);
                                        return (
                                            <optgroup key={cat} label={cat} className="bg-card font-bold text-xs text-primary/80">
                                                {templates.map((t) => (
                                                    <option key={t.id} value={t.id} className="bg-card text-foreground font-normal text-xs">
                                                        {t.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}
                                    {templatesLoading && <option disabled>Şablonlar yükleniyor...</option>}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 h-14 rounded-2xl font-bold"
                        >
                            İptal
                        </Button>
                        <Button 
                            type="submit"
                            disabled={uploading}
                            className="flex-1 h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all"
                        >
                            {uploading ? (
                                <><Loader2 size={20} className="animate-spin mr-2" /> Yükleniyor...</>
                            ) : (
                                activeTab === 'ortak' ? "Arşiv Raporu Yükle" : "Raporu Başlat"
                            )}
                        </Button>
                    </div>
                </form>
            </ModalLazy>
            </Suspense>
            )}
            
            {shareAudit && (
                <Suspense fallback={null}>
                    <ShareModalLazy
                        isOpen={!!shareAudit}
                        onClose={() => setShareAudit(null)}
                        title="Raporu Paylaş"
                        sharedWith={(shareAudit as any).pending_collaborators || []}
                        onShare={handleShareAuditUpdate}
                    />
                </Suspense>
            )}

            {/* Gelişmiş Arama Modali */}
            {isGlobalSearchOpen && (
                <div 
                    onClick={() => setIsGlobalSearchOpen(false)}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-in zoom-in-95 duration-200"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Search className="text-violet-600 dark:text-violet-400" size={20} /> Tüm Rapor İçeriklerinde Ara
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sistemdeki tüm raporların içindeki metinleri kelime kelime tarayın.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setIsGlobalSearchOpen(false)} className="rounded-full w-8 h-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center">
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Search Input Area */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                            <form onSubmit={handleGlobalSearch} className="flex gap-2">
                                <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-11 rounded-xl px-4 flex items-center focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
                                    <Search size={16} className="text-slate-400 mr-2" />
                                    <input
                                        type="text"
                                        value={globalSearchQuery}
                                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                        placeholder="Aranacak kelime veya ifadeyi yazın..."
                                        className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-800 dark:text-slate-100"
                                        autoFocus
                                    />
                                </div>
                                <Button 
                                    type="submit" 
                                    disabled={globalSearchLoading}
                                    className="h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold"
                                >
                                    {globalSearchLoading ? <Loader2 size={16} className="animate-spin" /> : "Ara"}
                                </Button>
                            </form>
                        </div>

                        {/* Results list */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {globalSearchLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">İçerikler taranıyor...</p>
                                </div>
                            ) : globalSearchResults.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-sm">
                                    {globalSearchQuery ? "Aramanıza uygun sonuç bulunamadı." : "Kelime arayarak raporlarınızın içindeki eşleşen cümleleri görebilirsiniz."}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{globalSearchResults.length} Eşleşen Rapor Bulundu</p>
                                    {globalSearchResults.map((result) => (
                                        <div
                                            key={result.id}
                                            onClick={() => {
                                                setIsGlobalSearchOpen(false);
                                                navigate(`/audit/${result.id}/report`);
                                            }}
                                            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 bg-white dark:bg-slate-900 hover:bg-violet-50/10 cursor-pointer group transition-all shadow-sm hover:shadow-md flex flex-col gap-2 animate-in fade-in duration-200"
                                        >
                                            <div className="flex justify-between items-start">
                                                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                                                    {result.title}
                                                </h5>
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-md">Editöre Git ➔</span>
                                            </div>
                                            {result.snippet && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                    ... <span dangerouslySetInnerHTML={{ __html: result.snippet.replace(new RegExp(`(${globalSearchQuery})`, 'gi'), '<mark class="bg-yellow-100 dark:bg-yellow-950/60 text-slate-800 dark:text-yellow-250 px-0.5 rounded">$1</mark>') }} /> ...
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-end">
                            <Button variant="outline" size="sm" onClick={() => setIsGlobalSearchOpen(false)} className="rounded-xl h-9 text-xs">
                                Kapat
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
