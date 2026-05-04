import { User, Bell, Shield, Wand2, Database, LogOut, Loader2, Save, Monitor, FileText, CheckCircle2, Upload, Users, X, Camera, Sun, AlertTriangle, Key, Download, HardDrive, Globe, ShieldAlert, Plus, Search, MoreVertical, Edit2, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { fetchProfile, updateProfile, uploadAvatar as uploadAvatarApi, type Profile } from "../lib/api/profiles";
import { fetchInspectors, addInspector, deleteInspector, updateInspector, uploadAndSyncInspectors, syncInspectorsFromContacts, type Inspector } from "../lib/api/inspectors";
import { cn } from "../lib/utils";
import { exportSystemData, backupToDrive, importSystemData } from "../lib/api/backup";
import { isElectron } from "../lib/firebase";
import { API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";

const GEMINI_MODELS = [
    { value: "gemini-2.0-flash", label: "gemini-2.0-flash (Önerilen)" },
    { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite (Hızlı)" },
    { value: "gemini-2.5-flash-preview-04-17", label: "gemini-2.5-flash (En Yeni)" },
    { value: "gemini-2.5-pro-preview-03-25", label: "gemini-2.5-pro (En Güçlü)" },
];

// --- Gemini API Key Bölümü (Kullanıcı Bazlı) ---
function GeminiKeySection() {
    const [key, setKey] = useState("");
    const [model, setModel] = useState("gemini-2.0-flash");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<"idle" | "connected" | "error">("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [maskedKey, setMaskedKey] = useState("");
    const [hasKey, setHasKey] = useState(false);

    // Açılışta mevcut ayarları çek
    useEffect(() => {
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetchWithTimeout(`${API_URL}/ai/my-settings`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setHasKey(data.has_key);
                    setMaskedKey(data.masked_key || "");
                    if (data.gemini_model) setModel(data.gemini_model);
                }
            } catch {}
        })();
    }, []);

    const handleSave = async () => {
        if (!key.trim()) { toast.error("API anahtarı boş olamaz."); return; }
        setSaving(true);
        try {
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetchWithTimeout(`${API_URL}/ai/set-key`, {
                method: "POST",
                headers,
                body: JSON.stringify({ gemini_api_key: key.trim(), gemini_model: model }),
            });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success("API anahtarınız kaydedildi!");
            setHasKey(true);
            setMaskedKey(key.trim().slice(0, 6) + "****" + key.trim().slice(-4));
            setKey("");
            setStatus("idle");
        } catch (e: any) {
            toast.error(e.message || "Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setStatus("idle");
        setStatusMsg("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetchWithTimeout(`${API_URL}/ai/test-connection`, { headers });
            const data = await res.json();
            if (data.connected) {
                setStatus("connected");
                setStatusMsg("Bağlantı başarılı! Asistan kullanıma hazır.");
            } else {
                setStatus("error");
                setStatusMsg(data.message || "Bağlanamıyor.");
            }
        } catch {
            setStatus("error");
            setStatusMsg("Sunucuya ulaşılamadı.");
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <Key className="text-primary" size={22} />
                <div>
                    <h3 className="font-black text-lg text-slate-900 tracking-tight">Gemini API Anahtarınız</h3>
                    <p className="text-[12px] text-slate-400 font-medium">
                        Her kullanıcı kendi anahtarını kullanır. Maliyet size ait değildir.{" "}
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Buradan ücretsiz al →
                        </a>
                    </p>
                </div>
            </div>

            {/* Mevcut anahtar durumu */}
            {hasKey && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium text-slate-600">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Mevcut anahtar: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{maskedKey}</code></span>
                </div>
            )}

            {/* API Key + Model satırı */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <input
                        type={showKey ? "text" : "password"}
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        placeholder={hasKey ? "Yeni anahtar girin (mevcut değiştirilir)" : "AIzaSy..."}
                        className="w-full h-12 pl-4 pr-12 rounded-2xl border border-slate-200 text-sm font-mono font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-slate-50"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="h-12 px-4 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-slate-50 cursor-pointer"
                >
                    {GEMINI_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>

            {/* Kaydet + Test satırı */}
            <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-2xl shadow-md shadow-primary/20 font-black">
                    {saving
                        ? <><Loader2 size={15} className="animate-spin mr-2" />Kaydediliyor</>  
                        : <><Save size={15} className="mr-2" />Kaydet</>
                    }
                </Button>
                <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 font-black text-sm text-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                    {testing
                        ? <><Loader2 size={14} className="animate-spin" />Test ediliyor...</>
                        : "Bağlantıyı Test Et"
                    }
                </button>
            </div>

            {/* Durum göstergesi */}
            {status !== "idle" && (
                <div className={cn(
                    "flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold border",
                    status === "connected"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-600 border-red-200"
                )}>
                    <div className={cn(
                        "w-3 h-3 rounded-full flex-shrink-0 animate-pulse",
                        status === "connected" ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    {statusMsg}
                </div>
            )}
        </div>
    );
}

export default function Settings() {
    const { user, logout, resetPassword } = useAuth();
    const confirm = useConfirm();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("Profil");
    const [raporOnek, setRaporOnek] = useState(() => localStorage.getItem('raporKoduOnek') || 'S.Y.64');
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [newInspector, setNewInspector] = useState({ name: "", email: "", title: "Müfettiş", extension: "", phone: "", room: "" });
    const [editingInspector, setEditingInspector] = useState<Inspector | null>(null);
    const [inspectorsLoading, setInspectorsLoading] = useState(false);
    const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [driveBackupLoading, setDriveBackupLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [excelLoading, setExcelLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user?.uid) {
            loadProfile(user.uid);
        } else if (user === null) {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === "Müfettiş Listesi") {
            loadInspectors();
        }
    }, [activeTab]);

    // Filtreleme ve Sayfalama Mantığı
    const filteredInspectors = inspectors.filter(ins => 
        (ins.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ins.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ins.title || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredInspectors.length / itemsPerPage);
    const paginatedInspectors = filteredInspectors.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Arama değiştiğinde sayfa 1'e dön
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);


    const handleLocalBackup = async () => {
        try {
            setBackupLoading(true);
            await exportSystemData();
            toast.success("Tüm veriler JSON olarak bilgisayarınıza yedeklendi.");
        } catch (error) {
            toast.error("Yedek oluşturulamadı.");
        } finally {
            setBackupLoading(false);
        }
    };

    const handleDriveBackup = async () => {
        try {
            setDriveBackupLoading(true);
            const result = await backupToDrive();
            if (result.status === "success") {
                toast.success("Bulut yedeklemesi başarılı: Veriler Google Drive'a yüklendi.");
            }
        } catch (error: any) {
            toast.error(error.message || "Drive yedeklemesi başarısız.");
        } finally {
            setDriveBackupLoading(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmed = await confirm({
            title: "Yedek Yükle",
            message: "DİKKAT: Yedek yükleme işlemi mevcut verileri değiştirebilir. Devam etmek istediğinize emin misiniz?",
            confirmText: "Yedeği Yükle",
            variant: "warning"
        });
        
        if (!confirmed) {
            e.target.value = '';
            return;
        }

        try {
            setImportLoading(true);
            await importSystemData(file);
            toast.success("Yedek başarıyla yüklendi! Sistem yenileniyor...");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error: any) {
            toast.error(error.message || "İçe aktarma başarısız.");
        } finally {
            setImportLoading(false);
            e.target.value = '';
        }
    };

    const loadInspectors = async () => {
        try {
            setInspectorsLoading(true);
            try {
                await syncInspectorsFromContacts();
            } catch (syncError) {
                console.warn("Rehberden otomatik müfettiş senkronu atlandı:", syncError);
            }
            const data = await fetchInspectors();
            setInspectors(data);
        } catch (error) {
            console.error("Müfettişler yüklenemedi:", error);
            toast.error("Müfettiş listesi alınamadı.");
        } finally {
            setInspectorsLoading(false);
        }
    };

    const handleAddInspector = async () => {
        if (!newInspector.name || !newInspector.email) {
            toast.error("Lütfen ad ve e-posta alanlarını doldurun.");
            return;
        }
        try {
            const added = await addInspector(newInspector);
            setInspectors(prev => [...prev, added]);
            setNewInspector({ name: "", email: "", title: "Müfettiş", extension: "", phone: "", room: "" });
            toast.success("Müfettiş listeye eklendi.");
        } catch (error) {
            toast.error("Müfettiş eklenemedi.");
        }
    };

    const handleUpdateInspector = async () => {
        if (!editingInspector) return;
        try {
            const updated = await updateInspector(editingInspector.id, editingInspector);
            setInspectors(prev => prev.map(ins => ins.id === updated.id ? updated : ins));
            setEditingInspector(null);
            toast.success("Müfettiş bilgileri güncellendi.");
        } catch (error) {
            toast.error("Müfettiş güncellenemedi.");
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setExcelLoading(true);
            const result = await uploadAndSyncInspectors(file);
            toast.success(result.message || "Müfettiş listesi başarıyla güncellendi.");
            loadInspectors();
        } catch (error: any) {
            console.error("Müfettiş yükleme hatası:", error);
            toast.error(error.message || "Excel yüklenirken bir hata oluştu.");
        } finally {
            setExcelLoading(false);
            e.target.value = '';
        }
    };

    const handleDeleteInspector = async (id: string) => {
        const confirmed = await confirm({
            title: "Müfettişi Sil",
            message: "Bu müfettişi listeden silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            await deleteInspector(id);
            setInspectors(prev => prev.filter(i => i.id !== id));
            toast.success("Müfettiş listeden silindi.");
        } catch (error) {
            toast.error("Müfettiş silinemedi.");
        }
    };

    const handleUpdateRole = async (uid: string, role: 'admin' | 'moderator' | 'user') => {
        try {
            await updateProfile(uid, { role });
            toast.success(`Rol ${role === 'admin' ? 'Yönetici' : role === 'moderator' ? 'Moderatör' : 'Kullanıcı'} olarak güncellendi.`);
            loadInspectors(); // Refresh the list
            setOpenRoleMenu(null);
        } catch (error) {
            toast.error("Rol güncellenirken hata oluştu.");
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;

        try {
            setUploadingAvatar(true);
            const data = await uploadAvatarApi(user.uid, file);
            setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null);
            toast.success("Profil fotoğrafı güncellendi.");
        } catch (error: any) {
            toast.error(error.message || "Fotoğraf yüklenemedi.");
        } finally {
            setUploadingAvatar(false);
            e.target.value = '';
        }
    };

    const loadProfile = async (uid: string) => {
        try {
            setLoading(true);
            const data = await fetchProfile(uid);
            setProfile(data);
            localStorage.setItem(`profile_${uid}`, JSON.stringify(data));
        } catch (error) {
            console.error("Profil yüklenemedi:", error);
            const cached = localStorage.getItem(`profile_${uid}`);
            if (cached) {
                setProfile(JSON.parse(cached));
            } else {
                setProfile({
                    uid: uid,
                    full_name: user?.displayName || "Müfettiş",
                    title: "Müfettiş",
                    institution: "Gençlik ve Spor Bakanlığı",
                    email: user?.email || profile?.email || "",
                    avatar_url: user?.photoURL || null,
                    theme: "light",
                    ai_enabled: true,
                    notifications_enabled: true
                } as any);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!profile?.email) {
            toast.error("Profil e-postası bulunamadı.");
            return;
        }

        try {
            const loadingToast = toast.loading("Şifre sıfırlama e-postası hazırnanıyor...");
            await resetPassword(profile.email);
            toast.dismiss(loadingToast);
            toast.success(`Şifre sıfırlama bağlantısı ${profile.email} adresine gönderildi!`);
        } catch (error: any) {
            toast.error(error.message || "E-posta gönderilemedi.");
        }
    };

    const handleSistemBildirimiAc = async () => {
        if (!user?.uid || !profile) return;
        
        try {
            // Eğer kapalıysa (off -> on)
            if (!profile.notifications_enabled) {
                if (Notification.permission !== 'granted') {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        toast.error("Bildirim izni reddedildi.");
                        return;
                    }
                }
                
                await updateProfile(user.uid, { notifications_enabled: true });
                setProfile(prev => prev ? { ...prev, notifications_enabled: true } : null);
                toast.success("Sistem bildirimleri aktifleştirildi!");
            } else {
                // Eğer açıksa (on -> off)
                await updateProfile(user.uid, { notifications_enabled: false });
                setProfile(prev => prev ? { ...prev, notifications_enabled: false } : null);
                toast.success("Bildirimler devre dışı bırakıldı.");
            }
        } catch (error) {
            toast.error("Bildirim ayarlanırken hata oluştu.");
        }
    };


    const handleSendTestNotification = async () => {
        // Direct IPC bridge to Main Process (Program Notification)
        if (isElectron) {
            try {
                const { ipcRenderer } = (window as any).require('electron');
                ipcRenderer.send('show-notification', {
                    title: "MufYard V-2.0",
                    body: "Sistem bildirim sistemi başarıyla test edildi. (Masaüstü)"
                });
                toast.success("Sistem (IPC) bildirimi tetiklendi!");
            } catch (e) {
                console.error("IPC Notification error:", e);
                new Notification("MufYard V-2.0", {
                    body: "Sistem bildirimleri aktif! (Standard Mod)",
                    icon: "/favicon.svg"
                });
            }
        } else if (Notification.permission === 'granted') {
            // Browser fallback
            new Notification("MufYard V-2.0", {
                body: "Tarayıcı bildirimleri başarıyla test edildi.",
                icon: "/favicon.svg"
            });
            toast.success("Test bildirimi gönderildi!");
        } else {
            toast.error("Bildirim izni alınamadı.");
        }
    };

    const handleSave = async () => {
        if (!user?.uid || !profile) return;
        try {
            setSaving(true);
            const updated = await updateProfile(user.uid, profile);
            setProfile(updated);
            localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updated));
            
            // Tema yansıtma - Sadece Aydınlık (Default) destekleniyor
            document.documentElement.classList.remove('dark', 'theme-navy');

            
            toast.success("Sistem ayarları başarıyla güncellendi.");
        } catch (error) {
            console.error(error);
            // Fallback to local state update on frontend demo if backend not active
            toast.success("Sistem ayarları yerel olarak güncellendi (Sunucu bağlantısı yok).");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground font-semibold italic tracking-tight">Sistem Ayarları Yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-primary font-outfit">Sistem Ayarları</h2>
                    <p className="text-muted-foreground mt-2 font-medium">Hesap bilgilerinizi, uygulama tercihlerini ve güvenlik ayarlarını yönetin.</p>
                </div>
                <Button variant="outline" onClick={logout} className="text-rose-500 border-rose-100 bg-rose-50 hover:bg-rose-100 rounded-xl px-8 h-12 shadow-sm font-semibold">
                    <LogOut size={18} className="mr-2" /> Güvenli Çıkış
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Navigation Sidebar */}
                <div className="md:col-span-3 space-y-2">
                    <SettingsNav icon={User} label="Profil" active={activeTab === "Profil"} onClick={() => setActiveTab("Profil")} />
                    <SettingsNav icon={Monitor} label="Görünüm" active={activeTab === "Görünüm"} onClick={() => setActiveTab("Görünüm")} />
                    <SettingsNav icon={FileText} label="Rapor Ayarları" active={activeTab === "Rapor Ayarları"} onClick={() => setActiveTab("Rapor Ayarları")} />
                    <SettingsNav icon={Wand2} label="Yapay Zeka" active={activeTab === "Yapay Zeka"} onClick={() => setActiveTab("Yapay Zeka")} />
                    <SettingsNav icon={Bell} label="Bildirimler" active={activeTab === "Bildirimler"} onClick={() => setActiveTab("Bildirimler")} />
                    {/* <SettingsNav icon={Wand2} label="Bilgi Bankası (AI)" active={activeTab === "Bilgi Bankası (AI)"} onClick={() => setActiveTab("Bilgi Bankası (AI)")} /> */}
                    <SettingsNav icon={Users} label="Müfettiş Listesi" active={activeTab === "Müfettiş Listesi"} onClick={() => setActiveTab("Müfettiş Listesi")} />
                    <SettingsNav icon={Shield} label="Güvenlik" active={activeTab === "Güvenlik"} onClick={() => setActiveTab("Güvenlik")} />
                    <SettingsNav icon={Database} label="Veri Ayarları" active={activeTab === "Veri Ayarları"} onClick={() => setActiveTab("Veri Ayarları")} />
                </div>

                {/* Content Area */}
                <div className="md:col-span-9 space-y-6">
                    {/* Profil Sekmesi */}
                    {activeTab === "Profil" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white group overflow-hidden">
                            <div className="flex items-center gap-8 border-b border-slate-100 pb-8 relative z-10">
                                <div className="relative">
                                    <div className="w-28 h-28 rounded-full bg-primary/5 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl ring-2 ring-primary/10">
                                        {uploadingAvatar ? (
                                            <Loader2 size={32} className="text-primary animate-spin" />
                                        ) : profile?.avatar_url ? (
                                            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={48} className="text-primary/20" />
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        ref={avatarInputRef}
                                    />
                                    <button 
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={uploadingAvatar}
                                        className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-lg border-4 border-white hover:scale-110 transition-transform disabled:opacity-50"
                                    >
                                        <Camera size={18} />
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black font-outfit text-primary tracking-tight">{profile?.full_name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full">{profile?.title}</span>
                                        <span className="text-sm font-bold text-muted-foreground">{profile?.institution}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 font-medium opacity-70 italic">{profile?.email}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Ad Soyad</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.full_name || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, full_name: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Ünvan</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.title || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, title: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Bağlı Olduğu Kurum</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.institution || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, institution: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Telefon Numarası</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={(profile as any)?.phone || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                                        placeholder="0(5xx)..."
                                    />
                                </div>

                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-50">
                                <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 font-bold">
                                    {saving ? <Loader2 size={20} className="animate-spin mr-3" /> : <Save size={20} className="mr-3" />}
                                    Ayarları Kaydet
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* Görünüm Sekmesi */}
                    {activeTab === "Görünüm" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center gap-3">
                                <Monitor className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Uygulama Teması</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <ThemeOption 
                                    active={true} 
                                    icon={Sun} 
                                    label="Aydınlık" 
                                    desc="Temiz ve canlı çalışma alanı (Sistem Varsayılanı)." 
                                    color="bg-slate-50"
                                    onClick={() => setProfile(prev => prev ? {...prev, theme: "light"} : null)}
                                />
                            </div>
                            <div className="pt-6 flex justify-end">
                                <Button onClick={handleSave} className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 font-bold">
                                    Temayı Uygula
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* Rapor Ayarları */}
                    {activeTab === "Rapor Ayarları" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center gap-3">
                                <FileText className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Kodlama Standartları</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[11px] font-bold text-slate-400 mb-3 block">Varsayılan Rapor Kodu Ön Eki</label>
                                    <div className="flex gap-4">
                                        <input
                                            className="flex-1 p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none"
                                            value={raporOnek}
                                            onChange={(e) => setRaporOnek(e.target.value)}
                                            placeholder="Örn: S.Y.64"
                                        />
                                        <Button
                                            onClick={() => {
                                                localStorage.setItem('raporKoduOnek', raporOnek);
                                                toast.success('Rapor öneki güncellendi.');
                                            }}
                                            className="rounded-xl px-8 h-14 font-bold"
                                        >
                                            Güncelle
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-3 font-medium flex items-center gap-1">
                                        <AlertTriangle size={12} className="text-amber-500" />
                                        Örnek Görünüm: <span className="font-bold text-primary">{raporOnek}/{new Date().getFullYear()}/001</span>
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Bildirimler */}
                    {activeTab === "Bildirimler" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Bildirim Tercihleri</h3>
                                </div>
                                <div 
                                    onClick={() => setProfile(prev => prev ? {...prev, notifications_enabled: !prev.notifications_enabled} : null)}
                                    className={cn(
                                        "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                                        profile?.notifications_enabled ? "bg-emerald-500" : "bg-slate-300"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300",
                                        profile?.notifications_enabled ? "right-1" : "left-1"
                                    )} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <NotificationToggle 
                                    label="Sistem Bildirimleri" 
                                    desc={isElectron ? "Önemli gelişmeleri Windows bildirim merkezi ile bana ilet." : "Uygulama bildirimlerini tarayıcı üzerinden aktif et."} 
                                    active={profile?.notifications_enabled || false} 
                                    onToggle={handleSistemBildirimiAc}
                                />
                                {isElectron && profile?.fcm_token && (
                                    <p className="text-[11px] text-primary font-bold bg-primary/5 p-3 rounded-xl border border-primary/10">
                                        ℹ️ Masaüstü uygulamasındasınız. Bildirimler sistem uyarısı olarak gönderilecektir.
                                    </p>
                                )}
                                {profile?.notifications_enabled && (
                                    <div className="pt-4 border-t border-slate-50">
                                        <Button 
                                            variant="outline" 
                                            onClick={handleSendTestNotification}
                                            className="w-full rounded-2xl h-12 border-primary/20 text-primary font-bold hover:bg-primary/5"
                                        >
                                            Program Bildirimini Test Et
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Güvenlik */}
                    {activeTab === "Güvenlik" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center gap-3">
                                <Shield className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Hesap Güvenliği</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                                    <div className="flex items-center gap-3 text-primary">
                                        <Key size={20} />
                                        <span className="font-bold text-sm tracking-tight text-primary">Şifre İşlemleri</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">Hesap güvenliğiniz için şifrenizi düzenli aralıklarla güncelleyin.</p>
                                    <Button variant="outline" className="w-full rounded-2xl h-12 bg-white font-bold border-slate-200" onClick={handlePasswordReset}>Şifre Değiştir</Button>
                                </div>
                            </div>


                        </Card>
                    )}
                    {/* Yapay Zeka Sekmesi */}
                    {activeTab === "Yapay Zeka" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            {/* Gemini API Key */}
                            <GeminiKeySection />
                            <hr className="border-slate-100" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Wand2 className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary tracking-tight">AI Asistan Ayarları</h3>
                                </div>
                                <div 
                                    onClick={() => setProfile(prev => prev ? {...prev, ai_enabled: !prev.ai_enabled} : null)}
                                    className={cn(
                                        "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                                        profile?.ai_enabled ? "bg-primary" : "bg-slate-300"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300",
                                        profile?.ai_enabled ? "right-1" : "left-1"
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                                    <label className="text-[11px] font-bold text-slate-400 mb-1 block">Zeka Modeli Seçimi</label>
                                    <select 
                                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer"
                                        value={profile?.ai_model || "gemini-2.0-flash"}
                                        onChange={(e) => setProfile(prev => prev ? {...prev, ai_model: e.target.value} : null)}
                                    >
                                        {GEMINI_MODELS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 font-medium italic">Sohbet, rapor analizleri ve otomatik işlemler bu model üzerinden yapılır.</p>
                                </div>

                                <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1 block">Yaratıcılık Düzeyi</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1"
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary" 
                                        value={profile?.ai_temperature || 0.7}
                                        onChange={(e) => setProfile(prev => prev ? {...prev, ai_temperature: parseFloat(e.target.value)} : null)}
                                    />
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                        <span>Kesin (Teknik)</span>
                                        <span>Dengeli</span>
                                        <span>Yaratıcı</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                                <label className="text-[11px] font-bold text-primary mb-3 block">Özel Sistem Komutu (System Prompt)</label>
                                <textarea 
                                    className="w-full p-4 bg-white border border-primary/10 rounded-2xl text-sm font-medium min-h-[120px] focus:ring-4 focus:ring-primary/10 outline-none resize-none"
                                    placeholder="AI nasıl davranmalı? Örn: 'Sen bir GSB Müfettişisin. Rapor yazarken resmi bir dil kullan ve spor mevzuatına atıfta bulun.'"
                                    value={profile?.ai_system_prompt || ""}
                                    onChange={(e) => setProfile(prev => prev ? {...prev, ai_system_prompt: e.target.value} : null)}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSave} className="h-14 px-10 rounded-2xl font-black shadow-lg shadow-primary/10">Komutları Güncelle</Button>
                            </div>
                        </Card>
                    )}

                    {/* Veri Ayarları */}
                    {activeTab === "Veri Ayarları" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center gap-3">
                                <Database className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Veri Yönetimi ve Yedekleme</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Dışa Aktar / Yerel Yedek */}
                                <div className="p-8 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-white rounded-2xl shadow-sm text-blue-600 relative z-10 transition-transform group-hover:scale-110">
                                        <Download size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-blue-900">Yerel Yedekleme</p>
                                        <p className="text-[10px] text-blue-700 font-bold mt-2 leading-relaxed">Sistemdeki tüm denetim ve rehber verilerini JSON formatında bilgisayarınıza indirin.</p>
                                    </div>
                                    <Button 
                                        onClick={handleLocalBackup}
                                        disabled={backupLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 font-bold shadow-xl shadow-blue-200 mt-auto relative z-10"
                                    >
                                        {backupLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Download className="mr-2" size={20} />}
                                        ŞİMDİ İNDİR
                                    </Button>
                                    <Database className="absolute -right-4 -bottom-4 text-blue-100/50" size={100} />
                                </div>

                                {/* Drive Yedekleme */}
                                <div className="p-8 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-600 relative z-10 transition-transform group-hover:scale-110">
                                        <Upload size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-emerald-900">Bulut Yedekleme (Drive)</p>
                                        <p className="text-[10px] text-emerald-700 font-bold mt-2 leading-relaxed">Verilerinizi güvenli bir şekilde Google Drive hesabınıza senkronize edin.</p>
                                    </div>
                                    <Button 
                                        onClick={handleDriveBackup}
                                        disabled={driveBackupLoading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-2xl h-14 font-bold shadow-xl shadow-emerald-200 mt-auto relative z-10"
                                    >
                                        {driveBackupLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <HardDrive className="mr-2" size={20} />}
                                        DRIVE'A GÖNDER
                                    </Button>
                                    <Globe className="absolute -right-4 -bottom-4 text-emerald-100/50" size={100} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* İçe Aktar / Yedek Yükle */}
                                <div className="p-8 bg-indigo-50 rounded-3xl border border-indigo-100 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600 relative z-10 transition-transform group-hover:scale-110">
                                        <Upload size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-indigo-900">Yedek Yükle (Restore)</p>
                                        <p className="text-[10px] text-indigo-700 font-bold mt-2 leading-relaxed">Bilgisayarınızdaki JSON yedek dosyasını seçerek tüm verileri geri yükleyin.</p>
                                    </div>
                                    <input 
                                        type="file" 
                                        id="backup-upload" 
                                        className="hidden" 
                                        accept=".json" 
                                        onChange={handleImport}
                                    />
                                    <Button 
                                        onClick={() => document.getElementById('backup-upload')?.click()}
                                        disabled={importLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl h-14 font-bold shadow-xl shadow-indigo-200 mt-auto relative z-10"
                                    >
                                        {importLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Upload className="mr-2" size={20} />}
                                        DOSYA SEÇ VE YÜKLE
                                    </Button>
                                    <CheckCircle2 className="absolute -right-4 -bottom-4 text-indigo-100/50" size={100} />
                                </div>

                                {/* Bilgi Notu */}
                                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-center gap-4 relative overflow-hidden">
                                     <div className="relative z-10 space-y-3">
                                        <div className="flex items-center gap-2 text-slate-800">
                                            <Shield size={18} className="text-primary" />
                                            <p className="font-bold text-xs uppercase tracking-wider">Güvenlik Notu</p>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                                            Yedek yükleme işlemi "Merge" mantığıyla çalışır. Mevcut verileriniz silinmez, yedek dosyasındaki verilerle güncellenir veya yeni kayıtlar eklenir.
                                        </p>
                                        <ul className="text-[9px] text-slate-400 font-bold space-y-1">
                                            <li>• JSON formatındaki resmi yedek dosyalarını kullanın.</li>
                                            <li>• İşlem sonrası sistem otomatik yenilenecektir.</li>
                                        </ul>
                                     </div>
                                </div>
                            </div>

                            {/* Kritik İşlemler */}
                            <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl text-rose-500 shadow-sm border border-rose-50">
                                        <ShieldAlert size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800">Verileri Sıfırla</h4>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-1">Bu işlem tüm geçmiş verileri kalıcı olarak silecektir. Geri dönüşü yoktur.</p>
                                    </div>
                                </div>
                                    <Button 
                                    variant="outline" 
                                    className="border-rose-100 text-rose-500 hover:bg-rose-50 rounded-2xl h-12 px-8 font-bold text-[11px]"
                                    onClick={async () => {
                                        const confirmed = await confirm({

                                            title: "Tüm Verileri Sil",
                                            message: "DİKKAT: Tüm verileriniz kalıcı olarak silinecek. Emin misiniz?",
                                            confirmText: "Kalıcı Olarak Sil",
                                            variant: "danger"
                                        });
                                        if (confirmed) {

                                            toast.error("Güvenlik protokolü gereği bu işlem şimdilik devre dışıdır.");
                                        }
                                    }}
                                >
                                    Sistemi Temizle
                                </Button>
                            </div>
                        </Card>
                    )}

                    {/* Müfettiş Listesi Sekmesi */}
                    {activeTab === "Müfettiş Listesi" && (
                        <Card className="p-10 space-y-8 rounded-3xl border-none shadow-xl bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Users className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Müfettiş Listesi (Ekip Yönetimi)</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        ref={excelInputRef}
                                        className="hidden" 
                                        accept=".xlsx, .xls"
                                        onChange={handleExcelImport}
                                    />
                                    <Button 
                                        variant="outline"
                                        disabled={excelLoading}
                                        onClick={() => excelInputRef.current?.click()}
                                        className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 rounded-xl px-6 h-12 font-bold"
                                    >
                                        {excelLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Upload size={18} className="mr-2" />}
                                        Yeni Liste Ekle (xlsx)
                                    </Button>
                                </div>
                            </div>

                            <p className="text-sm font-medium text-muted-foreground">
                                Görevlerde ekip arkadaşı olarak görevlendirebileceğiniz müfettişlerin listesini buradan yönetebilirsiniz. 
                                Bu listedeki isimler "Görev Oluştur" ekranında seçenek olarak görünecektir.
                            </p>

                            {/* Yeni Müfettiş Ekleme Formu */}
                            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                                <h4 className="text-xs font-bold text-primary">Yeni Müfettiş Ekle</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ad Soyad</label>
                                        <input 
                                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                            placeholder="Sefa YAPRAKLI"
                                            value={newInspector.name}
                                            onChange={(e) => setNewInspector(prev => ({...prev, name: e.target.value}))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">E-Posta</label>
                                        <input 
                                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                            placeholder="sefa@gsb.gov.tr"
                                            value={newInspector.email}
                                            onChange={(e) => setNewInspector(prev => ({...prev, email: e.target.value}))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">İletişim Bilgileri</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                                placeholder="Dahili"
                                                value={newInspector.extension}
                                                onChange={(e) => setNewInspector(prev => ({...prev, extension: e.target.value}))}
                                            />
                                            <input 
                                                className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                                placeholder="Cep No"
                                                value={newInspector.phone}
                                                onChange={(e) => setNewInspector(prev => ({...prev, phone: e.target.value}))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">Oda No</label>
                                        <input 
                                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                            placeholder="402"
                                            value={newInspector.room}
                                            onChange={(e) => setNewInspector(prev => ({...prev, room: e.target.value}))}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button onClick={handleAddInspector} className="h-14 w-full rounded-2xl font-bold">
                                            <Plus size={20} className="mr-2" /> Listeye Ekle
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Müfettiş Listesi */}
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h4 className="text-xs font-bold text-slate-400 ml-1">Kayıtlı Müfettişler</h4>
                                    
                                    {/* Arama Çubuğu */}
                                    <div className="relative group w-full md:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <input 
                                            type="text"
                                            placeholder="İsim veya e-posta ile ara..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                {inspectorsLoading ? (
                                    <div className="flex flex-col items-center py-10">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                        <p className="mt-4 text-xs font-bold text-muted-foreground">Listeleniyor...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {paginatedInspectors.map((ins) => (
                                            <div key={ins.id} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-primary/20 hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black">
                                                        {ins.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-700">{ins.name}</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <p className="text-xs text-muted-foreground font-medium">{ins.email}</p>
                                                            {ins.extension && (
                                                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">D: {ins.extension}</span>
                                                            )}
                                                            {ins.phone && (
                                                                <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded font-bold text-emerald-600">Cep: {ins.phone}</span>
                                                            )}
                                                            {ins.room && (
                                                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">Oda: {ins.room}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setOpenRoleMenu(openRoleMenu === ins.id ? null : ins.id)}
                                                            className="p-3 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                        >
                                                            <MoreVertical size={18} />
                                                        </button>
                                                        {openRoleMenu === ins.id && (
                                                            <div className="absolute right-0 top-12 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in duration-200">
                                                                <button onClick={() => { setEditingInspector(ins); setOpenRoleMenu(null); }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-slate-50 transition-colors text-primary flex items-center gap-2">
                                                                    <Edit2 size={14} /> Bilgileri Düzenle
                                                                </button>
                                                                <div className="h-[1px] bg-slate-50 my-1" />
                                                                <button onClick={() => handleUpdateRole(ins.id, 'admin')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-slate-50 transition-colors text-slate-700">Yönetici Yap</button>
                                                                <button onClick={() => handleUpdateRole(ins.id, 'moderator')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-slate-50 transition-colors text-slate-700">Moderatör Yap</button>
                                                                <button onClick={() => handleUpdateRole(ins.id, 'user')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-slate-50 transition-colors text-slate-700">Yetkisini Kaldır</button>
                                                                <div className="h-[1px] bg-slate-50 my-1" />
                                                                <button onClick={() => handleDeleteInspector(ins.id)} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-rose-50 transition-colors text-rose-500">Listeden Sil</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {filteredInspectors.length === 0 && (
                                            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                                                <p className="text-xs font-medium text-slate-400">
                                                    {searchTerm ? "Aranan kriterde müfettiş bulunamadı." : "Henüz hiç müfettiş eklenmemiş."}
                                                </p>
                                            </div>
                                        )}

                                        {/* Sayfalama Kontrolleri */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                                                <p className="text-[11px] font-bold text-slate-400">
                                                    Toplam {filteredInspectors.length} kayıttan {(currentPage-1)*itemsPerPage+1}-{Math.min(currentPage*itemsPerPage, filteredInspectors.length)} arası gösteriliyor
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        disabled={currentPage === 1}
                                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                        className="w-10 h-10 p-0 rounded-xl border-slate-100"
                                                    >
                                                        <ChevronLeft size={18} />
                                                     </Button>
                                                     
                                                     <div className="flex items-center gap-1 px-2">
                                                         {[...Array(totalPages)].map((_, i) => (
                                                             <button
                                                                 key={i}
                                                                 onClick={() => setCurrentPage(i + 1)}
                                                                 className={cn(
                                                                     "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                                                     currentPage === i + 1 
                                                                         ? "bg-primary text-white shadow-lg shadow-primary/20" 
                                                                         : "text-slate-400 hover:bg-slate-50"
                                                                 )}
                                                             >
                                                                 {i + 1}
                                                             </button>
                                                         ))}
                                                     </div>

                                                     <Button 
                                                         variant="outline" 
                                                         disabled={currentPage === totalPages}
                                                         onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                         className="w-10 h-10 p-0 rounded-xl border-slate-100"
                                                     >
                                                         <ChevronRight size={18} />
                                                     </Button>
                                                 </div>
                                             </div>
                                         )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div> {/* md:col-span-9 content area ends */}
            </div> {/* grid-cols-12 ends */}
            
            {/* Müfettiş Düzenleme Modalı */}
            {editingInspector && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <Card className="w-full max-w-2xl p-10 space-y-8 rounded-[40px] shadow-2xl bg-white border-none animate-in zoom-in duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <Edit2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-xl font-outfit text-primary tracking-tight">Müfettiş Bilgilerini Güncelle</h3>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">{editingInspector.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingInspector(null)} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">Ad Soyad</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                    value={editingInspector.name}
                                    onChange={(e) => setEditingInspector({...editingInspector, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">E-Posta</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                    value={editingInspector.email}
                                    onChange={(e) => setEditingInspector({...editingInspector, email: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">Ünvan</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none"
                                    value={editingInspector.title}
                                    onChange={(e) => setEditingInspector({...editingInspector, title: e.target.value})}
                                >
                                    <option>Başmüfettiş</option>
                                    <option>Müfettiş</option>
                                    <option>Müfettiş Yardımcısı</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">Cep Telefonu</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                    value={editingInspector.phone || ""}
                                    onChange={(e) => setEditingInspector({...editingInspector, phone: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">Dahili No</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                    value={editingInspector.extension || ""}
                                    onChange={(e) => setEditingInspector({...editingInspector, extension: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 ml-1">Oda No</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none" 
                                    value={editingInspector.room || ""}
                                    onChange={(e) => setEditingInspector({...editingInspector, room: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button onClick={() => setEditingInspector(null)} variant="outline" className="flex-1 h-16 rounded-2xl font-bold border-slate-100">
                                Vazgeç
                            </Button>
                            <Button onClick={handleUpdateInspector} className="flex-[2] h-16 rounded-2xl font-bold shadow-xl shadow-primary/20">
                                Değişiklikleri Kaydet
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

function SettingsNav({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm",
                active 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 translate-x-2" 
                    : "text-slate-500 hover:bg-white hover:text-primary hover:translate-x-1"
            )}
        >
            <Icon size={20} />
            <span className="font-outfit font-bold text-[12px]">{label}</span>
        </button>
    );
}

function ThemeOption({ active, label, desc, onClick, icon: Icon, color }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "p-6 rounded-3xl border-4 transition-all flex flex-col items-center text-center gap-3 relative overflow-hidden group",
                active ? "border-primary bg-primary/5 shadow-xl scale-105" : "border-slate-50 bg-slate-50 hover:border-primary/20"
            )}
        >
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform", color, active ? "text-white" : "text-slate-400")}>
                <Icon size={32} />
            </div>
            <div>
                <p className={cn("text-sm font-black tracking-tight", active ? "text-primary" : "text-slate-600")}>{label}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">{desc}</p>
            </div>
            {active && <CheckCircle2 size={16} className="absolute top-4 right-4 text-primary" />}
        </button>
    );
}

function NotificationToggle({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) {
    return (
        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shadow-sm", active ? "bg-emerald-50 text-emerald-600" : "bg-white text-slate-300")}>
                    {active ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                </div>
                <div>
                    <p className="font-bold text-sm text-slate-700 tracking-tight">{label}</p>
                    <p className="text-xs text-slate-400 font-medium">{desc}</p>
                </div>
            </div>
            <div 
                onClick={onToggle}
                className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300", active ? "bg-emerald-500" : "bg-slate-300")}
            >
                <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300", active ? "right-1" : "left-1")} />
            </div>
        </div>
    );
}
