import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, Search, ChevronLeft, ChevronRight, UserCheck, UserX, Loader2, MoreVertical, ShieldAlert, Shield, Link2, X, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { fetchInspectors, linkInspectorToProfile, type Inspector } from "../lib/api/inspectors";
import { fetchAllProfiles, deleteProfile, type Profile } from "../lib/api/profiles";
import { useConfirm } from "../lib/context/ConfirmContext";
import { cn } from "../lib/utils";
import { API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function AdminInspectors() {
    const { user, profile: userProfile } = useAuth();
    const navigate = useNavigate();

    const FOUNDER_EMAILS = ["sefayaprakli@hotmail.com", "sefa.yaprakli@gsb.gov.tr", "syaprakli@gmail.com"];

    const isFounder = user?.email && FOUNDER_EMAILS.includes(user.email);

    useEffect(() => {
        const isAdmin = userProfile?.role === "admin" || isFounder;
        if (!isAdmin && user) {
            toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            navigate("/");
        }
    }, [isFounder, user, userProfile, navigate]);

    const confirm = useConfirm();
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "registered" | "unregistered" | "external">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
    const [linkModal, setLinkModal] = useState<{ inspectorId: string; inspectorName: string } | null>(null);
    const [linkSearch, setLinkSearch] = useState("");
    const [linking, setLinking] = useState(false);
    const itemsPerPage = 15;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [insp, profs] = await Promise.all([fetchInspectors(), fetchAllProfiles()]);
            setInspectors(insp);
            setProfiles(profs);
        } catch {
            toast.error("Veriler yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const registeredEmails = new Set(profiles.map(p => (p.email || "").toLowerCase().trim()));

    const isRegistered = (ins: Inspector) => {
        if (ins.force_unlinked) return false;
        const uidMatch = !!ins.uid && profiles.some(p => p.uid === ins.uid);
        const emailMatch = !!ins.email && registeredEmails.has(ins.email.toLowerCase().trim());
        return uidMatch || emailMatch;
    };

    const getMatchedProfile = (ins: Inspector): Profile | undefined =>
        profiles.find(p =>
            (ins.uid && p.uid === ins.uid) ||
            (ins.email && p.email?.toLowerCase() === ins.email.toLowerCase())
        );

    const handleUpdateRole = async (profileId: string, role: string) => {
        try {
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            await fetchWithTimeout(`${API_URL}/profiles/${profileId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ role }),
            });
            toast.success("Rol güncellendi.");
            setOpenRoleMenu(null);
            loadData();
        } catch {
            toast.error("Rol güncellenemedi.");
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        const confirmed = await confirm({
            title: "Kullanıcıyı Sil",
            message: "Bu kullanıcıyı sistemden kalıcı olarak silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        try {
            await deleteProfile(profileId);
            toast.success("Kullanıcı silindi.");
            setOpenRoleMenu(null);
            loadData();
        } catch {
            toast.error("Silme başarısız.");
        }
    };

    const handleLink = async (profileUid: string) => {
        if (!linkModal) return;
        setLinking(true);
        try {
            await linkInspectorToProfile(linkModal.inspectorId, profileUid);
            toast.success(`${linkModal.inspectorName} başarıyla eşleştirildi.`);
            setLinkModal(null);
            setLinkSearch("");
            loadData();
        } catch {
            toast.error("Eşleştirme başarısız.");
        } finally {
            setLinking(false);
        }
    };

    const handleUnlink = async (inspectorId: string, inspectorName: string) => {
        try {
            await linkInspectorToProfile(inspectorId, "");
            toast.success(`${inspectorName} eşleştirmesi kaldırıldı.`);
            loadData();
        } catch {
            toast.error("Eşleştirme kaldırılamadı.");
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.full_name || "").toLowerCase().includes(linkSearch.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(linkSearch.toLowerCase())
    );

    // Müfettiş listesi ile kayıtlı olmayan diğer profilleri birleştiriyoruz
    const combinedList = [
        ...inspectors.map(ins => ({ ...ins, type: 'inspector' as const })),
        ...profiles
            .filter(p => !inspectors.some(ins => ins.uid === p.uid || (ins.email && ins.email.toLowerCase() === p.email?.toLowerCase())))
            .map(p => ({
                id: p.uid,
                uid: p.uid,
                name: p.full_name || "İsimsiz Kullanıcı",
                email: p.email,
                type: 'external' as const,
                profile: p
            }))
    ];

    const filtered = combinedList
        .filter(item => {
            const isMatchedInspector = item.type === 'inspector' && isRegistered(item as any);
            const isUnregisteredInspector = item.type === 'inspector' && !isRegistered(item as any);
            const isExternal = item.type === 'external';

            if (filterMode === "registered") return isMatchedInspector;
            if (filterMode === "unregistered") return isUnregisteredInspector;
            if (filterMode === "external") return isExternal;
            return true;
        })
        .filter(item =>
            (item.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.email || "").toLowerCase().includes(searchTerm.toLowerCase())
        );

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const registeredCount = inspectors.filter(isRegistered).length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <button 
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-1 hover:text-primary transition-colors mr-2 group"
                        >
                            <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>Geri</span>
                        </button>
                        <ShieldAlert size={10} className="text-amber-500" />
                        <span>Kurucu Paneli</span>
                    </div>
                    <h1 className="text-2xl font-black text-foreground tracking-tight">Kullanıcı Yönetimi</h1>
                    <p className="text-sm text-slate-400 font-medium mt-1">
                        Sistemde toplam <strong>{profiles.length}</strong> kayıtlı kullanıcı var.
                    </p>
                </div>
                <div className="relative w-full lg:w-72">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="İsim veya e-posta ara..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setFilterMode("all"); setCurrentPage(1); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border", filterMode === "all" ? "bg-primary text-white border-primary shadow-md shadow-primary/20" : "border-border text-slate-400 hover:bg-muted")}>
                    <Users size={14} />
                    Tüm Liste <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md">{combinedList.length}</span>
                </button>
                <button onClick={() => { setFilterMode("registered"); setCurrentPage(1); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border", filterMode === "registered" ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20" : "border-border text-slate-400 hover:bg-muted")}>
                    <UserCheck size={14} />
                    Rehber (Kayıtlı) <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md">{registeredCount}</span>
                </button>
                <button onClick={() => { setFilterMode("unregistered"); setCurrentPage(1); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border", filterMode === "unregistered" ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20" : "border-border text-slate-400 hover:bg-muted")}>
                    <UserX size={14} />
                    Rehber (Kayıtsız) <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md">{inspectors.length - registeredCount}</span>
                </button>
                <button onClick={() => { setFilterMode("external"); setCurrentPage(1); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border", filterMode === "external" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "border-border text-slate-400 hover:bg-muted")}>
                    <Shield size={14} />
                    Dış Kayıtlar <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md">{profiles.length - registeredCount}</span>
                </button>
            </div>

            <Card className="rounded-3xl border-none shadow-xl bg-card">
                {loading ? (
                    <div className="flex flex-col items-center py-20">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-slate-400 mt-4 font-medium">Yükleniyor...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {paginated.map((item) => {
                            const registered = item.type === 'inspector' ? isRegistered(item as any) : true;
                            const profile = item.type === 'inspector' ? getMatchedProfile(item as any) : item.profile;
                            
                            return (
                                <div key={item.id} className={cn("flex items-center justify-between p-5 transition-all group", registered ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/30")}>
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0", registered ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500")}>
                                            {profile?.avatar_url
                                                ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                                : (item.name || "?").charAt(0).toUpperCase()
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className={cn("font-bold text-sm truncate", registered ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300")}>{item.name || "İsimsiz Kullanıcı"}</p>
                                                
                                                {profile?.has_premium_ai && (
                                                    <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1 shadow-sm animate-in zoom-in duration-300">
                                                        <Sparkles size={8} className="fill-current" /> PRO
                                                    </span>
                                                )}
                                                
                                                {item.type === 'inspector' ? (
                                                    registered ? (
                                                        <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap">✓ Rehberde Kayıtlı</span>
                                                    ) : (
                                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap">Rehberde (Kayıtsız)</span>
                                                    )
                                                ) : (
                                                    <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap">Dış Kayıt (Rehber Dışı)</span>
                                                )}
                                                
                                                {profile?.role && profile.role !== "user" && (
                                                    <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                                                        <Shield size={8} /> {profile.role}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                <p className="text-[11px] text-slate-400 font-medium truncate">{item.email || "-"}</p>
                                                {(item as any).title && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-500">{(item as any).title}</span>}
                                                {(item as any).phone && <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded font-bold text-emerald-600">{(item as any).phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-3 shrink-0">
                                        {item.type === 'inspector' ? (
                                            registered ? (
                                                <button onClick={() => handleUnlink(item.id, item.name)} title="Eşleştirmeyi Kaldır" className="p-2 text-emerald-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all">
                                                    <Link2 size={15} />
                                                </button>
                                            ) : (
                                                <button onClick={() => setLinkModal({ inspectorId: item.id, inspectorName: item.name || "" })} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black text-primary border border-primary/30 hover:bg-primary/10 rounded-xl transition-all whitespace-nowrap">
                                                    <Link2 size={12} /> Müfettişle Eşleştir
                                                </button>
                                            )
                                        ) : null}
                                        
                                        {profile && (
                                            <div className="relative">
                                                {!FOUNDER_EMAILS.includes(profile.email || "") && (
                                                    <button onClick={() => setOpenRoleMenu(openRoleMenu === profile.uid ? null : profile.uid)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                )}
                                                {openRoleMenu === profile.uid && (
                                                    <div className="absolute right-0 top-10 w-52 bg-card border border-border rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                                        <div className="px-4 py-2 border-b border-border mb-1 bg-slate-50 dark:bg-slate-900/50">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">YETKİ SEVİYESİ</p>
                                                        </div>
                                                        <button onClick={() => handleUpdateRole(profile.uid, "admin")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-600 transition-colors">Yönetici Yap</button>
                                                        <button onClick={() => handleUpdateRole(profile.uid, "moderator")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 transition-colors">Moderatör Yap</button>
                                                        <button onClick={() => handleUpdateRole(profile.uid, "user")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-muted transition-colors text-slate-600 dark:text-slate-300">Standart Kullanıcı Yap</button>
                                                        
                                                        <div className="px-4 py-2 border-b border-t border-border my-1 bg-slate-50 dark:bg-slate-900/50">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">KULLANIM SÜRESİ</p>
                                                        </div>
                                                        
                                                        <button 
                                                            onClick={async () => {
                                                                try {
                                                                    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                                                                    await fetchWithTimeout(`${API_URL}/profiles/${profile.uid}`, {
                                                                        method: "PATCH",
                                                                        headers,
                                                                        body: JSON.stringify({ 
                                                                            role: "user", 
                                                                            has_premium_ai: false,
                                                                            trial_started: false 
                                                                        }),
                                                                    });
                                                                    toast.success("Kullanıcı tamamen sıfırlandı (Deneme Sürümü).");
                                                                    setOpenRoleMenu(null);
                                                                    loadData();
                                                                } catch {
                                                                    toast.error("İşlem başarısız.");
                                                                }
                                                            }}
                                                            className="w-full text-left px-4 py-2.5 text-[10px] font-black hover:bg-rose-100 text-rose-600 transition-colors"
                                                        >
                                                            SIFIRLA (DENEME SÜRÜMÜ YAP)
                                                        </button>
                                                        
                                                        {profile.has_premium_ai ? (
                                                            <button 
                                                                onClick={async () => {
                                                                    try {
                                                                        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                                                                        await fetchWithTimeout(`${API_URL}/profiles/${profile.uid}`, {
                                                                            method: "PATCH",
                                                                            headers,
                                                                            body: JSON.stringify({ has_premium_ai: false }),
                                                                        });
                                                                        toast.success("PRO üyelik iptal edildi.");
                                                                        setOpenRoleMenu(null);
                                                                        loadData();
                                                                    } catch {
                                                                        toast.error("İşlem başarısız.");
                                                                    }
                                                                }} 
                                                                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-colors"
                                                            >
                                                                PRO Üyeliği İptal Et
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={async () => {
                                                                    try {
                                                                        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                                                                        await fetchWithTimeout(`${API_URL}/profiles/${profile.uid}`, {
                                                                            method: "PATCH",
                                                                            headers,
                                                                            body: JSON.stringify({ has_premium_ai: true, trial_started: true }),
                                                                        });
                                                                        toast.success("Kullanıcı PRO sürüme yükseltildi.");
                                                                        setOpenRoleMenu(null);
                                                                        loadData();
                                                                    } catch {
                                                                        toast.error("İşlem başarısız.");
                                                                    }
                                                                }} 
                                                                className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 transition-colors"
                                                            >
                                                                PRO Sürüme Yükselt
                                                            </button>
                                                        )}

                                                        <div className="h-px bg-border my-1" />
                                                        <button onClick={() => handleDeleteProfile(profile.uid)} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 transition-colors">Sistemden Sil</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="flex flex-col items-center py-20">
                                <Users size={40} className="text-slate-200 mb-4" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    {searchTerm ? "Sonuç bulunamadı" : "Liste boş"}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400">
                        {filtered.length} kayıttan {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} gösteriliyor
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-9 h-9 p-0 rounded-xl">
                            <ChevronLeft size={16} />
                        </Button>
                        {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                            <button key={i} onClick={() => setCurrentPage(i + 1)} className={cn("w-9 h-9 rounded-xl text-xs font-bold transition-all", currentPage === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:bg-muted")}>
                                {i + 1}
                            </button>
                        ))}
                        <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-9 h-9 p-0 rounded-xl">
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>
            )}

            {linkModal && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setLinkModal(null); setLinkSearch(""); }} />
                    <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Kullanıcıyla Eşleştir</p>
                                <p className="font-black text-foreground">{linkModal.inspectorName}</p>
                            </div>
                            <button onClick={() => { setLinkModal(null); setLinkSearch(""); }} className="p-2 hover:bg-muted rounded-xl transition-all">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-border">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input autoFocus type="text" placeholder="Ad veya e-posta ile ara..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-muted border-0 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-border">
                            {filteredProfiles.length === 0 ? (
                                <div className="py-10 text-center">
                                    <p className="text-xs font-medium text-slate-400">Sonuç bulunamadı</p>
                                </div>
                            ) : (
                                filteredProfiles.map(p => (
                                    <button key={p.uid} disabled={linking} onClick={() => handleLink(p.uid)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted transition-all text-left disabled:opacity-50">
                                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0 overflow-hidden">
                                            {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.full_name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-foreground truncate">{p.full_name || "-"}</p>
                                            <p className="text-[11px] text-slate-400 font-medium truncate">{p.email}</p>
                                        </div>
                                        {linking && <Loader2 size={14} className="ml-auto text-primary animate-spin shrink-0" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
