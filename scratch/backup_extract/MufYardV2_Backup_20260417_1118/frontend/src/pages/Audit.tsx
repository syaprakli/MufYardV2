import { Plus, Search, Filter, FileText, Download, Loader2, FileSpreadsheet, Edit3, Shield, MapPin, Clock, X, Trash2, MoreVertical, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchAudits, createAudit, deleteAudit, exportAuditsToExcel, exportAuditToWord, type Audit as AuditType } from "../lib/api/audit";
import { fetchTasks, type Task } from "../lib/api/tasks";
import { useAuth } from "../lib/hooks/useAuth";

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

    const loadData = async () => {
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
            setLoading(true);
            const [auditsData, tasksData] = await Promise.all([
                fetchAudits(effectiveId, effectiveEmail).catch(() => []),
                fetchTasks(effectiveId, effectiveEmail).catch(() => []) 
            ]);
            
            setAudits(auditsData);
            setTasks(tasksData);
        } catch (error) {
            console.error("Veriler yüklenemedi:", error);
            setAudits([]);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        loadData();
    }, [user, authLoading]);

    const handleCreateAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAudit.task_id) {
            toast.error("Lütfen önce bu denetimle ilişkili bir Görev seçiniz.");
            return;
        }
        try {
            const currentUser = user || JSON.parse(localStorage.getItem('demo_user') || '{"email": "mufettis@gsb.gov.tr", "uid": "mufettis@gsb.gov.tr"}');
            const selectedTask = tasks.find(t => t.id === newAudit.task_id);
            const taskAssigned = selectedTask?.assigned_to || [];
            const taskShared = selectedTask?.shared_with || [];
            
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
                report_seq: newAudit.report_seq || 1
            };
            
            await createAudit(auditPayload);
            setIsModalOpen(false);
            setNewAudit({
                task_id: "",
                title: "",
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: "Sefa YAPRAKLI",
                status: "Devam Ediyor",
                template: "Boş Rapor",
                report_seq: 1
            });
            toast.success("Denetim başarıyla oluşturuldu.");
            loadData();
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
            const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  a.location.toLowerCase().includes(searchQuery.toLowerCase());
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
    }, [audits, tasks, searchQuery, activeTab, filterStatus, filterInspector, filterTaskType]);

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
                
                <div className="flex bg-slate-200/50 p-1.5 rounded-xl ml-auto mr-6">
                    <button 
                        onClick={() => setActiveTab("kisisel")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'kisisel' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Özel Kayıtlarım
                    </button>
                    <button 
                        onClick={() => setActiveTab("ortak")}
                        className={`px-5 py-2 rounded-lg font-bold text-xs transition-all uppercase tracking-widest ${activeTab === 'ortak' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-border shadow-sm">
                    <input 
                        type="checkbox" 
                        checked={filteredAudits.length > 0 && selectedIds.length === filteredAudits.length}
                        onChange={handleToggleSelectAll}
                        className="w-5 h-5 rounded-md border-slate-300 text-primary cursor-pointer focus:ring-primary/20"
                        title="Tümünü Seç/Bırak"
                    />
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{selectedIds.length} Seçili</span>
                </div>
                
                {selectedIds.length > 0 && (
                    <Button variant="outline" size="lg" className="rounded-xl px-6 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm transition-all" onClick={handleDeleteSelected}>
                        <Trash2 className="mr-2" size={18} /> Seçilenleri Sil
                    </Button>
                )}

                <div className="flex-1 bg-white border border-border rounded-xl px-5 py-3 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                    <Search size={18} className="text-muted-foreground mr-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Denetim adı, yeri veya tarihine göre ara..."
                        className="bg-transparent border-none outline-none text-sm w-full font-outfit font-medium"
                    />
                </div>
                <Button variant="outline" size="lg" className="rounded-xl px-6" onClick={() => setIsFilterOpen((v) => !v)}>
                    <Filter className="mr-2" size={18} /> Filtrele
                </Button>
            </div>

            {isFilterOpen && (
                <Card className="p-5 border border-border rounded-2xl bg-white shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Durum</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
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
                                className="mt-2 w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
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
                        />
                    ))}
                </div>
            ) : (
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-5 border-dashed border-2 rounded-3xl bg-white/50 border-border/50">
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
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.6)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
                >
                    <div 
                        style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', width: '100%', maxWidth: '32rem', overflow: 'hidden' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>Yeni Rapor Başlat</h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem', borderRadius: '50%', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAudit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>İlişkili Görev (Zorunlu)</label>
                                <select 
                                    required
                                    style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                                    value={newAudit.task_id}
                                    onChange={(e) => handleTaskSelect(e.target.value)}
                                >
                                    <option value="">Görev Seçiniz...</option>
                                    {tasks.map(t => (
                                        <option key={t.id} value={t.id}>{t.rapor_kodu} - {t.rapor_adi}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>Kurum Adı / Denetim Konusu</label>
                                <input 
                                    required
                                    style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="Örn: Ankara Şubesi Genel Denetimi"
                                    value={newAudit.title}
                                    onChange={(e) => setNewAudit({...newAudit, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>Denetim Mahalli (Yer)</label>
                                <input 
                                    required
                                    style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                    placeholder="Örn: Ankara"
                                    value={newAudit.location}
                                    onChange={(e) => setNewAudit({...newAudit, location: e.target.value})}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>Tarih</label>
                                    <input 
                                        style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                        value={newAudit.date}
                                        onChange={(e) => setNewAudit({...newAudit, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '0.5rem' }}>Taslak Şablon</label>
                                    <select 
                                        style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', outline: 'none', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                                        value={newAudit.template}
                                        onChange={(e) => setNewAudit({...newAudit, template: e.target.value})}
                                    >
                                        <option value="Boş Rapor">Boş Rapor</option>
                                        <option value="Genel Teftiş">Genel Teftiş</option>
                                        <option value="İnceleme-Soruşturma">İnceleme-Soruşturma</option>
                                        <option value="Ön İnceleme">Ön İnceleme</option>
                                        <option value="Spor Kulüpleri">Spor Kulüpleri</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem' }}>
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ flex: 1, height: '3.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', backgroundColor: 'transparent', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem' }}
                                >
                                    İptal
                                </button>
                                <button 
                                    type="submit"
                                    style={{ flex: 1, height: '3.5rem', borderRadius: '1rem', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem' }}
                                >
                                    Başlat
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function AuditListItem({ audit, onExportWord, onEdit, isSelected, onToggleSelect, task }: { audit: AuditType, onExportWord: () => void, onEdit: () => void, isSelected: boolean, onToggleSelect: () => void, task?: Task }) {
    const { title, date, status, inspector, location } = audit;
    const statusColors: any = {
        "Başlanmadı": "bg-slate-500/10 text-slate-600 border-slate-500/20",
        "Devam Ediyor": "bg-blue-500/10 text-blue-600 border-blue-500/20",
        "Evrak Bekleniyor": "bg-purple-500/10 text-purple-600 border-purple-500/20",
        "İncelemede": "bg-amber-500/10 text-amber-600 border-amber-500/20",
        "Rapor Yazılıyor": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        "Tamamlandı": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };

    return (
        <Card className={`p-6 flex items-center justify-between transition-all group shadow-sm bg-white border-border/60 rounded-2xl relative overflow-hidden ${isSelected ? 'border-red-500/50 ring-2 ring-red-500/20' : 'hover:border-primary/50 hover:shadow-xl'}`}>
            <div className="absolute top-0 right-0 w-24 h-full bg-primary/5 -skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform opacity-50" />
            <div className="flex items-center gap-6 relative z-10 w-full pl-1">
                <div className="relative flex items-center z-20 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox" 
                        title="Seç"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className="w-5 h-5 rounded-md border-slate-300 text-red-500 cursor-pointer shadow-sm focus:ring-red-500"
                    />
                </div>
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6 shadow-inner shrink-0 ml-1">
                    <FileText size={32} />
                </div>
                <div className="truncate pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-xl text-secondary group-hover:text-primary transition-colors font-outfit uppercase tracking-tight">{title}</h4>
                        {task && (
                            <span className="px-2 py-0.5 bg-primary/5 text-primary text-[10px] font-black rounded-lg border border-primary/10 uppercase tracking-widest whitespace-nowrap">
                                Görev: {task.rapor_kodu}{audit.report_seq && audit.report_seq > 1 ? `-${audit.report_seq}` : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock size={12} className="text-primary/60" /> {date}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="flex items-center gap-1.5"><Shield size={12} className="text-primary/60" /> {inspector}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="flex items-center gap-1.5"><MapPin size={12} className="text-primary/60" /> {location}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 relative z-10">
                <span className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] border shadow-sm ${statusColors[task?.rapor_durumu || status] || 'bg-slate-100 text-slate-500'}`}>
                    {task ? task.rapor_durumu : (audit.task_id ? `Görev Bulunamadı (${audit.task_id})` : "Rapor Taslağı")}
                </span>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={onEdit}
                        className="rounded-xl font-bold text-primary hover:bg-primary hover:text-white border-primary/20 shadow-sm transition-all flex items-center gap-2"
                    >
                        <Edit3 size={16} /> Raporu Düzenle
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onExportWord}
                        className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                        title="Word olarak indir"
                    >
                        <Download size={22} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary hover:bg-muted rounded-xl"
                        onClick={() => toast("Paylaş, Arşivle ve diğer özellikler çok yakında eklenecektir.", { icon: '🚀' })}
                        title="Diğer Seçenekler"
                    >
                        <MoreVertical size={22} />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
