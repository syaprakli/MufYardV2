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
    const tdStyle: React.CSSProperties = { padding: "1.2rem 1rem", fontSize: "13px", verticalAlign: "middle" };
    const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" };
    const modalBoxStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "1.5rem", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: "550px", padding: "2rem" };

    const [tasks, setTasks] = useState<Task[]>([]);
    const { user } = useAuth();
    const currentUser = user || JSON.parse(localStorage.getItem('demo_user') || '{"email": "mufettis@gsb.gov.tr", "uid": "mufettis@gsb.gov.tr"}');
    const effectiveUid = currentUser.uid;

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
                owner_id: currentUser.uid,
                assigned_to: form.assigned_to.length > 0 ? form.assigned_to : [currentUser.uid]
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
            await acceptTask(taskId, effectiveUid);
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
            const allAudits = await fetchAudits(effectiveUid, currentUser.email);
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
            const existingAudits = await fetchAudits(effectiveUid, currentUser.email);
            const taskAudits = existingAudits.filter(a => String(a.task_id).trim() === String(taskId).trim());
            const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;

            const auditPayload: any = {
                task_id: taskId,
                title: taskAudits.length === 0 ? task.rapor_adi : `${task.rapor_adi} - Ek Rapor`,
                location: "Merkez / Yerinde",
                date: new Date().toLocaleDateString("tr-TR"),
                status: "Rapor Yazılıyor",
                inspector: currentUser.email?.split('@')[0] || "Müfettiş",
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 tracking-widest">GÖREVLER</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        Görevler
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-2">
                        <Calendar size={14} className="text-primary/40" />
                        {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                    </p>
                </div>

                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl">
                    <button 
                        onClick={() => setActiveTab("kisisel")}
                        className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all tracking-widest ${activeTab === 'kisisel' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground dark:hover:text-slate-300'}`}
                    >
                        Özel Kayıtlarım
                    </button>
                    <button 
                        onClick={() => setActiveTab("ortak")}
                        className={`px-6 py-2.5 rounded-lg font-bold text-xs transition-all tracking-widest ${activeTab === 'ortak' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-muted-foreground dark:hover:text-slate-300'}`}
                    >
                        Kurumsal Arşiv
                    </button>
                </div>
            </div>

            {/* Görev Oluşturma Formu */}
            {activeTab === 'kisisel' && (
                <div style={{ background: "var(--card)", borderRadius: "1.5rem", boxShadow: "var(--shadow)", padding: "2rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                            <div>
                                <label style={labelStyle}>Rapor No</label>
                                <input
                                    placeholder={autoKodu}
                                    value={form.rapor_kodu}
                                    onChange={e => setForm({ ...form, rapor_kodu: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Rapor Adı</label>
                                <input
                                    required
                                    placeholder="Örn: X Belediyesi İncelemesi"
                                    value={form.rapor_adi}
                                    onChange={e => setForm({ ...form, rapor_adi: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Rapor Türü</label>
                                <select
                                    value={form.rapor_turu}
                                    onChange={e => setForm({ ...form, rapor_turu: e.target.value })}
                                    style={inputStyle}
                                >
                                    {RAPOR_TURLERI.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: "1rem", alignItems: "end" }}>
                            <div>
                                <label style={labelStyle}>Başlama Tarihi</label>
                                <input
                                    type="date"
                                    value={form.baslama_tarihi}
                                    onChange={e => setForm({ ...form, baslama_tarihi: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Süre (Gün)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.sure_gun}
                                    onChange={e => setForm({ ...form, sure_gun: parseInt(e.target.value) || 30 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div ref={inspectorDropdownRef} style={{ position: "relative" }}>
                                <label style={labelStyle}>Görevde Yer Alan Kişiler</label>
                                {/* Trigger Box */}
                                <div
                                    onClick={() => setShowInspectorDropdown(p => !p)}
                                    style={{
                                        ...inputStyle,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        cursor: "pointer",
                                        userSelect: "none",
                                        minHeight: "42px",
                                        flexWrap: "wrap",
                                        gap: "0.3rem",
                                        borderColor: showInspectorDropdown ? (isDark ? "#3b82f6" : "#0f172a") : (isDark ? "#1e293b" : "#e2e8f0"),
                                        boxShadow: showInspectorDropdown ? (isDark ? "0 0 0 3px rgba(59,130,246,0.1)" : "0 0 0 3px rgba(15,23,42,0.08)") : "none"
                                    }}
                                >
                                    {form.assigned_to.length === 0 ? (
                                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Kişi seç veya ara...</span>
                                    ) : (
                                        form.assigned_to.map(id => {
                                            const ins = inspectors.find(i => i.email === id);
                                            return ins ? (
                                                <span key={id} style={{
                                                    display: "inline-flex", alignItems: "center", gap: "0.3rem",
                                                    background: "#0f172a", color: "white", borderRadius: "1rem",
                                                    padding: "0.15rem 0.6rem", fontSize: "0.72rem", fontWeight: 700
                                                }}>
                                                    {ins.name}
                                                    <span
                                                        onClick={e => { e.stopPropagation(); toggleInspector(id); }}
                                                        style={{ cursor: "pointer", opacity: 0.6, fontWeight: 900, marginLeft: "0.1rem" }}
                                                    >×</span>
                                                </span>
                                            ) : null;
                                        })
                                    )}
                                    <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: "0.75rem", flexShrink: 0 }}>
                                        {showInspectorDropdown ? "▲" : "▼"}
                                    </span>
                                </div>

                                {/* Dropdown Panel */}
                                {showInspectorDropdown && (
                                    <div style={{
                                        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                                        background: isDark ? "#1e293b" : "white", border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
                                        borderRadius: "1rem", boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
                                        zIndex: 9999, overflow: "hidden"
                                    }}>
                                        {/* Search */}
                                        <div style={{ padding: "0.6rem 0.8rem", borderBottom: "1px solid #f1f5f9" }}>
                                            <input
                                                autoFocus
                                                placeholder="İsim ara..."
                                                value={inspectorSearch}
                                                onChange={e => setInspectorSearch(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ ...inputStyle, padding: "0.4rem 0.7rem", fontSize: "0.8rem", border: "1px solid #e2e8f0" }}
                                            />
                                        </div>
                                        {/* List */}
                                        <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                                            {inspectors
                                                .filter(ins => ins.name.toLowerCase().includes(inspectorSearch.toLowerCase()) || ins.email.toLowerCase().includes(inspectorSearch.toLowerCase()))
                                                .map(inspector => {
                                                    const isSelected = form.assigned_to.includes(inspector.email);
                                                    return (
                                                        <div
                                                            key={inspector.id}
                                                            onClick={() => toggleInspector(inspector.email)}
                                                            style={{
                                                                display: "flex", alignItems: "center", gap: "0.75rem",
                                                                padding: "0.65rem 1rem",
                                                                cursor: "pointer",
                                                                background: isSelected ? (isDark ? "#334155" : "#f0f9ff") : (isDark ? "#1e293b" : "white"),
                                                                borderBottom: isDark ? "1px solid #334155" : "1px solid #f8fafc",
                                                                transition: "background 0.15s"
                                                            }}
                                                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = isDark ? "#334155" : "#f8fafc"; }}
                                                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = isDark ? "#1e293b" : "white"; }}
                                                        >
                                                            <div style={{
                                                                width: "18px", height: "18px", borderRadius: "5px", flexShrink: 0,
                                                                border: isSelected ? "none" : (isDark ? "1.5px solid #475569" : "1.5px solid #cbd5e1"),
                                                                background: isSelected ? (isDark ? "#3b82f6" : "#0f172a") : (isDark ? "#0f172a" : "white"),
                                                                display: "flex", alignItems: "center", justifyContent: "center"
                                                            }}>
                                                                {isSelected && <span style={{ color: "white", fontSize: "11px", fontWeight: 900 }}>✓</span>}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: isDark ? "#f1f5f9" : "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inspector.name}</div>
                                                                <div style={{ fontSize: "0.68rem", color: isDark ? "#94a3b8" : "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inspector.email}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                            {inspectors.filter(ins => ins.name.toLowerCase().includes(inspectorSearch.toLowerCase())).length === 0 && (
                                                <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                                                    Sonuç bulunamadı.
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer */}
                                        <div style={{ padding: "0.5rem 1rem", background: isDark ? "#0f172a" : "#f8fafc", borderTop: isDark ? "1px solid #334155" : "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "0.72rem", color: isDark ? "#94a3b8" : "#64748b", fontWeight: 700 }}>{form.assigned_to.length} kişi seçildi</span>
                                            <button type="button" onClick={() => setShowInspectorDropdown(false)} style={{ fontSize: "0.72rem", fontWeight: 700, color: isDark ? "#3b82f6" : "#0f172a", background: "none", border: "none", cursor: "pointer" }}>Tamam</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rapor Oluştur — tam genişlik alt buton */}
                        <div style={{ marginTop: "1.25rem", borderTop: "1px solid #f1f5f9", paddingTop: "1.25rem" }}>
                            <button
                                type="submit"
                                disabled={saving}
                                style={{
                                    width: "100%", padding: "0.9rem", borderRadius: "0.625rem",
                                    background: isDark ? "linear-gradient(135deg, #3b82f6 0%, #1e3a5f 100%)" : "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
                                    color: "white", fontWeight: 700, fontSize: "1rem",
                                    border: "none", cursor: saving ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
                                    height: "48px", opacity: saving ? 0.7 : 1,
                                    letterSpacing: "0.03em", boxShadow: isDark ? "0 4px 16px rgba(59,130,246,0.2)" : "0 4px 16px rgba(15,23,42,0.3)"
                                }}
                            >
                                {saving ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
                                {saving ? "Oluşturuluyor..." : "Rapor Oluştur"}
                            </button>
                        </div>
                    </form>
                </div>
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

            {/* Görevler Tablosu */}
            <div style={{ background: isDark ? "#1e293b" : "white", borderRadius: "1rem", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: isDark ? "1px solid #334155" : "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 1.75rem", borderBottom: isDark ? "1px solid #334155" : "1px solid #f1f5f9" }}>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: isDark ? "#f1f5f9" : "#0f172a", letterSpacing: "-0.02em" }}>Görev Listesi</h3>
                    <div style={{ position: "relative" }}>
                        <Search style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", opacity: 0.6 }} size={16} />
                        <input
                            placeholder="Dosya no veya görev adı ile ara..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: "2.75rem", width: "280px", height: "42px", fontSize: "12px", fontWeight: 600 }}
                        />
                    </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc/50" }}>
                                {["Rapor No", "Görev Adı", "Tür", "Kalan", "Durum", "İşlemler"].map(col => (
                                    <th key={col} style={{ padding: "1.2rem 1rem", textAlign: "left", fontSize: "0.68rem", fontWeight: 900, color: isDark ? "#94a3b8" : "#64748b", letterSpacing: "0.15em", borderBottom: isDark ? "1px solid #334155" : "1px solid #e2e8f0", textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem" }}>
                                        <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto", color: "#0f172a" }} />
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Kayıt bulunamadı.</td>
                                </tr>
                            ) : (
                                filtered.map(task => {
                                    const isExpanded = expandedRow === task.id;
                                    const sureInfo = getSureInfo(task);
                                    return (
                                        <React.Fragment key={task.id}>
                                            <tr style={{ borderBottom: isDark ? "1px solid #334155" : "1px solid #f1f5f9", background: isExpanded ? (isDark ? "#334155" : "#f8fafc") : "transparent" }} className="hover:bg-muted dark:hover:bg-slate-800/50 transition-colors">
                                                <td style={tdStyle}><span style={{ fontWeight: 900, color: isDark ? "#60a5fa" : "#3b82f6", fontSize: "11px", letterSpacing: "0.02em", fontFamily: "'Outfit', sans-serif" }}>{task.rapor_kodu}</span></td>
                                                <td style={tdStyle}><span style={{ fontWeight: 700, color: isDark ? "#f1f5f9" : "#1e293b", fontSize: "13px", fontFamily: "'Inter', sans-serif" }}>{task.rapor_adi}</span></td>
                                                <td style={tdStyle}><span style={{ fontWeight: 700, color: isDark ? "#94a3b8" : "#64748b", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{task.rapor_turu}</span></td>
                                                <td style={tdStyle}>
                                                    {sureInfo ? (
                                                        <span style={{ 
                                                            fontSize: "0.75rem", 
                                                            padding: "0.25rem 0.5rem", 
                                                            borderRadius: "0.5rem", 
                                                            backgroundColor: getKalanColor(sureInfo.diff, sureInfo.total) + "15", 
                                                            color: getKalanColor(sureInfo.diff, sureInfo.total), 
                                                            fontWeight: 700 
                                                        }}>
                                                            {sureInfo.diff} Gün
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td style={tdStyle}>
                                                    <select
                                                        value={task.rapor_durumu}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            try {
                                                                await updateTask(task.id, { rapor_durumu: newStatus });
                                                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, rapor_durumu: newStatus } : t));
                                                                toast.success("Durum güncellendi");
                                                            } catch {
                                                                toast.error("Güncellenemedi");
                                                            }
                                                        }}
                                                        style={{
                                                            fontSize: "0.68rem",
                                                            padding: "0.3rem 0.8rem",
                                                            borderRadius: "0.5rem",
                                                            backgroundColor: getDurumColor(task.rapor_durumu) + "15",
                                                            color: getDurumColor(task.rapor_durumu),
                                                            fontWeight: 900,
                                                            border: `1px solid ${getDurumColor(task.rapor_durumu)}30`,
                                                            outline: "none",
                                                            cursor: "pointer",
                                                            letterSpacing: "0.02em",
                                                            appearance: "none",
                                                            textAlign: "center",
                                                            minWidth: "130px"
                                                        }}
                                                    >
                                                        {RAPOR_DURUMLARI.map(s => <option key={s} value={s} style={{ color: isDark ? "#f1f5f9" : "#0f172a", background: isDark ? "#1e293b" : "white" }}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td style={tdStyle}>
                                                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                                        <ActionBtn title="Raporu Yaz" color="#10b981" onClick={() => handleOpenReportSelector(task)}>
                                                            <FileText size={14} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Paylaş" color="#a855f7" onClick={() => setShareTask(task)}>
                                                            <UserPlus size={14} />
                                                        </ActionBtn>
                                                        <ActionBtn title="İş Adımları" color="#3b82f6" onClick={() => setExpandedRow(isExpanded ? null : task.id)}>
                                                            <ClipboardList size={14} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Görevi Düzenle" color="#f59e0b" onClick={() => setEditingTask(task)}>
                                                            <Edit3 size={14} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Sil" color="#ef4444" onClick={() => handleDelete(task.id)}>
                                                            <Trash2 size={14} />
                                                        </ActionBtn>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr style={{ backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
                                                    <td colSpan={6} style={{ padding: "1rem 1.5rem" }}>
                                                        <div style={{ backgroundColor: isDark ? "#1e293b" : "white", padding: "1.25rem", borderRadius: "1rem", border: isDark ? "1px solid #334155" : "1px solid #e2e8f0" }}>
                                                            <p style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>İŞ ADIMLARI</p>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                                                {(task.steps || []).map((step, idx) => (
                                                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                                        <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(task, idx)} />
                                                                        <span style={{ flex: 1, fontSize: "0.85rem", textDecoration: step.done ? "line-through" : "none" }}>{step.text}</span>
                                                                        <X size={14} style={{ cursor: "pointer", color: "#94a3b8" }} onClick={() => handleDeleteStep(task, idx)} />
                                                                    </div>
                                                                ))}
                                                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                                                    <input 
                                                                        placeholder="Yeni adım..." 
                                                                        value={newStepText[task.id] || ""}
                                                                        onChange={e => setNewStepText({...newStepText, [task.id]: e.target.value})}
                                                                        style={{...inputStyle, padding: "0.4rem"}} 
                                                                    />
                                                                    <button onClick={() => handleAddStep(task)} style={{ padding: "0.4rem 1rem", backgroundColor: isDark ? "#3b82f6" : "#0f172a", color: "white", borderRadius: "0.5rem", fontSize: "0.8rem", fontWeight: 700 }}>Ekle</button>
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
            </div>

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
