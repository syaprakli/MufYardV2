import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search, FileText, Loader2, Trash2, Edit3, ClipboardList, X, UserPlus, ChevronRight, Calendar, Shield
} from "lucide-react";
import { toast } from "react-hot-toast";


import { fetchTasks, createTask, updateTask, deleteTask, acceptTask, type Task, type TaskStep } from "../lib/api/tasks";
import { fetchInspectors, type Inspector } from "../lib/api/inspectors";
import { fetchAudits, createAudit, deleteAudit } from "../lib/api/audit";
import { fetchAllProfiles } from "../lib/api/profiles";
import { useAuth } from "../lib/hooks/useAuth";
import { useTheme } from "../lib/context/ThemeContext";
import ShareModal from "../components/ShareModal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";

// Shared styles and sub-components
function ActionBtn({ children, title, color, onClick }: { children: React.ReactNode; title: string; color: string; onClick: () => void }) {
    return (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${color}20`,
                background: `${color}10`, color: color, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", transition: "all 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; }}
        >
            {children}
        </button>
    );
}

const RAPOR_TURLERI = ["Genel Denetim", "Özel Denetim", "İnceleme", "Soruşturma", "Ön İnceleme", "Araştırma"];
const RAPOR_SABLONLARI: Record<string, string> = {
    "Boş Rapor": "",
    "Genel Teftiş": `<h1 style="text-align: center;">GENEL TEFTİŞ RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>....... tarihli ve ....... sayılı Makam Onayı üzerine ....... İl Müdürlüğü ve bağlı birimlerinde yürütülen Genel Teftiş çalışmaları sonucunda bu rapor düzenlenmiştir.</p><p><br></p><p><strong>2. YAPILAN İNCELEME VE TESPİTLER</strong></p><p>Kurumun mevzuata uygunluk, mali ve idari işlemleri incelenmiş olup, tespit edilen hususlar aşağıda maddeler halinde açıklanmıştır:</p><ul><li>İlk tespit...</li></ul><p><br></p><p><strong>3. SONUÇ VE ÖNERİLER</strong></p><p>Yapılan genel teftiş neticesinde ....... kanaatine varılmıştır.</p>`,
    "İnceleme-Soruşturma": `<h1 style="text-align: center;">İNCELEME VE SORUŞTURMA RAPORU</h1><p><br></p><p><strong>1. İNCELEME/SORUŞTURMA EMRİ</strong></p><p>....... tarihli ve ....... sayılı görevlendirme emri.</p><p><br></p><p><strong>2. İDDİA KONUSU</strong></p><p>Şikayet/İhbar dilekçesinde belirtilen iddialar: .......</p><p><br></p><p><strong>3. İFADE VE BEYANLAR</strong></p><p>Müşteki, şüpheli ve bilgi sahiplerinin beyanları...</p><p><br></p><p><strong>4. TAHLİL VE DEĞERLENDİRME</strong></p><p>Elde edilen bilgi, belge ve ifadeler ışığında iddiaların değerlendirilmesi.</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>İddiaların sübuta erip ermediği ve getirilen disiplin/mali teklifler.</p>`,
    "Ön İnceleme": `<h1 style="text-align: center;">ÖN İNCELEME RAPORU</h1><p><br></p><p><strong>1. ÖN İNCELEME EMRİ</strong></p><p>.......</p><p><br></p><p><strong>2. HAKKINDA ÖN İNCELEME YAPILANLAR</strong></p><p>Adı Soyadı, Unvanı, Görev Yeri</p><p><br></p><p><strong>3. ÖN İNCELEME KONUSU</strong></p><p>.......</p><p><br></p><p><strong>4. İNCELEME VE DEĞERLENDİRME</strong></p><p>.......</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>4483 sayılı Kanun kapsamında Soruşturma İzni Verilmesi / Verilmemesi teklifi.</p>`,
    "Spor Kulüpleri": `<h1 style="text-align: center;">SPOR KULÜBÜ DENETİM RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>7405 sayılı Spor Kulüpleri ve Spor Federasyonları Kanunu kapsamında ....... Spor Kulübü'nün idari ve mali denetimi hakkındadır.</p><p><br></p><p><strong>2. İDARİ YAPI VE İŞLEYİŞ</strong></p><p>Tüzük uygunluğu, üye kayıt defteri, yönetim kurulu karar defterinin incelenmesi.</p><p><br></p><p><strong>3. MALİ İNCELEME</strong></p><p>Gelir-gider tabloları, bağış makbuzları ve bilanço değerleri.</p><p><br></p><p><strong>4. SONUÇ</strong></p><p>İyileştirilmesi gereken alanlar ve mevzuata aykırı eylemlere ilişkin bildirimler.</p>`
};
const RAPOR_DURUMLARI = ["Başlanmadı", "Devam Ediyor", "Evrak Bekleniyor", "İncelemede", "Tamamlandı"];

export default function Tasks() {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = (theme as string) === "dark";

    const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.65rem", fontWeight: 900, color: "var(--secondary)", letterSpacing: "0.15em", marginBottom: "0.4rem", textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" };
    const inputStyle: React.CSSProperties = { width: "100%", padding: "0.8rem 1rem", border: "1px solid var(--border)", borderRadius: "1rem", fontSize: "0.875rem", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box", background: "var(--background)", color: "var(--foreground)", transition: "all 0.2s" };
    const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" };
    const modalBoxStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "1.5rem", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: "550px", padding: "2rem" };

    const [tasks, setTasks] = useState<Task[]>([]);
    const { user } = useAuth();
    
    const currentUser = user;
    const effectiveUid = currentUser?.uid;

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showSablonModal, setShowSablonModal] = useState<string | null>(null); // task id
    const [showReportSelector, setShowReportSelector] = useState<Task | null>(null);
    const [taskAudits, setTaskAudits] = useState<any[]>([]);
    const [shareTask, setShareTask] = useState<Task | null>(null);
    const [newStepText, setNewStepText] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("kisisel");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const [isNewAuditModalOpen, setIsNewAuditModalOpen] = useState<Task | null>(null);
    const [newAudit, setNewAudit] = useState({
        title: "",
        location: "",
        date: new Date().toLocaleDateString("tr-TR"),
        inspector: currentUser?.displayName || currentUser?.email?.split('@')[0] || "Sefa YAPRAKLI",
        status: "Devam Ediyor",
        template: "Boş Rapor",
        report_seq: 1
    });
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [invitations, setInvitations] = useState<Task[]>([]);
    const [showInspectorDropdown, setShowInspectorDropdown] = useState(false);
    const [inspectorSearch, setInspectorSearch] = useState("");
    const inspectorDropdownRef = useRef<HTMLDivElement>(null);

    const raporOnek = localStorage.getItem('raporKoduOnek') || 'S.Y.64';
    const autoKodu = `${raporOnek}/${new Date().getFullYear()}-${tasks.length + 1}`;
    
    const [form, setForm] = useState({
        rapor_kodu: "",
        rapor_adi: "",
        rapor_turu: "Genel Denetim",
        baslama_tarihi: new Date().toISOString().split("T")[0],
        sure_gun: 30,
        assigned_to: [] as string[]
    });

    useEffect(() => { 
        if (effectiveUid) {
            loadTasks(); 
            loadInspectors();
        }
    }, [effectiveUid]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (inspectorDropdownRef.current && !inspectorDropdownRef.current.contains(e.target as Node)) {
                setShowInspectorDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadInspectors = async () => {
        try {
            // "Herkesi kapsamalı" talebi için hem manuel eklenen müfettişleri 
            // hem de sistemdeki tüm profilleri çekip birleştiriyoruz.
            const [directoryData, profilesData] = await Promise.all([
                fetchInspectors(),
                fetchAllProfiles()
            ]);
            
            // Unik listeleme (email bazlı)
            const combined = [...directoryData];
            profilesData.forEach((p: any) => {
                if (!combined.find(c => c.email === p.email)) {
                    combined.push({
                        id: p.uid || p.id,
                        name: p.full_name || p.display_name || p.email,
                        email: p.email,
                        title: "Sistem Kullanıcısı",
                        created_at: new Date().toISOString()
                    });
                }
            });

            setInspectors(combined);
        } catch { /* silent */ }
    };

    useEffect(() => {
        if (!form.rapor_kodu) {
            setForm(prev => ({ ...prev, rapor_kodu: autoKodu }));
        }
    }, [autoKodu, form.rapor_kodu]);

    if (!user) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    const loadTasks = async () => {
        if (!effectiveUid) return;
        try {
            setLoading(true);
            const data = await fetchTasks(effectiveUid);
            
            const accepted = data.filter(t => 
                t.owner_id === effectiveUid || 
                t.accepted_collaborators?.includes(effectiveUid)
            );
            
            const pending = data.filter(t => 
                t.pending_collaborators?.includes(effectiveUid) &&
                t.owner_id !== effectiveUid
            );

            setTasks(accepted);
            setInvitations(pending);
        } catch { 
            setTasks([]); 
            setInvitations([]);
        } finally { 
            setLoading(false); 
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.rapor_adi.trim()) return;
        try {
            setSaving(true);
            const kodToUse = form.rapor_kodu.trim() || autoKodu;
            await createTask({ 
                ...form, 
                rapor_kodu: kodToUse, 
                rapor_durumu: "Başlanmadı", 
                steps: [],
                is_public: activeTab === 'ortak',
                owner_id: currentUser?.uid || "",
                assigned_to: form.assigned_to.length > 0 ? form.assigned_to : [currentUser?.uid || ""]
            });
            setForm({ 
                rapor_kodu: "", 
                rapor_adi: "", 
                rapor_turu: "Genel Denetim", 
                baslama_tarihi: new Date().toISOString().split("T")[0], 
                sure_gun: 30,
                assigned_to: []
            });
            toast.success("Görev başarıyla oluşturuldu.");
            await loadTasks();
        } catch { toast.error("Görev oluşturulamadı."); }
        finally { setSaving(false); }
    };

    const toggleInspector = (id: string) => {
        setForm(prev => ({
            ...prev,
            assigned_to: prev.assigned_to.includes(id) 
                ? prev.assigned_to.filter(i => i !== id)
                : [...prev.assigned_to, id]
        }));
    };

    const handleAcceptInvitation = async (taskId: string) => {
        try {
            setSaving(true);
            await acceptTask(taskId, effectiveUid || "");
            toast.success("Görev kabul edildi ve listenize eklendi.");
            await loadTasks();
        } catch (error) {
            toast.error("Görev kabul edilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            // 1. Find and delete all associated audits first (Cascading Delete)
            const allAudits = await fetchAudits(effectiveUid);
            const associatedAudits = allAudits.filter(a => a.task_id === deleteConfirmId);
            
            if (associatedAudits.length > 0) {
                await Promise.all(associatedAudits.map(a => deleteAudit(a.id)));
            }

            // 2. Delete the task itself
            await deleteTask(deleteConfirmId);
            setTasks(prev => prev.filter(t => t.id !== deleteConfirmId));
            toast.success("Görev ve ilişkili tüm raporlar başarıyla silindi.");
        } catch (error) { 
            console.error("Silme hatası:", error);
            toast.error("Silme işlemi başarısız.");
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleAddStep = async (task: Task) => {
        const text = newStepText[task.id]?.trim();
        if (!text) return;
        const updatedSteps: TaskStep[] = [...(task.steps || []), { text, done: false }];
        try {
            await updateTask(task.id, { steps: updatedSteps });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, steps: updatedSteps } : t));
            setNewStepText(prev => ({ ...prev, [task.id]: "" }));
        } catch { /* silent */ }
    };

    const handleToggleStep = async (task: Task, index: number) => {
        const updatedSteps = (task.steps || []).map((s, i) => i === index ? { ...s, done: !s.done } : s);
        try {
            await updateTask(task.id, { steps: updatedSteps });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, steps: updatedSteps } : t));
        } catch { /* silent */ }
    };

    const handleDeleteStep = async (task: Task, index: number) => {
        const updatedSteps = (task.steps || []).filter((_, i) => i !== index);
        try {
            await updateTask(task.id, { steps: updatedSteps });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, steps: updatedSteps } : t));
        } catch { /* silent */ }
    };

    const handleOpenReportSelector = async (task: Task) => {
        try {
            setLoading(true);
            // Hem UID hem Email ile sorgulayarak yetki kapsamını genişletiyoruz
            const allAudits = await fetchAudits(effectiveUid || "", currentUser?.email || undefined);
            const associated = allAudits.filter(a => String(a.task_id).trim() === String(task.id).trim());
            setTaskAudits(associated);
            
            const nextSeq = Math.max(0, ...associated.map(a => a.report_seq || 0)) + 1;

            if (associated.length > 0) {
                setShowReportSelector(task);
            } else {
                setNewAudit({
                    ...newAudit,
                    title: task.rapor_adi,
                    location: "Merkez / Yerinde",
                    report_seq: nextSeq
                });
                setIsNewAuditModalOpen(task);
            }
        } catch (error) {
            toast.error("Raporlar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAuditFromTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isNewAuditModalOpen) return;
        
        try {
            setSaving(true);
            
            // Görevden ekip üyelerini ve gizlilik durumunu miras al
            const taskAssigned = isNewAuditModalOpen.assigned_to || [];
            const taskShared = isNewAuditModalOpen.shared_with || [];
            const isPublic = (isNewAuditModalOpen as any).is_public === true;
            
            // Unik liste (owner_id dahil)
            const combinedAssigned = Array.from(new Set([...taskAssigned, effectiveUid]));

            const auditPayload: any = {
                task_id: isNewAuditModalOpen.id,
                title: newAudit.title,
                location: newAudit.location,
                date: newAudit.date,
                inspector: newAudit.inspector,
                status: "Devam Ediyor",
                report_content: RAPOR_SABLONLARI[newAudit.template] || "",
                owner_id: effectiveUid,
                assigned_to: combinedAssigned,
                shared_with: taskShared,
                is_public: isPublic,
                report_seq: newAudit.report_seq || 1
            };
            
            const created = await createAudit(auditPayload);
            
            // Görev durumunu otomatik olarak "Devam Ediyor" yap
            if (isNewAuditModalOpen.rapor_durumu === "Başlanmadı") {
                await updateTask(isNewAuditModalOpen.id, { rapor_durumu: "Devam Ediyor" });
            }

            setIsNewAuditModalOpen(null);
            setShowReportSelector(null);
            toast.success(`Denetim (/#${newAudit.report_seq}) başlatıldı.`);
            
            // Rapor seq ne olursa olsun doğrudan düzenleyiciye git (kullanıcı beklentisi)
            navigate(`/audit/${created.id}/report`);
        } catch (error) {
            toast.error("Denetim oluşturulamadı.");
        } finally {
            setSaving(false);
        }
    };

    const handleSablonSec = async (taskId: string, sablonName: string) => {
        try {
            setShowSablonModal(null);
            setShowReportSelector(null);
            setLoading(true);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            // 1. Get existing audits to determine next sequence number
            const existingAudits = await fetchAudits(effectiveUid || "", currentUser?.email || undefined);
            const taskAudits = existingAudits.filter(a => String(a.task_id).trim() === String(taskId).trim());
            const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;

            const auditPayload: any = {
                task_id: taskId,
                title: taskAudits.length === 0 ? task.rapor_adi : `${task.rapor_adi} - Ek Rapor`,
                location: "Merkez / Yerinde",
                date: new Date().toLocaleDateString("tr-TR"),
                status: "Rapor Yazılıyor",
                inspector: currentUser?.email?.split('@')[0] || "Müfettiş",
                owner_id: effectiveUid,
                report_content: RAPOR_SABLONLARI[sablonName] || "",
                assigned_to: Array.from(new Set([...(task.assigned_to || []), effectiveUid])),
                shared_with: task.shared_with || [],
                is_public: (task as any).is_public === true,
                report_seq: nextSeq
            };

            const newAudit = await createAudit(auditPayload);
            
            // Görev durumunu güncelle
            if (task.rapor_durumu === "Başlanmadı") {
                await updateTask(task.id, { rapor_durumu: "Devam Ediyor" });
            }

            toast.success(`Rapor #${nextSeq} oluşturuldu.`);
            navigate(`/audit/${newAudit.id}/report`);
        } catch (error) {
            console.error("Entegrasyon hatası:", error);
            toast.error("Rapor oluşturma işlemi başarısız.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingTask) return;
        try {
            await updateTask(editingTask.id, {
                rapor_adi: editingTask.rapor_adi,
                rapor_turu: editingTask.rapor_turu,
                baslama_tarihi: editingTask.baslama_tarihi,
                sure_gun: editingTask.sure_gun,
            });
            await loadTasks();
            toast.success("Görev güncellendi.");
            setEditingTask(null);
        } catch { toast.error("Kaydedilemedi."); }
    };

    const handleShareUpdate = async (newSharedWith: string[]) => {
        if (!shareTask) return;
        try {
            await updateTask(shareTask.id, { shared_with: newSharedWith });
            setTasks(prev => prev.map(t => t.id === shareTask.id ? { ...t, shared_with: newSharedWith } : t));
            toast.success("Paylaşım güncellendi.");
        } catch { toast.error("Paylaşım güncellenemedi."); }
    };

    const getSureInfo = (task: Task) => {
        if (!task.baslama_tarihi || !task.sure_gun) return null;
        const start = new Date(task.baslama_tarihi);
        const end = new Date(start);
        end.setDate(end.getDate() + task.sure_gun);
        const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
        return { diff, end, total: task.sure_gun };
    };

    const filtered = tasks.filter(t => {
        const matchesSearch = t.rapor_adi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               t.rapor_kodu?.toLowerCase().includes(searchQuery.toLowerCase());
        const isPublic = (t as any).is_public === true;
        const matchesTab = activeTab === 'ortak' ? isPublic : !isPublic;
        return matchesSearch && matchesTab;
    });

    const getDurumColor = (durum: string) => {
        switch (durum) {
            case "Tamamlandı": return "#10b981"; // Yeşil
            case "Başlanmadı": return "#94a3b8"; // Gri
            case "Evrak Bekleniyor": return "#8b5cf6"; // Mor
            case "İncelemede": return "#f59e0b"; // Turuncu/Sarı
            case "Devam Ediyor": return "#3b82f6"; // Mavi
            default: return "#94a3b8";
        }
    };

    const getKalanColor = (diff: number, total: number = 30) => {
        if (diff >= total / 2) return "#10b981"; // Yeşil (Yarısından fazla var)
        if (diff >= 0) return "#3b82f6";        // Mavi (Yarıdan az var)
        if (diff >= -30) return "#fbbf24";     // Sarı (0-1 ay gecikme)
        if (diff >= -90) return "#f97316";     // Turuncu (1-3 ay gecikme)
        return "#ef4444";                      // Kırmızı (3+ ay gecikme)
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 font-outfit">
                <div>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 md:mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span className="hidden xs:inline">MufYard Platform</span>
                        <ChevronRight size={10} className="hidden xs:inline" />
                        <span className="text-primary opacity-80 uppercase tracking-widest">GÖREVLER</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                        Görev Yönetimi
                    </h1>
                    <p className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-2">
                        <Calendar size={14} className="text-primary/40 shrink-0" />
                        <span className="truncate">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                    </p>
                </div>

                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl w-full lg:w-auto h-11 shrink-0">
                    <button 
                        onClick={() => setActiveTab("kisisel")}
                        className={`flex-1 lg:flex-none px-4 md:px-6 rounded-lg font-black text-[10px] uppercase transition-all tracking-widest whitespace-nowrap ${activeTab === 'kisisel' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Özel Kayıtlarım
                    </button>
                    <button 
                        onClick={() => setActiveTab("ortak")}
                        className={`flex-1 lg:flex-none px-4 md:px-6 rounded-lg font-black text-[10px] uppercase transition-all tracking-widest whitespace-nowrap ${activeTab === 'ortak' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Kurumsal Arşiv
                    </button>
                </div>
            </div>

            {/* Görev Oluşturma Formu */}
            {activeTab === 'kisisel' && (
                <Card className="p-4 md:p-8 bg-card border border-border shadow-sm mb-6">
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                            <div className="md:col-span-3 lg:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Rapor No</label>
                                <input
                                    placeholder={autoKodu}
                                    value={form.rapor_kodu}
                                    onChange={e => setForm({ ...form, rapor_kodu: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-muted/30 focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold tracking-tight outline-none"
                                />
                            </div>
                            <div className="md:col-span-9 lg:col-span-7 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Rapor Adı / Konusu</label>
                                <input
                                    required
                                    placeholder="Örn: X Belediyesi İncelemesi"
                                    value={form.rapor_adi}
                                    onChange={e => setForm({ ...form, rapor_adi: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="md:col-span-12 lg:col-span-3 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Rapor Türü</label>
                                <select
                                    value={form.rapor_turu}
                                    onChange={e => setForm({ ...form, rapor_turu: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none cursor-pointer appearance-none"
                                >
                                    {RAPOR_TURLERI.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                            <div className="md:col-span-6 lg:col-span-3 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Başlama Tarihi</label>
                                <input
                                    type="date"
                                    value={form.baslama_tarihi}
                                    onChange={e => setForm({ ...form, baslama_tarihi: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="md:col-span-6 lg:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Süre (Gün)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.sure_gun}
                                    onChange={e => setForm({ ...form, sure_gun: parseInt(e.target.value) || 30 })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="md:col-span-12 lg:col-span-7 space-y-1.5 relative" ref={inspectorDropdownRef}>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Görevde Yer Alan Kişiler</label>
                                <div
                                    onClick={() => setShowInspectorDropdown(p => !p)}
                                    className={cn(
                                        "w-full min-h-[48px] px-4 py-2 rounded-xl border bg-card flex flex-wrap items-center gap-1.5 cursor-pointer transition-all focus-within:ring-4 focus-within:ring-primary/10",
                                        showInspectorDropdown ? "border-primary ring-4 ring-primary/10" : "border-border"
                                    )}
                                >
                                    {form.assigned_to.length === 0 ? (
                                        <span className="text-slate-400 text-sm font-medium">Kişi seç veya ara...</span>
                                    ) : (
                                        form.assigned_to.map(id => {
                                            const ins = inspectors.find(i => i.email === id);
                                            return ins ? (
                                                <span key={id} className="inline-flex items-center gap-1 bg-slate-900 text-white rounded-lg px-2 py-1 text-[11px] font-bold">
                                                    {ins.name.split(' ')[0]}
                                                    <span
                                                        onClick={e => { e.stopPropagation(); toggleInspector(id); }}
                                                        className="hover:text-red-400 transition-colors ml-1 p-0.5"
                                                    >×</span>
                                                </span>
                                            ) : null;
                                        })
                                    )}
                                    <span className="ml-auto text-slate-400">
                                        <ChevronRight size={16} className={cn("transition-transform", showInspectorDropdown ? "rotate-90" : "")} />
                                    </span>
                                </div>

                                {showInspectorDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-3 border-b border-border bg-muted/30">
                                            <input
                                                autoFocus
                                                placeholder="İsim ara..."
                                                value={inspectorSearch}
                                                onChange={e => setInspectorSearch(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-full px-4 py-2 rounded-xl border border-border bg-card text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                            {inspectors
                                                .filter(ins => ins.name.toLowerCase().includes(inspectorSearch.toLowerCase()) || ins.email.toLowerCase().includes(inspectorSearch.toLowerCase()))
                                                .map(inspector => {
                                                    const isSelected = form.assigned_to.includes(inspector.email);
                                                    return (
                                                        <div
                                                            key={inspector.id}
                                                            onClick={() => toggleInspector(inspector.email)}
                                                            className={cn(
                                                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                                                                isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-md flex items-center justify-center border transition-all",
                                                                isSelected ? "bg-primary border-primary" : "bg-card border-border"
                                                            )}>
                                                                {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-bold truncate">{inspector.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold truncate uppercase tracking-tighter">{inspector.email}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                        <div className="p-3 bg-muted/30 border-t border-border flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{form.assigned_to.length} kişi seçildi</span>
                                            <button type="button" onClick={() => setShowInspectorDropdown(false)} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Tamam</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={saving}
                            className="w-full h-12 rounded-xl bg-primary text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <FileText size={18} className="mr-2" />}
                            {saving ? "Oluşturuluyor..." : "Yeni Görev Oluştur"}
                        </Button>
                    </form>
                </Card>
            )}

            {/* Bekleyen Görev Davetleri */}
            {invitations.length > 0 && activeTab === 'kisisel' && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mb-8 font-inter">
                    <div className="flex items-center gap-2 px-1 text-amber-600">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black tracking-widest font-outfit">Bekleyen Görev Davetleri ({invitations.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex flex-col justify-between group hover:bg-amber-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg tracking-widest">Yeni Atama</span>
                                        <span className="text-[10px] font-bold text-amber-500">{inv.rapor_kodu}</span>
                                    </div>
                                    <h4 className="font-bold text-foreground dark:text-slate-100 text-sm mb-1">{inv.rapor_adi}</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-4 italic flex items-center gap-1">
                                        <UserPlus size={10} /> Gönderen: {inv.owner_id}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleAcceptInvitation(inv.id)} 
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-10 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200/50 transition-all active:scale-95"
                                >
                                    Görevi Kabul Et ve Listeye Ekle
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Görev Listesi */}
            <Card className="overflow-hidden border border-border shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-6 border-b border-border bg-muted/20">
                    <h3 className="text-xl font-black font-outfit text-slate-900 dark:text-slate-100 tracking-tight">Aktif Görev Listesi</h3>
                    <div className="relative w-full md:w-[320px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            placeholder="Dosya no veya görev adı ile ara..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {/* Mobile Task List (Cards) */}
                    <div className="md:hidden divide-y divide-border">
                        {loading ? (
                            <div className="p-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 size={32} className="animate-spin text-primary" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Görevler Yükleniyor...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold text-sm">Kayıt bulunamadı.</div>
                        ) : (
                            filtered.map(task => {
                                const sureInfo = getSureInfo(task);
                                const statusColor = getDurumColor(task.rapor_durumu);
                                const timeColor = sureInfo ? getKalanColor(sureInfo.diff, sureInfo.total) : '#94a3b8';
                                
                                return (
                                    <div key={task.id} className="p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-primary tracking-widest">{task.rapor_kodu}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded uppercase">{task.rapor_turu}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{task.rapor_adi}</h4>
                                            </div>
                                            <button 
                                                onClick={() => setExpandedRow(expandedRow === task.id ? null : task.id)}
                                                className="p-2 rounded-lg bg-slate-100 text-slate-400"
                                            >
                                                <ChevronRight size={16} className={cn("transition-transform", expandedRow === task.id ? "rotate-90" : "")} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kalan Süre</span>
                                                    <span className="text-xs font-black" style={{ color: timeColor }}>{sureInfo ? `${sureInfo.diff} Gün` : '—'}</span>
                                                </div>
                                                <div className="w-px h-6 bg-slate-200" />
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Durum</span>
                                                    <select
                                                        value={task.rapor_durumu}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            try {
                                                                await updateTask(task.id, { rapor_durumu: newStatus });
                                                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, rapor_durumu: newStatus } : t));
                                                                toast.success("Durum güncellendi.");
                                                            } catch { toast.error("Hata oluştu."); }
                                                        }}
                                                        className="text-[10px] font-black uppercase tracking-tight bg-transparent border-none p-0 outline-none cursor-pointer"
                                                        style={{ color: statusColor }}
                                                    >
                                                        {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                <ActionBtn title="İş Adımları" color="#3b82f6" onClick={() => setExpandedRow(expandedRow === task.id ? null : task.id)}>
                                                    <ClipboardList size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Rapor Başlat" color="#10b981" onClick={() => handleOpenReportSelector(task)}>
                                                    <FileText size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Düzenle" color="#f59e0b" onClick={() => setEditingTask(task)}>
                                                    <Edit3 size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => setShareTask(task)}>
                                                    <UserPlus size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Sil" color="#ef4444" onClick={() => handleDelete(task.id)}>
                                                    <Trash2 size={14} />
                                                </ActionBtn>
                                            </div>
                                        </div>

                                        {expandedRow === task.id && (
                                            <div className="mt-4 pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-3">
                                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alt Görevler / Adımlar</h5>
                                                    <div className="space-y-2">
                                                        {(task.steps || []).map((step, idx) => (
                                                            <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded-lg">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(task, idx)} className="w-4 h-4 rounded border-border" />
                                                                    <span className={cn("text-xs font-medium truncate", step.done ? "line-through text-slate-400" : "text-slate-700")}>{step.text}</span>
                                                                </div>
                                                                <button onClick={() => handleDeleteStep(task, idx)} className="text-rose-400 p-1"><X size={14} /></button>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2">
                                                            <input
                                                                placeholder="Yeni adım ekle..."
                                                                value={newStepText[task.id] || ""}
                                                                onChange={e => setNewStepText({ ...newStepText, [task.id]: e.target.value })}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddStep(task)}
                                                                className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium outline-none"
                                                            />
                                                            <Button onClick={() => handleAddStep(task)} size="sm" className="h-9 px-3 text-[10px] font-black uppercase">EKLE</Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Task Table */}
                    <table className="hidden md:table w-full border-collapse">
                        <thead>
                            <tr className="bg-muted/30">
                                {["Rapor No", "Görev Adı", "Tür", "Kalan", "Durum", "İşlemler"].map(col => (
                                    <th key={col} className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <Loader2 size={32} className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-slate-400 font-bold">Kayıt bulunamadı.</td>
                                </tr>
                            ) : (
                                filtered.map(task => {
                                    const isExpanded = expandedRow === task.id;
                                    const sureInfo = getSureInfo(task);
                                    return (
                                        <React.Fragment key={task.id}>
                                            <tr className={cn("hover:bg-muted/50 transition-colors", isExpanded ? "bg-muted/50" : "bg-transparent")}>
                                                <td className="px-6 py-4"><span className="font-black text-primary text-[11px] tracking-widest font-outfit">{task.rapor_kodu}</span></td>
                                                <td className="px-6 py-4"><span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{task.rapor_adi}</span></td>
                                                <td className="px-6 py-4"><span className="font-bold text-slate-400 text-[11px] uppercase">{task.rapor_turu}</span></td>
                                                <td className="px-6 py-4">
                                                    {sureInfo ? (
                                                        <span 
                                                            className="text-[11px] font-black px-2 py-1 rounded-lg"
                                                            style={{ backgroundColor: getKalanColor(sureInfo.diff, sureInfo.total) + "15", color: getKalanColor(sureInfo.diff, sureInfo.total) }}
                                                        >
                                                            {sureInfo.diff} Gün
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        value={task.rapor_durumu}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            try {
                                                                await updateTask(task.id, { rapor_durumu: newStatus });
                                                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, rapor_durumu: newStatus } : t));
                                                                toast.success("Durum güncellendi.");
                                                            } catch { toast.error("Hata oluştu."); }
                                                        }}
                                                        className="bg-transparent text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer p-1 rounded-lg hover:bg-slate-100"
                                                        style={{ color: getDurumColor(task.rapor_durumu) }}
                                                    >
                                                        {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <ActionBtn title="Rapor Başlat" color="#10b981" onClick={() => handleOpenReportSelector(task)}>
                                                            <FileText size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Görevi Düzenle" color="#f59e0b" onClick={() => setEditingTask(task)}>
                                                            <Edit3 size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => setShareTask(task)}>
                                                            <UserPlus size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="İş Adımları" color="#3b82f6" onClick={() => setExpandedRow(isExpanded ? null : task.id)}>
                                                            <ClipboardList size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Sil" color="#ef4444" onClick={() => handleDelete(task.id)}>
                                                            <Trash2 size={16} />
                                                        </ActionBtn>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-muted/30">
                                                    <td colSpan={6} className="px-12 py-6">
                                                        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ALT GÖREVLER / ADIMLAR</h5>
                                                            <div className="space-y-2">
                                                                {(task.steps || []).map((step, idx) => (
                                                                    <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
                                                                        <div className="flex items-center gap-3">
                                                                            <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(task, idx)} className="w-5 h-5 rounded border-border" />
                                                                            <span className={cn("text-sm font-medium", step.done ? "line-through text-slate-400" : "text-slate-700")}>{step.text}</span>
                                                                        </div>
                                                                        <button onClick={() => handleDeleteStep(task, idx)} className="text-rose-400 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"><X size={16} /></button>
                                                                    </div>
                                                                ))}
                                                                <div className="flex gap-3 mt-4">
                                                                    <input
                                                                        placeholder="Yeni adım ekle..."
                                                                        value={newStepText[task.id] || ""}
                                                                        onChange={e => setNewStepText({ ...newStepText, [task.id]: e.target.value })}
                                                                        onKeyDown={e => e.key === 'Enter' && handleAddStep(task)}
                                                                        className="flex-1 h-11 px-4 rounded-xl border border-border bg-card text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                                                    />
                                                                    <Button onClick={() => handleAddStep(task)} className="h-11 px-6 text-[10px] font-black uppercase tracking-widest">EKLE</Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Report Selector Modal */}
            {showReportSelector && (
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowReportSelector(null); }}>
                    <div style={{...modalBoxStyle, maxWidth: "600px"}} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground dark:text-slate-100">BAĞLI RAPORLAR</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{showReportSelector.rapor_kodu}</p>
                            </div>
                            <button onClick={() => setShowReportSelector(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                            {taskAudits.sort((a,b) => (a.report_seq || 0) - (b.report_seq || 0)).map(audit => (
                                <div 
                                    key={audit.id}
                                    onClick={() => navigate(`/audit/${audit.id}/report`)}
                                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-muted/50 dark:bg-slate-900/50 hover:bg-muted dark:hover:bg-slate-800 hover:border-border dark:hover:border-slate-700 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-muted shadow-sm flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-0.5">
                                                    {showReportSelector.rapor_kodu}{audit.report_seq && audit.report_seq > 1 ? `/${audit.report_seq}` : ''}
                                                </p>
                                                <h4 className="font-bold text-muted-foreground dark:text-slate-300 leading-none">{audit.title}</h4>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={() => {
                                const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;
                                setNewAudit({
                                    ...newAudit,
                                    title: `${showReportSelector.rapor_adi} - Ek Rapor`,
                                    location: taskAudits[0]?.location || "Merkez / Yerinde",
                                    report_seq: nextSeq,
                                    template: "Boş Rapor"
                                });
                                setIsNewAuditModalOpen(showReportSelector);
                                setShowReportSelector(null);
                            }}
                            className="w-100 p-4 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <FileText size={18} />
                            YENİ RAPOR EKLE (/{Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1})
                        </button>
                    </div>
                </div>
            )}

            {/* Sablon Modal */}
            {showSablonModal && (
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowSablonModal(null); }}>
                    <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: "1rem" }}>Rapor Şablonu Seçin</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {Object.keys(RAPOR_SABLONLARI).map(s => (
                                <button key={s} onClick={() => handleSablonSec(showSablonModal, s)} style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", cursor: "pointer", textAlign: "left", fontWeight: 600 }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Modal */}
            {editingTask && (
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null); }}>
                    <div style={{...modalBoxStyle, maxWidth: "600px"}} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground dark:text-slate-100">GÖREVİ DÜZENLE</h3>
                                <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mt-1">{editingTask.rapor_kodu}</p>
                            </div>
                            <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label style={labelStyle}>Rapor No</label>
                                    <input 
                                        value={editingTask.rapor_kodu} 
                                        onChange={e => setEditingTask({...editingTask, rapor_kodu: e.target.value})} 
                                        style={inputStyle} 
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Rapor Türü</label>
                                    <select
                                        value={editingTask.rapor_turu}
                                        onChange={e => setEditingTask({ ...editingTask, rapor_turu: e.target.value })}
                                        style={inputStyle}
                                    >
                                        {RAPOR_TURLERI.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Rapor Adı</label>
                                <input 
                                    value={editingTask.rapor_adi} 
                                    onChange={e => setEditingTask({...editingTask, rapor_adi: e.target.value})} 
                                    style={inputStyle} 
                                    placeholder="Rapor adını girin..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label style={labelStyle}>Başlama Tarihi</label>
                                    <input 
                                        type="date"
                                        value={editingTask.baslama_tarihi} 
                                        onChange={e => setEditingTask({...editingTask, baslama_tarihi: e.target.value})} 
                                        style={inputStyle} 
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Süre (Gün)</label>
                                    <input 
                                        type="number"
                                        min={1}
                                        value={editingTask.sure_gun} 
                                        onChange={e => setEditingTask({...editingTask, sure_gun: parseInt(e.target.value) || 0})} 
                                        style={inputStyle} 
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                                <button onClick={() => setEditingTask(null)} className="flex-1 h-12 rounded-xl border border-slate-100 dark:border-slate-800 font-bold text-slate-500 hover:bg-muted dark:hover:bg-slate-800 transition-all text-xs uppercase tracking-widest">
                                    İPTAL
                                </button>
                                <button 
                                    onClick={handleEditSave} 
                                    className="flex-1 h-12 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                                >
                                    DEĞİŞİKLİKLERİ KAYDET
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            <ShareModal 
                isOpen={!!shareTask}
                onClose={() => setShareTask(null)}
                sharedWith={shareTask?.shared_with || []}
                onShare={handleShareUpdate}
                title={`"${shareTask?.rapor_adi}" Paylaşımı`}
            />

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
                    <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: isDark ? '#451a1a' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                <Trash2 size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', fontFamily: 'Outfit, sans-serif' }}>Görevi Sil?</h3>
                                <p style={{ fontSize: '0.875rem', color: isDark ? '#94a3b8' : '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Bu görevi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                                <button 
                                    onClick={() => setDeleteConfirmId(null)}
                                    style={{ flex: 1, padding: '0.85rem', borderRadius: '0.75rem', border: isDark ? "1px solid #334155" : '1px solid #e2e8f0', backgroundColor: 'transparent', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#64748b' }}
                                >
                                    İptal
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    style={{ flex: 1, padding: '0.85rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                                >
                                    Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Yeni Denetim Başlat Modalı (İlk Rapor İçin) */}
            {isNewAuditModalOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewAuditModalOpen(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground tracking-tight">Yeni Rapor Başlat</h3>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Denetim detaylarını onaylayın veya güncelleyin.</p>
                            </div>
                            <button onClick={() => setIsNewAuditModalOpen(null)} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAuditFromTask} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">İşle İlişkili Görev</label>
                                <div className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm font-bold text-muted-foreground flex items-center gap-3 cursor-not-allowed">
                                    <ClipboardList size={18} className="text-primary/40" />
                                    {isNewAuditModalOpen.rapor_adi} ({isNewAuditModalOpen.rapor_kodu})
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Rapor Başlığı</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={newAudit.title}
                                        onChange={(e) => setNewAudit({...newAudit, title: e.target.value})}
                                        placeholder="Rapor başlığını giriniz..."
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Denetim Yeri</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={newAudit.location}
                                        onChange={(e) => setNewAudit({...newAudit, location: e.target.value})}
                                        placeholder="Şehir / Birim..."
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Denetim Tarihi</label>
                                    <input 
                                        type="text" 
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
                                        {Object.keys(RAPOR_SABLONLARI).map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <Button 
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsNewAuditModalOpen(null)}
                                    className="flex-1 h-12 rounded-xl font-bold"
                                >
                                    İptal
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : 'Başlat'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
