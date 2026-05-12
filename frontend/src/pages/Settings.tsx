import { User, Bell, Shield, Wand2, Database, LogOut, Loader2, Save, FileText, CheckCircle2, Upload, Users, Camera, AlertTriangle, Key, Download, HardDrive, Globe, ShieldAlert, Search, MoreVertical, ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { fetchProfile, updateProfile, fetchAllProfiles, deleteProfile as apiDeleteProfile, uploadAvatar as uploadAvatarApi, type Profile } from "../lib/api/profiles";
import { fetchInspectors, type Inspector } from "../lib/api/inspectors";
import { cn } from "../lib/utils";
import { exportSystemData, backupToDrive, importSystemData } from "../lib/api/backup";
import { isElectron } from "../lib/firebase";
import { API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { motion, AnimatePresence } from "framer-motion";

const GEMINI_MODELS = [
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Mevzuat Uzmanı)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Önerilen - Güncel)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Hızlı ve Ekonomik)" },
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
    const [isPremium, setIsPremium] = useState(false);

    // Açılışta mevcut ayarları çek
    useEffect(() => {
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetchWithTimeout(`${API_URL}/ai/my-settings`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setHasKey(data.has_key);
                    setIsPremium(data.has_premium_ai);
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
                    <div className="flex items-center gap-2">
                        <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight">Gemini API Anahtarınız</h3>
                        {isPremium && (
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-200 dark:border-amber-800/50">
                                Premium AI Aktif
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 font-medium">
                        {isPremium 
                            ? "Kurucu anahtarı kullanıyorsunuz. Kendi anahtarınızı girmenize gerek yoktur." 
                            : "Her kullanıcı kendi anahtarını kullanır. Maliyet size ait değildir."
                        }
                        {!isPremium && (
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1">
                                Buradan ücretsiz al →
                            </a>
                        )}
                    </p>
                </div>
            </div>

            {/* Mevcut anahtar durumu */}
            {hasKey && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <span>Mevcut anahtar: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-mono dark:text-slate-300">{maskedKey}</code></span>
                </div>
            )}

            {/* API Key + Model satırı */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <input
                        type={showKey ? "text" : "password"}
                        value={key}
                        onChange={e => setKey(e.target.value)}
                        placeholder={hasKey ? "Yeni anahtar girin (mevcut değiştirilir)" : "AIzaSy..."}
                        className="w-full h-12 pl-4 pr-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-muted dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-muted dark:bg-slate-800 dark:text-slate-100 cursor-pointer w-full md:w-auto"
                >
                    {GEMINI_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>

            {/* Kaydet + Test satırı */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-2xl shadow-md shadow-primary/20 font-black">
                    {saving
                        ? <><Loader2 size={15} className="animate-spin mr-2" />Kaydediliyor</>  
                        : <><Save size={15} className="mr-2" />Kaydet</>
                    }
                </Button>
                <button
                    onClick={handleTest}
                    disabled={testing}
                    className="flex-1 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-sm text-muted-foreground dark:text-slate-300 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
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
    const { refreshProfile: globalRefreshProfile } = useGlobalData();
    const confirm = useConfirm();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("Profil");
    const [raporOnek, setRaporOnek] = useState(() => localStorage.getItem('raporKoduOnek') || 'S.Y.64');
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [inspectorsLoading, setInspectorsLoading] = useState(false);
    const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
    const [backupLoading, setBackupLoading] = useState(false);
    const [driveBackupLoading, setDriveBackupLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const resolveUrl = (url: string | null) => {
        if (!url) return null;
        if (url.startsWith('data:') || url.startsWith('blob:') || url.includes('dicebear.com') || url.includes('liara.run') || url.includes('unavatar.io') || url.includes('robohash.org') || url.includes('ui-avatars.com') || url.startsWith('/avatars/')) return url;
        let processed = url;
        if (url.includes('localhost:8000') || url.includes('127.0.0.1:8000')) {
            processed = url.split(':8000')[1];
        }
        if (processed.startsWith('http')) return processed;
        
        // Önce Railway'i dene
        const RAILWAY_URL = "https://mufyardv2.up.railway.app";
        return `${RAILWAY_URL}${processed.startsWith('/') ? '' : '/'}${processed}`;
    };

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
            
            // Profiller kritiktir, Rehber (directory) opsiyoneldir
            let profiles: Profile[] = [];
            let directory: Inspector[] = [];
            
            try {
                const profilesData = await fetchAllProfiles();
                profiles = profilesData;
            } catch (err) {
                console.error("Profiller yüklenemedi:", err);
                toast.error("Kullanıcı listesi alınamadı.");
                setInspectorsLoading(false);
                return;
            }
            
            try {
                const directoryData = await fetchInspectors();
                directory = directoryData;
            } catch (err) {
                console.warn("Rehber verisi alınamadı, sadece kayıtlı kullanıcılar gösteriliyor.");
                // Directory hatası kritik değil, devam ediyoruz
            }
            
            // Map profiles to inspector structure and enrich with directory data
            const mapped: Inspector[] = profiles.map(p => {
                const dirEntry = directory.find(d => d.email?.toLowerCase() === p.email?.toLowerCase());
                return {
                    id: p.uid,
                    name: p.full_name,
                    email: p.email,
                    title: p.title || dirEntry?.title || 'Müfettiş',
                    phone: (p as any).phone || dirEntry?.phone || '',
                    extension: (p as any).extension || dirEntry?.extension || '',
                    room: (p as any).room || dirEntry?.room || '',
                    created_at: new Date().toISOString(),
                    is_registered: true
                };
            });
            
            setInspectors(mapped);
        } catch (error) {
            console.error("Genel yükleme hatası:", error);
        } finally {
            setInspectorsLoading(false);
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
            const updatedProfile = (prev: Profile | null) => prev ? { ...prev, avatar_url: data.avatar_url } : null;
            setProfile(updatedProfile);
            
            // Global Context'i tazele (Header vb. yerler için)
            await globalRefreshProfile(user.uid, user.email || undefined);
            
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
            const data = await fetchProfile(uid, user?.email || undefined, user?.displayName || undefined);

            const rawBirthday = String((data as any)?.birthday || "").trim();
            const normalizedBirthday = /^\d{2}-\d{2}$/.test(rawBirthday)
                ? rawBirthday
                : /^\d{4}-\d{2}-\d{2}$/.test(rawBirthday)
                    ? rawBirthday.slice(5, 10)
                    : "";
            const currentYear = String(new Date().getFullYear());
            const birthdayFull = normalizedBirthday ? `${currentYear}-${normalizedBirthday}` : "";

            const hydrated = {
                ...data,
                birthday: normalizedBirthday,
                birthday_full: birthdayFull
            } as any;

            setProfile(hydrated);
            localStorage.setItem(`profile_${uid}`, JSON.stringify(hydrated));
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
                    notifications_enabled: true,
                    birthday: "",
                    birthday_full: ""
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
            const {
                uid: _uid,
                role: _role,
                verified: _verified,
                ...savePayload
            } = profile as any;

            const updated = await updateProfile(user.uid, savePayload);
            setProfile(updated);
            localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updated));
            
            // Tema yansıtma - Sadece Aydınlık (Default) destekleniyor
            document.documentElement.classList.remove('dark', 'theme-navy');

            
            toast.success("Sistem ayarları başarıyla güncellendi.");
        } catch (error: any) {
            console.error("Settings save error:", error);
            const msg = error?.message || "Bilinmeyen hata";
            if (msg.includes("bağlanılamadı") || msg.includes("Failed to fetch") || msg.includes("zaman aşımı")) {
                toast.error(`Sunucuya bağlanılamadı: ${msg}`);
            } else {
                toast.error(`Ayarlar kaydedilemedi: ${msg}`);
            }
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
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-primary dark:text-primary/90 font-outfit">Sistem Ayarları</h2>
                    <p className="text-muted-foreground dark:text-slate-400 mt-2 font-medium">Hesap bilgilerinizi, uygulama tercihlerini ve güvenlik ayarlarını yönetin.</p>
                </div>
                <Button variant="outline" onClick={logout} className="w-full sm:w-auto text-rose-500 border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl px-8 h-12 shadow-sm font-semibold">
                    <LogOut size={18} className="mr-2" /> Güvenli Çıkış
                </Button>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 min-h-0">
                {/* Navigation Sidebar / Mobile Top Nav */}
                <div className="md:col-span-3">
                    <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-hide snap-x">
                        <SettingsNav icon={User} label="Profil" active={activeTab === "Profil"} onClick={() => setActiveTab("Profil")} />
                        <SettingsNav icon={FileText} label="Rapor Ayarları" active={activeTab === "Rapor Ayarları"} onClick={() => setActiveTab("Rapor Ayarları")} />
                        <SettingsNav icon={Wand2} label="Yapay Zeka" active={activeTab === "Yapay Zeka"} onClick={() => setActiveTab("Yapay Zeka")} />
                        <SettingsNav icon={Bell} label="Bildirimler" active={activeTab === "Bildirimler"} onClick={() => setActiveTab("Bildirimler")} />
                        <SettingsNav icon={Shield} label="Güvenlik" active={activeTab === "Güvenlik"} onClick={() => setActiveTab("Güvenlik")} />
                        <SettingsNav icon={Database} label="Veri Ayarları" active={activeTab === "Veri Ayarları"} onClick={() => setActiveTab("Veri Ayarları")} />
                    </div>
                </div>

                {/* Content Area */}
                <div className="md:col-span-9 space-y-6 min-w-0">
                    {/* Profil Sekmesi */}
                    {activeTab === "Profil" && (
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card group">
                            {/* Avatar Seçim Modalı */}
                            <AnimatePresence>
                                {showAvatarModal && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                                        <motion.div 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            onClick={() => setShowAvatarModal(false)}
                                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                                        />
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                            className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
                                        >
                                            <div className="p-8 border-b border-border flex justify-between items-center bg-muted/30">
                                                <div>
                                                    <h3 className="text-xl font-black font-outfit text-primary tracking-tight">Business Avatar Kütüphanesi</h3>
                                                    <p className="text-xs text-muted-foreground font-medium mt-1">Sektörel kimliğinize uygun 20 farklı seçenek</p>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => setShowAvatarModal(false)} className="rounded-full">
                                                    <X size={20} />
                                                </Button>
                                            </div>

                                            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-4">
                                                        {/* Mega Koleksiyon (Sadece En Son Attığın 57 Adet) */}
                                                        {Array.from({ length: 57 }).map((_, i) => {
                                                            const avatarPath = `/avatars/avatar_mega_${i + 1}.png`;
                                                            return (
                                                                <button
                                                                    key={`mega-${i}`}
                                                                    onClick={async () => {
                                                                        try {
                                                                            setUploadingAvatar(true);
                                                                            const updated = await updateProfile(user!.uid, { avatar_url: avatarPath });
                                                                            setProfile(updated);
                                                                            
                                                                            // Global Context'i tazele (Header vb. yerler için)
                                                                            await globalRefreshProfile(user!.uid, user?.email || undefined);
                                                                            
                                                                            setShowAvatarModal(false);
                                                                            toast.success("Avatar başarıyla güncellendi.");
                                                                        } catch (err) {
                                                                            toast.error("Avatar seçilemedi.");
                                                                        } finally {
                                                                            setUploadingAvatar(false);
                                                                        }
                                                                    }}
                                                                    className="aspect-square rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-primary hover:scale-110 transition-all p-1 overflow-hidden flex items-center justify-center relative group shadow-sm hover:shadow-lg"
                                                                >
                                                                    <img 
                                                                        src={`${avatarPath}?v=3`} 
                                                                        alt={`Mega Avatar ${i+1}`} 
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                            </div>

                                            <div className="p-6 bg-muted/30 border-t border-border flex justify-end">
                                                <Button variant="outline" onClick={() => setShowAvatarModal(false)} className="rounded-xl px-8 font-bold">Kapat</Button>
                                            </div>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 border-b border-slate-100 dark:border-slate-800 pb-8 relative z-10 text-center md:text-left">
                                <div className="relative group/avatar">
                                    <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary/5 dark:bg-primary/10 flex items-center justify-center overflow-hidden border-4 border-border shadow-xl ring-2 ring-primary/10 mx-auto transition-transform group-hover/avatar:scale-105">
                                        {uploadingAvatar ? (
                                            <Loader2 size={32} className="text-primary animate-spin" />
                                        ) : profile?.avatar_url ? (
                                            <img 
                                                src={resolveUrl(profile.avatar_url) || ""} 
                                                alt="Avatar" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    // Bulut yoksa Yerel'i dene
                                                    if (target.src.includes('railway.app')) {
                                                        const LOCAL_URL = "http://127.0.0.1:8000";
                                                        const path = target.src.split('railway.app')[1];
                                                        target.src = `${LOCAL_URL}${path}`;
                                                    } else {
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent && !parent.querySelector('.avatar-fallback')) {
                                                            const icon = document.createElement('div');
                                                            icon.className = 'avatar-fallback text-primary/20';
                                                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                                                            parent.appendChild(icon);
                                                        }
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <User size={48} className="text-primary/20 dark:text-muted-foreground" />
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        id="avatar-input"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        ref={avatarInputRef}
                                    />
                                    <button 
                                        onClick={() => setShowAvatarModal(true)}
                                        className="absolute -bottom-1 -right-1 w-8 h-8 md:w-10 md:h-10 bg-primary text-white rounded-xl shadow-lg border-2 border-card flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                        title="Kütüphaneden Seç"
                                    >
                                        <LayoutGrid size={14} className="md:size-5" />
                                    </button>
                                    <button 
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="absolute -bottom-1 -left-1 w-8 h-8 md:w-10 md:h-10 bg-slate-800 text-white rounded-xl shadow-lg border-2 border-card flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                        title="Bilgisayardan Yükle"
                                    >
                                        <Camera size={14} className="md:size-5" />
                                    </button>
                                </div>
                                
                                <div className="space-y-1.5 md:space-y-2 flex-1 min-w-0">
                                    <h3 className="text-lg md:text-2xl font-black text-foreground tracking-tight uppercase font-outfit truncate">{profile?.full_name || "Müfettiş"}</h3>
                                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 mt-2">
                                        <span className="px-3 py-1 rounded-full bg-primary text-white text-[10px] md:text-xs font-black uppercase tracking-widest">{profile?.title || "Müfettiş"}</span>
                                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] md:text-xs font-bold">{profile?.institution || "GSB"}</span>
                                    </div>
                                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium truncate italic mt-2">{profile?.email}</p>
                                    {Array.isArray((profile as any)?.emails) && (profile as any).emails.length > 1 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(profile as any).emails.map((mail: string) => (
                                                <span key={mail} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold lowercase">
                                                    {mail}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">Ad Soyad</label>
                                    <input 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.full_name || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, full_name: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 ml-1">Ünvan</label>
                                    <input 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.title || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, title: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Bağlı Olduğu Kurum</label>
                                    <input 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={profile?.institution || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, institution: e.target.value} : null)}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Telefon Numarası</label>
                                    <input 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={(profile as any)?.phone || ""} 
                                        onChange={(e) => setProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                                        placeholder="0(5xx)..."
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Doğum Tarihi</label>
                                    <input 
                                        type="date"
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none" 
                                        value={(profile as any)?.birthday_full || ""} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const mmdd = val ? `${val.slice(5, 7)}-${val.slice(8, 10)}` : '';
                                            setProfile(prev => prev ? {...prev, birthday: mmdd, birthday_full: val} : null);
                                        }}
                                    />
                                </div>

                            </div>

                            <div className="flex justify-end pt-4 border-t border-slate-50 dark:border-slate-800">
                                <Button onClick={handleSave} disabled={saving} className="h-14 px-10 rounded-2xl shadow-xl shadow-primary/20 font-bold">
                                    {saving ? <Loader2 size={20} className="animate-spin mr-3" /> : <Save size={20} className="mr-3" />}
                                    Ayarları Kaydet
                                </Button>
                            </div>
                        </Card>
                    )}



                    {/* Rapor Ayarları */}
                    {activeTab === "Rapor Ayarları" && (
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            <div className="flex items-center gap-3">
                                <FileText className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Kodlama Standartları</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-6 bg-muted dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-3 block">Varsayılan Rapor Kodu Ön Eki</label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <input
                                            className="flex-1 p-4 bg-muted border border-border text-foreground rounded-xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 outline-none"
                                            value={raporOnek}
                                            onChange={(e) => setRaporOnek(e.target.value)}
                                            placeholder="Örn: S.Y.64"
                                        />
                                        <Button
                                            onClick={() => {
                                                localStorage.setItem('raporKoduOnek', raporOnek);
                                                toast.success('Rapor öneki güncellendi.');
                                            }}
                                            className="w-full sm:w-auto rounded-xl px-8 h-14 font-bold"
                                        >
                                            Güncelle
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 font-medium flex items-center gap-1">
                                        <AlertTriangle size={12} className="text-amber-500" />
                                        Örnek Görünüm: <span className="font-bold text-primary dark:text-primary/80">{raporOnek}/{new Date().getFullYear()}/001</span>
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Bildirimler */}
                    {activeTab === "Bildirimler" && (
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Bell className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Bildirim Tercihleri</h3>
                                </div>
                                <div 
                                    onClick={() => setProfile(prev => prev ? {...prev, notifications_enabled: !prev.notifications_enabled} : null)}
                                    className={cn(
                                        "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                                        profile?.notifications_enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-6 h-6 bg-card rounded-full shadow-lg transition-all duration-300",
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
                                    <p className="text-[11px] text-primary font-bold bg-primary/5 dark:bg-primary/10 p-3 rounded-xl border border-primary/10 dark:border-primary/20">
                                        ℹ️ Masaüstü uygulamasındasınız. Bildirimler sistem uyarısı olarak gönderilecektir.
                                    </p>
                                )}
                                {profile?.notifications_enabled && (
                                    <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                                        <Button 
                                            variant="outline" 
                                            onClick={handleSendTestNotification}
                                            className="w-full rounded-2xl h-12 border-primary/20 dark:border-primary/30 text-primary dark:text-primary/90 font-bold hover:bg-primary/5 dark:hover:bg-primary/10"
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
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            <div className="flex items-center gap-3">
                                <Shield className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Hesap Güvenliği</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-6">
                                <div className="p-6 bg-muted dark:bg-slate-800 rounded-3xl space-y-4">
                                    <div className="flex items-center gap-3 text-primary dark:text-primary/90">
                                        <Key size={20} />
                                        <span className="font-bold text-sm tracking-tight">Şifre İşlemleri</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Hesap güvenliğiniz için şifrenizi düzenli aralıklarla güncelleyin.</p>
                                    <Button variant="outline" className="w-full rounded-2xl h-12 bg-card font-bold border-slate-200 dark:border-slate-700" onClick={handlePasswordReset}>Şifre Değiştir</Button>
                                </div>
                            </div>
                        </Card>
                    )}
                    {/* Yapay Zeka Sekmesi */}
                    {activeTab === "Yapay Zeka" && (
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            {/* Gemini API Key */}
                            <GeminiKeySection />
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Wand2 className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">AI Asistan Ayarları</h3>
                                </div>
                                <div 
                                    onClick={() => setProfile(prev => prev ? {...prev, ai_enabled: !prev.ai_enabled} : null)}
                                    className={cn(
                                        "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                                        profile?.ai_enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                                    )}
                                >
                                    <div className={cn(
                                        "absolute top-1 w-6 h-6 bg-card rounded-full shadow-lg transition-all duration-300",
                                        profile?.ai_enabled ? "right-1" : "left-1"
                                    )} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-6 bg-muted dark:bg-slate-800 rounded-3xl space-y-4">
                                    <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-1 block">Zeka Modeli Seçimi</label>
                                    <select 
                                        className="w-full p-4 bg-muted border border-border text-foreground rounded-2xl text-sm font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer"
                                        value={profile?.ai_model || "gemini-2.0-flash"}
                                        onChange={(e) => setProfile(prev => prev ? {...prev, ai_model: e.target.value} : null)}
                                    >
                                        {GEMINI_MODELS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium italic">Sohbet, rapor analizleri ve otomatik işlemler bu model üzerinden yapılır.</p>
                                </div>

                                <div className="p-6 bg-muted dark:bg-slate-800 rounded-3xl space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-1 block">Yaratıcılık Düzeyi</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.1"
                                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary" 
                                        value={profile?.ai_temperature || 0.7}
                                        onChange={(e) => setProfile(prev => prev ? {...prev, ai_temperature: parseFloat(e.target.value)} : null)}
                                    />
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                        <span>Kesin (Teknik)</span>
                                        <span>Dengeli</span>
                                        <span>Yaratıcı</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-primary/5 dark:bg-primary/10 rounded-3xl border border-primary/10 dark:border-primary/20">
                                <label className="text-[11px] font-bold text-primary dark:text-primary/90 mb-3 block">Özel Sistem Komutu (System Prompt)</label>
                                <textarea 
                                    className="w-full p-4 bg-card border border-primary/10 dark:border-primary/20 rounded-2xl text-sm font-medium dark:text-slate-100 min-h-[120px] focus:ring-4 focus:ring-primary/10 outline-none resize-none"
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
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            <div className="flex items-center gap-3">
                                <Database className="text-primary" size={24} />
                                <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Veri Yönetimi ve Yedekleme</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Dışa Aktar / Yerel Yedek */}
                                <div className="p-8 bg-blue-50 dark:bg-blue-950/20 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-muted rounded-2xl shadow-sm text-blue-600 dark:text-blue-400 relative z-10 transition-transform group-hover:scale-110">
                                        <Download size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-blue-900 dark:text-blue-100">Yerel Yedekleme</p>
                                        <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold mt-2 leading-relaxed">Sistemdeki tüm denetim ve rehber verilerini JSON formatında bilgisayarınıza indirin.</p>
                                    </div>
                                    <Button 
                                        onClick={handleLocalBackup}
                                        disabled={backupLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 font-bold shadow-xl shadow-blue-200 dark:shadow-blue-950/40 mt-auto relative z-10"
                                    >
                                        {backupLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Download className="mr-2" size={20} />}
                                        ŞİMDİ İNDİR
                                    </Button>
                                    <Database className="absolute -right-4 -bottom-4 text-blue-100/50 dark:text-blue-900/10" size={100} />
                                </div>

                                {/* Drive Yedekleme */}
                                <div className="p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-muted rounded-2xl shadow-sm text-emerald-600 dark:text-emerald-400 relative z-10 transition-transform group-hover:scale-110">
                                        <Upload size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Bulut Yedekleme (Drive)</p>
                                        <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-2 leading-relaxed">Verilerinizi güvenli bir şekilde Google Drive hesabınıza senkronize edin.</p>
                                    </div>
                                    <Button 
                                        onClick={handleDriveBackup}
                                        disabled={driveBackupLoading}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-2xl h-14 font-bold shadow-xl shadow-emerald-200 dark:shadow-emerald-950/40 mt-auto relative z-10"
                                    >
                                        {driveBackupLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <HardDrive className="mr-2" size={20} />}
                                        DRIVE'A GÖNDER
                                    </Button>
                                    <Globe className="absolute -right-4 -bottom-4 text-emerald-100/50 dark:text-emerald-900/10" size={100} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* İçe Aktar / Yedek Yükle */}
                                <div className="p-8 bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col items-center text-center gap-4 relative overflow-hidden group">
                                    <div className="p-4 bg-muted rounded-2xl shadow-sm text-indigo-600 dark:text-indigo-400 relative z-10 transition-transform group-hover:scale-110">
                                        <Upload size={32} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="font-bold text-sm text-indigo-900 dark:text-indigo-100">Yedek Yükle (Restore)</p>
                                        <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold mt-2 leading-relaxed">Bilgisayarınızdaki JSON yedek dosyasını seçerek tüm verileri geri yükleyin.</p>
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
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl h-14 font-bold shadow-xl shadow-indigo-200 dark:shadow-indigo-950/40 mt-auto relative z-10"
                                    >
                                        {importLoading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Upload className="mr-2" size={20} />}
                                        DOSYA SEÇ VE YÜKLE
                                    </Button>
                                    <CheckCircle2 className="absolute -right-4 -bottom-4 text-indigo-100/50 dark:text-indigo-900/10" size={100} />
                                </div>

                                {/* Bilgi Notu */}
                                <div className="p-8 bg-muted dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center gap-4 relative overflow-hidden">
                                     <div className="relative z-10 space-y-3">
                                        <div className="flex items-center gap-2 text-foreground dark:text-slate-100">
                                            <Shield size={18} className="text-primary dark:text-primary/90" />
                                            <p className="font-bold text-xs uppercase tracking-wider">Güvenlik Notu</p>
                                        </div>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                                            Yedek yükleme işlemi "Merge" mantığıyla çalışır. Mevcut verileriniz silinmez, yedek dosyasındaki verilerle güncellenir veya yeni kayıtlar eklenir.
                                        </p>
                                        <ul className="text-[9px] text-slate-400 dark:text-slate-500 font-bold space-y-1">
                                            <li>• JSON formatındaki resmi yedek dosyalarını kullanın.</li>
                                            <li>• İşlem sonrası sistem otomatik yenilenecektir.</li>
                                        </ul>
                                     </div>
                                </div>
                            </div>

                            {/* Kritik İşlemler */}
                            <div className="p-6 md:p-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 bg-muted/30 dark:bg-slate-800/10">
                                <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                                    <div className="p-3 bg-muted rounded-2xl text-rose-500 shadow-sm border border-rose-50 dark:border-rose-900/30">
                                        <ShieldAlert size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground dark:text-slate-100">Verileri Sıfırla</h4>
                                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">Bu işlem tüm geçmiş verileri kalıcı olarak silecektir. Geri dönüşü yoktur.</p>
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

                    {/* Müfettiş Listesi Sekmesi - Kaldırıldı, /admin/inspectors sayfasına taşındı */}
                    {false && (
                        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Users className="text-primary" size={24} />
                                    <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">Müfettiş Listesi</h3>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    {/* Manual import hidden as requested */}
                                </div>
                            </div>

                            <p className="text-sm font-medium text-muted-foreground dark:text-slate-400">
                                Sisteme kayıtlı olan tüm kullanıcıların listesidir. Bu listedeki isimler görev oluşturma ve mesajlaşma bölümlerinde aktif olarak görünür.
                            </p>

                            {/* Yeni Müfettiş Ekleme Formu gizlendi */}

                            {/* Müfettiş Listesi */}
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <h4 className="text-xs font-bold text-slate-400 ml-1">Kayıtlı Kullanıcılar</h4>
                                    
                                    {/* Arama Çubuğu */}
                                    <div className="relative group w-full md:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" size={16} />
                                        <input 
                                            type="text"
                                            placeholder="İsim veya e-posta ile ara..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-card border border-border text-foreground rounded-2xl text-xs font-bold dark:text-slate-100 focus:ring-4 focus:ring-primary/10 transition-all outline-none"
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
                                            <div key={ins.id} className="flex items-center justify-between p-5 bg-card border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-primary/20 dark:hover:border-primary/40 hover:shadow-md transition-all group">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
                                                    <div className="w-12 h-12 rounded-xl bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary/90 flex items-center justify-center font-black shrink-0">
                                                        {ins.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-muted-foreground dark:text-slate-200 truncate">{ins.name}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <p className="text-[10px] text-muted-foreground dark:text-slate-400 font-medium truncate">{ins.email}</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {ins.extension && (
                                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">D: {ins.extension}</span>
                                                                )}
                                                                {ins.phone && (
                                                                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Cep: {ins.phone}</span>
                                                                )}
                                                                {ins.room && (
                                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Oda: {ins.room}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <button 
                                                            onClick={() => setOpenRoleMenu(openRoleMenu === ins.id ? null : ins.id)}
                                                            className="p-3 text-slate-400 dark:text-slate-600 hover:text-primary dark:hover:text-primary/90 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-all"
                                                        >
                                                            <MoreVertical size={18} />
                                                        </button>
                                                        {openRoleMenu === ins.id && (
                                                            <div className="absolute right-0 top-12 w-48 bg-muted border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in duration-200">
                                                                <button onClick={() => handleUpdateRole(ins.id, 'admin')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Yönetici Yap</button>
                                                                <button onClick={() => handleUpdateRole(ins.id, 'moderator')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Moderatör Yap</button>
                                                                <button onClick={() => handleUpdateRole(ins.id, 'user')} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-muted dark:hover:bg-slate-700 transition-colors text-muted-foreground dark:text-slate-300">Yetkisini Kaldır</button>
                                                                <div className="h-[1px] bg-muted dark:bg-slate-700 my-1" />
                                                                <button onClick={async () => {
                                                                    const confirmed = await confirm({
                                                                        title: "Kullanıcıyı Sil",
                                                                        message: "Bu kullanıcıyı sistemden kalıcı olarak silmek istediğinize emin misiniz?",
                                                                        confirmText: "Sil",
                                                                        variant: "danger"
                                                                    });
                                                                    if (confirmed) {
                                                                        try {
                                                                            await apiDeleteProfile(ins.id);
                                                                            toast.success("Kullanıcı sistemden silindi.");
                                                                            loadInspectors();
                                                                        } catch (err) {
                                                                            toast.error("Silme işlemi başarısız.");
                                                                        }
                                                                    }
                                                                }} className="w-full text-left px-4 py-2.5 text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-rose-500">Sistemden Sil</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {filteredInspectors.length === 0 && (
                                            <div className="text-center py-10 bg-muted dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                                <Users size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                                                    {searchTerm ? "Aranan kriterde kullanıcı bulunamadı." : "Henüz sisteme kayıtlı bir kullanıcı bulunmuyor."}
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
                                                                         : "text-slate-400 dark:text-slate-500 hover:bg-muted dark:hover:bg-slate-800"
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
                </div>
            </div>
        </div>
    );
}

function SettingsNav({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest transition-all w-full min-w-max md:min-w-0 snap-start",
                active 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02] md:translate-x-2" 
                    : "text-slate-400 dark:text-slate-500 hover:bg-muted dark:hover:bg-slate-800"
            )}
        >
            <Icon size={18} className={active ? "text-white" : "text-primary/40"} />
            <span>{label}</span>
        </button>
    );
}



function NotificationToggle({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) {
    return (
        <div className="flex items-center justify-between p-6 bg-muted dark:bg-slate-800/50 rounded-3xl">
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl shadow-sm", active ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" : "bg-muted text-slate-300 dark:text-slate-600")}>
                    {active ? <CheckCircle2 size={20} /> : <Bell size={20} />}
                </div>
                <div>
                    <p className="font-bold text-sm text-muted-foreground dark:text-slate-200 tracking-tight">{label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{desc}</p>
                </div>
            </div>
            <div 
                onClick={onToggle}
                className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300", active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}
            >
                <div className={cn("absolute top-1 w-4 h-4 bg-card dark:bg-slate-200 rounded-full transition-all duration-300", active ? "right-1" : "left-1")} />
            </div>
        </div>
    );
}
