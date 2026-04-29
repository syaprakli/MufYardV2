import { Plus, Search, Filter, FileText, Download, Loader2, FileSpreadsheet, Edit3, Shield, MapPin, Clock, Trash2, MoreVertical, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { fetchAudits, createAudit, deleteAudit, updateAudit, exportAuditsToExcel, exportAuditToWord, type Audit as AuditType } from "../lib/api/audit";
import { fetchTasks, updateTask, type Task } from "../lib/api/tasks";
import { useAuth } from "../lib/hooks/useAuth";
import { cn } from "../lib/utils";

const RAPOR_SABLONLARI: Record<string, string> = {
    "Boş Rapor": "",
    "Genel Teftiş": "<h1 style=\"text-align: center;\">GENEL TEFTİŞ RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>....... tarihli ve ....... sayılı Makam Onayı üzerine ....... İl Müdürlüğü ve bağlı birimlerinde yürütülen Genel Teftiş çalışmaları sonucunda bu rapor düzenlenmiştir.</p><p><br></p><p><strong>2. YAPILAN İNCELEME VE TESPİTLER</strong></p><p>Kurumun mevzuata uygunluk, mali ve idari işlemleri incelenmiş olup, tespit edilen hususlar aşağıda maddeler halinde açıklanmıştır:</p><ul><li>İlk tespit...</li></ul><p><br></p><p><strong>3. SONUÇ VE ÖNERİLER</strong></p><p>Yapılan genel teftiş neticesinde ....... kanaatine varılmıştır.</p>",
    "İnceleme-Soruşturma": "<h1 style=\"text-align: center;\">İNCELEME VE SORUŞTURMA RAPORU</h1><p><br></p><p><strong>1. İNCELEME/SORUŞTURMA EMRİ</strong></p><p>....... tarihli ve ....... sayılı görevlendirme emri.</p><p><br></p><p><strong>2. İDDİA KONUSU</strong></p><p>Şikayet/İhbar dilekçesinde belirtilen iddialar: .......</p><p><br></p><p><strong>3. İFADE VE BEYANLAR</strong></p><p>Müşteki, şüpheli ve bilgi sahiplerinin beyanları...</p><p><br></p><p><strong>4. TAHLİL VE DEĞERLENDİRME</strong></p><p>Elde edilen bilgi, belge ve ifadeler ışığında iddiaların değerlendirilmesi.</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>İddiaların sübuta erip ermediği ve getirilen disiplin/mali teklifler.</p>",
    "Ön İnceleme": "<h1 style=\"text-align: center;\">ÖN İNCELEME RAPORU</h1><p><br></p><p><strong>1. ÖN İNCELEME EMRİ</strong></p><p>.......</p><p><br></p><p><strong>2. HAKKINDA ÖN İNCELEME YAPILANLAR</strong></p><p>Adı Soyadı, Unvanı, Görev Yeri</p><p><br></p><p><strong>3. ÖN İNCELEME KONUSU</strong></p><p>.......</p><p><br></p><p><strong>4. İNCELEME VE DEĞERLENDİRME</strong></p><p>.......</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>4483 sayılı Kanun kapsamında Soruşturma İzni Verilmesi / Verilmemesi teklifi.</p>",
    "Spor Kulüpleri": "<h1 style=\"text-align: center;\">SPOR KULÜBÜ DENETİM RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>7405 sayılı Spor Kulüpleri ve Spor Federasyonları Kanunu kapsamında ....... Spor Kulübü'nün idari ve mali denetimi hakkındadır.</p><p><br></p><p><strong>2. İDARİ YAPI VE İŞLEYİŞ</strong></p><p>Tüzük uygunluğu, üye kayıt defteri, yönetim kurulu karar defterinin incelenmesi.</p><p><br></p><p><strong>3. MALİ İNCELEME</strong></p><p>Gelir-gider tabloları, bağış makbuzları ve bilanço değerleri.</p><p><br></p><p><strong>4. SONUÇ</strong></p><p>İyileştirilmesi gereken alanlar ve mevzuata aykırı eylemlere ilişkin bildirimler.</p>"
};

export default function Audit() {
    const { user, loading: authLoading } = useAuth();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [audits, setAudits] = useState<AuditType[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState("kisisel");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState("Tümü");
    const [filterInspector, setFilterInspector] = useState("Tümü");
    const [filterTaskType, setFilterTaskType] = useState("Tümü");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    
    // Simple local cache for the session
    const cacheRef = useRef<{audits?: AuditType[], tasks?: Task[]}>({});
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

    const loadData = async (silent = false) => {
        if (authLoading) return;
        
        const localUserRaw = localStorage.getItem('demo_user');
        const localUser = localUserRaw ? JSON.parse(localUserRaw) : null;
        
        const effectiveId = user?.uid || localUser?.uid;
        const effectiveEmail = user?.email || localUser?.email;

        if (!effectiveId && !effectiveEmail) {
            setLoading(false);
            return;
        }
        
        try {
            if (!silent) setLoading(true);
            const [auditsData, tasksData] = await Promise.all([
                fetchAudits(effectiveId, effectiveEmail).catch(() => []),
                fetchTasks(effectiveId, effectiveEmail).catch(() => []) 
            ]);
            
            setAudits(auditsData);
            setTasks(tasksData);
            
            // Update cache
            cacheRef.current = { audits: auditsData, tasks: tasksData };
        } catch (error) {
            console.error("Veriler yüklenemedi:", error);
            setAudits([]);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (cacheRef.current.audits && cacheRef.current.tasks) {
            setAudits(cacheRef.current.audits);
            setTasks(cacheRef.current.tasks);
            setLoading(false);
            loadData(true);
        } else {
            loadData();
        }
    }, [user, authLoading]);

    const handleCreateAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAudit.task_id) {
            toast.error("Lütfen önce bu denetimle ilişkili bir Görev seçiniz.");
            return;
        }
        try {
            if (!user) return;
            const currentUser = user;
            const selectedTask = tasks.find(t => t.id === newAudit.task_id);
            const taskAssigned = selectedTask?.assigned_to || [];
            const taskShared = selectedTask?.shared_with || [];
            const isPublic = (selectedTask as any)?.is_public === true;
            
            const combinedAssigned = Array.from(new Set([...taskAssigned, currentUser.uid]));

            const auditPayload: any = {
                task_id: newAudit.task_id,
                title: newAudit.title,
                location: newAudit.location,
                date: newAudit.date,
                inspector: newAudit.inspector,
                status: newAudit.status,
                report_content: RAPOR_SABLONLARI[newAudit.template] || "",
                owner_id: currentUser.uid,
                assigned_to: combinedAssigned,
                shared_with: taskShared,
                is_public: isPublic,
                report_seq: newAudit.report_seq || 1
            };
            
            const created = await createAudit(auditPayload);
            
            // Görev durumunu güncelle
            if (selectedTask && selectedTask.rapor_durumu === "Başlanmadı") {
                await updateTask(selectedTask.id, { rapor_durumu: "Devam Ediyor" });
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
            toast.success("Denetim başarıyla oluşturuldu.");
            navigate(`/audit/${created.id}/report`);
        } catch (error) {
            console.error(error);
            toast.error("Denetim oluşturulurken hata oluştu.");
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
                location: "Merkez / Yerinde",
                report_seq: nextSeq
            });
        } else {
            setNewAudit({ ...newAudit, task_id: taskId, report_seq: 1 });
        }
    };

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

    const filteredAudits = useMemo(() => {
        return audits.filter(a => {
            const matchesSearch = !debouncedSearch || 
                                  a.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                                  a.location.toLowerCase().includes(debouncedSearch.toLowerCase());
            const isPublic = (a as any).is_public === true;
            const matchesTab = activeTab === 'ortak' ? isPublic : !isPublic;

            const relatedTask = tasks.find(t => String(t.id).trim() === String(a.task_id).trim());
            const effectiveStatus = relatedTask?.rapor_durumu || a.status;
            const matchesStatus = filterStatus === "Tümü" || effectiveStatus === filterStatus;
            const matchesInspector = filterInspector === "Tümü" || a.inspector === filterInspector;
            const matchesTaskType = filterTaskType === "Tümü" || relatedTask?.rapor_turu === filterTaskType;

            return matchesSearch && matchesTab && matchesStatus && matchesInspector && matchesTaskType;
        }).sort((a, b) => {
            if (a.task_id !== b.task_id) {
                return (a.task_id || "").localeCompare(b.task_id || "");
            }
            return (a.report_seq || 0) - (b.report_seq || 0);
        });
    }, [audits, tasks, debouncedSearch, activeTab, filterStatus, filterInspector, filterTaskType]);

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
                        Rapor Yönetimi
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Denetim formlarını doldurun ve raporlarınızı oluşturun.</p>
                </div>
                
                <div className="flex bg-muted p-1.5 rounded-xl ml-auto mr-6">
                    <button 
                        onClick={() => setActiveTab("kisisel")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'kisisel' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground'}`}
                    >
                        Özel Kayıtlarım
                    </button>
                    <button 
                        onClick={() => setActiveTab("ortak")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'ortak' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground'}`}
                    >
                        Kurumsal Arşiv
                    </button>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleExportExcel} className="h-12 px-6 border-emerald-100 text-emerald-600 hover:bg-emerald-50 rounded-xl font-bold shadow-sm">
                        <FileSpreadsheet className="mr-2" size={18} /> Excel'e Aktar
                    </Button>
                    <Button className="h-12 px-6 shadow-lg shadow-primary/20 rounded-xl" onClick={() => setIsModalOpen(true)}>
                        <Plus className="mr-2" size={20} /> Yeni Rapor Başlat
                    </Button>
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
                        placeholder="Denetim adı, yeri veya tarihine göre ara..."
                        className="bg-transparent border-none outline-none text-sm w-full font-outfit font-medium"
                    />
                </div>
                <Button variant="outline" className="h-12 rounded-xl px-6" onClick={() => setIsFilterOpen((v) => !v)}>
                    <Filter className="mr-2" size={18} /> Filtrele
                </Button>
            </div>

            {isFilterOpen && (
                <Card className="p-5 border border-border rounded-2xl bg-card shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>

                    <div className="flex justify-end mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setFilterStatus("Tümü");
                                setFilterInspector("Tümü");
                                setFilterTaskType("Tümü");
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
            ) : filteredAudits.length > 0 ? (
                <div className="space-y-4">
                    {filteredAudits.map((audit) => (
                        <AuditListItem
                            key={audit.id}
                            audit={audit}
                            task={tasks.find(t => String(t.id).trim() === String(audit.task_id).trim())}
                            isSelected={selectedIds.includes(audit.id)}
                            onToggleSelect={() => handleToggleSelect(audit.id)}
                            onExportWord={() => exportAuditToWord(audit.id)}
                            onEdit={() => navigate(`/audit/${audit.id}/report`)}
                            onUpdate={handleUpdateAudit}
                            onDelete={() => handleSingleDelete(audit.id)}
                        />
                    ))}
                </div>
            ) : (
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-5 border-dashed border-2 rounded-3xl bg-card/50 border-border/50">
                    <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center text-muted-foreground/30">
                        <FileText size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-primary font-outfit">Kayıt Bulunamadı</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm font-medium">Aradığınız kriterlere uygun denetim bulunmuyor veya henüz hiç denetim başlatmadınız.</p>
                    </div>
                    <Button variant="outline" className="rounded-xl px-8 h-12" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} className="mr-2" /> İlk Raporu Oluştur
                    </Button>
                </Card>
            )}

            {isModalOpen && (
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Yeni Rapor Başlat"
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
                            {tasks.map(t => (
                                <option key={t.id} value={t.id} className="bg-card">{t.rapor_kodu} - {t.rapor_adi}</option>
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
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Denetim Mahalli (Yer)</label>
                        <input 
                            required
                            className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                            placeholder="Örn: Ankara"
                            value={newAudit.location}
                            onChange={(e) => setNewAudit({...newAudit, location: e.target.value})}
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
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Taslak Şablon</label>
                            <select 
                                className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                value={newAudit.template}
                                onChange={(e) => setNewAudit({...newAudit, template: e.target.value})}
                            >
                                <option value="Boş Rapor" className="bg-card">Boş Rapor</option>
                                <option value="Genel Teftiş" className="bg-card">Genel Teftiş</option>
                                <option value="İnceleme-Soruşturma" className="bg-card">İnceleme-Soruşturma</option>
                                <option value="Ön İnceleme" className="bg-card">Ön İnceleme</option>
                                <option value="Spor Kulüpleri" className="bg-card">Spor Kulüpleri</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 h-12 rounded-xl font-bold"
                        >
                            İptal
                        </Button>
                        <Button 
                            type="submit"
                            className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                        >
                            Başlat
                        </Button>
                    </div>
                </form>
            </Modal>
            )}
        </div>
    );
}

function AuditListItem({ audit, onExportWord, onEdit, isSelected, onToggleSelect, task, onUpdate, onDelete }: { audit: AuditType, onExportWord: () => void, onEdit: () => void, isSelected: boolean, onToggleSelect: () => void, task?: Task, onUpdate: (id: string, updates: Partial<AuditType>) => void, onDelete: () => void }) {
    const { title, date, status, inspector, location } = audit;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const statusColors: any = {
        "Başlanmadı": "bg-slate-500/10 text-slate-600 border-slate-500/20",
        "Devam Ediyor": "bg-blue-500/10 text-blue-600 border-blue-500/20",
        "Evrak Bekleniyor": "bg-purple-500/10 text-purple-600 border-purple-500/20",
        "İncelemede": "bg-amber-500/10 text-amber-600 border-amber-500/20",
        "Rapor Yazılıyor": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        "Tamamlandı": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };

    useEffect(() => {
        const handleClickOutside = () => {
            if (isMenuOpen) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isMenuOpen]);

    return (
        <Card className={cn(
            "p-4 md:p-6 transition-all group shadow-sm bg-card border-border/60 rounded-2xl relative",
            isSelected ? 'border-red-500/50 ring-2 ring-red-500/20' : 'hover:border-primary/50 hover:shadow-xl'
        )}>
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none hidden md:block">
                <div className="absolute top-0 right-0 w-24 h-full bg-primary/5 -skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform opacity-50" />
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 relative z-10 w-full">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-4">
                        <div className="relative flex items-center z-20 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            <input 
                                type="checkbox" 
                                title="Seç"
                                checked={isSelected}
                                onChange={onToggleSelect}
                                className="w-5 h-5 rounded-md border-slate-300 text-red-500 cursor-pointer shadow-sm focus:ring-red-500"
                            />
                        </div>
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-muted flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6 shadow-inner shrink-0">
                            <FileText size={28} className="md:hidden" />
                            <FileText size={32} className="hidden md:block" />
                        </div>
                    </div>
                    {/* Status Badge - Mobile only in top right */}
                    <div className="md:hidden">
                        <span className={cn(
                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm",
                            statusColors[task?.rapor_durumu || status] || 'bg-slate-100 text-slate-500'
                        )}>
                            {task ? task.rapor_durumu : 'Taslak'}
                        </span>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
                        <h4 className="font-bold text-lg md:text-xl text-secondary group-hover:text-primary transition-colors font-outfit uppercase tracking-tight truncate">{title}</h4>
                        {task && (
                            <span className="w-fit px-2 py-0.5 bg-primary/5 text-primary text-[9px] md:text-[10px] font-black rounded-lg border border-primary/10 uppercase tracking-widest whitespace-nowrap">
                                Görev: {task.rapor_kodu}{audit.report_seq && audit.report_seq > 1 ? `-${audit.report_seq}` : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock size={12} className="text-primary/60" /> {date}</span>
                        <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="flex items-center gap-1.5"><Shield size={12} className="text-primary/60" /> {inspector}</span>
                        <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary/60" /> {location}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-border/40 w-full md:w-auto">
                    {/* Status Badge - Desktop only */}
                    <span className={cn(
                        "hidden md:block px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] border shadow-sm",
                        statusColors[task?.rapor_durumu || status] || 'bg-slate-100 text-slate-500'
                    )}>
                        {task ? task.rapor_durumu : (audit.task_id ? `Görev Bulunamadı` : "Rapor Taslağı")}
                    </span>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onEdit}
                            className="flex-1 md:flex-none h-11 md:h-12 px-3 md:px-6 rounded-xl md:rounded-2xl font-bold text-primary hover:bg-primary hover:text-white border-primary/20 shadow-sm transition-all flex items-center justify-center gap-1.5 md:gap-2 text-[10px] md:text-xs uppercase tracking-widest"
                        >
                            <Edit3 size={16} /> <span className="inline">Düzenle</span>
                        </Button>
                        
                        <div className="flex items-center gap-1 shrink-0">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onExportWord}
                                className="w-11 h-11 md:w-12 md:h-12 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                                title="Word olarak indir"
                            >
                                <Download size={20} />
                            </Button>
                            
                            <div className="relative">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={`w-11 h-11 md:w-12 md:h-12 text-muted-foreground hover:text-primary hover:bg-muted rounded-xl ${isMenuOpen ? 'bg-muted text-primary' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
                                    title="Diğer Seçenekler"
                                >
                                    <MoreVertical size={20} />
                                </Button>
                                {isMenuOpen && (
                                    <div 
                                        className="absolute right-0 bottom-full md:bottom-auto md:top-full mb-2 md:mb-0 md:mt-2 w-64 bg-card rounded-xl shadow-2xl border border-slate-200 z-[100] p-2 flex flex-col gap-1 ring-1 ring-black/5"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button 
                                            className="flex items-center gap-2 text-left px-3 py-3 text-xs font-bold hover:bg-muted text-foreground rounded-lg transition-colors border-b border-slate-50 mb-1"
                                            onClick={() => { onUpdate(audit.id, { is_public: !(audit as any).is_public }); setIsMenuOpen(false); }}
                                        >
                                            {(audit as any).is_public ? '📥 Arşivden Çıkar' : '📤 Arşive Ekle / Paylaş'}
                                        </button>
                                        {!task && (
                                            <button 
                                                className="flex items-center gap-2 text-left px-3 py-3 text-xs font-bold hover:bg-muted text-muted-foreground rounded-lg transition-colors"
                                                onClick={() => { onUpdate(audit.id, { status: status === 'Devam Ediyor' ? 'Tamamlandı' : 'Devam Ediyor' }); setIsMenuOpen(false); }}
                                            >
                                                {status === 'Devam Ediyor' ? '✅ "Tamamlandı" Yap' : '🔄 "Devam Ediyor" Yap'}
                                            </button>
                                        )}
                                        <div className="h-px bg-slate-100 my-1"></div>
                                        <button 
                                            className="flex items-center gap-2 text-left px-3 py-3 text-xs font-bold hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            onClick={() => { onDelete(); setIsMenuOpen(false); }}
                                        >
                                            <Trash2 size={16} className="text-red-500" /> Kaydı Sil
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
