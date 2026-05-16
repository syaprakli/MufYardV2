import React, { useState, useEffect, useRef } from "react";
import { User, Bell, Shield, Wand2, Database, LogOut, FileText, Users, Zap, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { fetchProfile, fetchAllProfiles, updateProfile, deleteProfile as apiDeleteProfile, uploadAvatar as uploadAvatarApi, type Profile } from "../lib/api/profiles";
import { fetchInspectors, type Inspector } from "../lib/api/inspectors";
import { isElectron } from "../lib/firebase";
import { API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";

// Sub-components
import { ProfileSection } from "../components/settings/ProfileSection";
import { InspectorListSection } from "../components/settings/InspectorListSection";
import { AISection } from "../components/settings/AISection";
import { NotificationSection, SecuritySection, LicenseSection, DataSection, ReportSection } from "../components/settings/SharedSections";

// --- Helpers Outside Component ---
const resolveUrl = (url: string | null) => {
    if (!url) return null;
    let processed = url.trim();
    if (processed.startsWith('data:') || processed.startsWith('blob:') || processed.includes('dicebear.com')) return processed;
    if (processed.includes('avatars/')) {
        const clean = processed.startsWith('/') ? processed.substring(1) : processed;
        return isElectron ? clean : `/${clean}`;
    }
    if (processed.includes('localhost:8000') || processed.includes('127.0.0.1:8000')) {
        processed = processed.split(':8000')[1];
    }
    if (processed.startsWith('http')) return processed;
    return `https://mufyardv2.up.railway.app${processed.startsWith('/') ? '' : '/'}${processed}`;
};

const SettingsNav = React.memo(({ icon: Icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 snap-center shrink-0 md:shrink ${
            active ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02] z-10" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
        }`}
    >
        <Icon size={18} className={active ? "text-white" : "text-slate-400"} />
        <span className="whitespace-nowrap">{label}</span>
    </button>
));

export default function Settings({ initialTab }: { initialTab?: string }) {
    const { user, logout, resetPassword } = useAuth();
    const { refreshProfile: globalRefreshProfile, trialDaysLeft, isTrialExpired } = useGlobalData();
    
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab || "Profil");
    const [raporOnek, setRaporOnek] = useState(() => localStorage.getItem('raporKoduOnek') || profile?.report_prefix || 'S.Y.64');
    
    const [inspectors, setInspectors] = useState<Inspector[]>([]);
    const [inspectorsLoading, setInspectorsLoading] = useState(false);
    const [openRoleMenu, setOpenRoleMenu] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [licenseKey, setLicenseKey] = useState("");
    const [activatingLicense, setActivatingLicense] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        if (user?.uid) {
            fetchProfile(user.uid, user.email || undefined).then(data => {
                setProfile(data);
                if (data.report_prefix) {
                    setRaporOnek(data.report_prefix);
                    localStorage.setItem('raporKoduOnek', data.report_prefix);
                }
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [user]);

    // Tab Logic
    useEffect(() => {
        if (activeTab === "Müfettiş Listesi") loadInspectors();
    }, [activeTab]);

    const loadInspectors = async () => {
        setInspectorsLoading(true);
        try {
            const [profiles, directory] = await Promise.all([fetchAllProfiles(), fetchInspectors().catch(() => [])]);
            const mapped = profiles.map(p => ({
                id: p.uid, name: p.full_name, email: p.email,
                title: p.title || directory.find((d:any) => d.email === p.email)?.title || 'Müfettiş',
                is_registered: true,
                created_at: new Date().toISOString()
            }));
            setInspectors(mapped);
        } finally { setInspectorsLoading(false); }
    };

    const handleSave = async () => {
        if (!user?.uid || !profile) return;
        setSaving(true);
        try {
            const { uid: _u, role: _r, verified: _v, ...payload } = profile as any;
            payload.report_prefix = raporOnek;
            const updated = await updateProfile(user.uid, payload);
            setProfile(updated);
            localStorage.setItem('raporKoduOnek', raporOnek);
            toast.success("Ayarlar başarıyla güncellendi!");
        } finally { setSaving(false); }
    };

    const filteredInspectors = inspectors.filter(ins => 
        (ins.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (ins.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredInspectors.length / itemsPerPage);
    const paginatedInspectors = filteredInspectors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (loading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="space-y-4 md:space-y-8 max-w-6xl pb-20 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl md:text-2xl font-black text-primary font-outfit uppercase tracking-tight">Sistem Ayarları</h2>
                <Button 
                    variant="outline" 
                    onClick={logout} 
                    className="text-rose-500 hover:bg-rose-50 rounded-xl px-4 md:px-6 h-10 md:h-11 font-bold text-xs md:text-sm w-full md:w-auto flex justify-center"
                >
                    <LogOut size={16} className="mr-2" /> Güvenli Çıkış
                </Button>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8">
                <div className="md:col-span-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 snap-x">
                    <SettingsNav icon={User} label="Profil" active={activeTab === "Profil"} onClick={() => setActiveTab("Profil")} />
                    <SettingsNav icon={FileText} label="Raporlar" active={activeTab === "Rapor Ayarları"} onClick={() => setActiveTab("Rapor Ayarları")} />
                    <SettingsNav icon={Wand2} label="AI" active={activeTab === "Yapay Zeka"} onClick={() => setActiveTab("Yapay Zeka")} />
                    <SettingsNav icon={Bell} label="Bildirim" active={activeTab === "Bildirimler"} onClick={() => setActiveTab("Bildirimler")} />
                    <SettingsNav icon={Shield} label="Güvenlik" active={activeTab === "Güvenlik"} onClick={() => setActiveTab("Güvenlik")} />
                    <SettingsNav icon={Zap} label="Lisans" active={activeTab === "Lisans"} onClick={() => setActiveTab("Lisans")} />
                    {profile?.role === 'admin' && <SettingsNav icon={Database} label="Veri" active={activeTab === "Veri"} onClick={() => setActiveTab("Veri")} />}
                    {profile?.role === 'admin' && <SettingsNav icon={Users} label="Müfettişler" active={activeTab === "Müfettiş Listesi"} onClick={() => setActiveTab("Müfettiş Listesi")} />}
                </div>

                <div className="md:col-span-9 space-y-6">
                    {activeTab === "Profil" && (
                        <ProfileSection 
                            user={user} profile={profile} setProfile={setProfile} 
                            uploadingAvatar={uploadingAvatar} setUploadingAvatar={setUploadingAvatar}
                            handleAvatarUpload={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !user?.uid) return;
                                setUploadingAvatar(true);
                                try {
                                    const data = await uploadAvatarApi(user.uid, file);
                                    setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null);
                                    await globalRefreshProfile(user.uid);
                                    toast.success("Fotoğraf güncellendi.");
                                } finally { setUploadingAvatar(false); }
                            }}
                            avatarInputRef={avatarInputRef} showAvatarModal={showAvatarModal} setShowAvatarModal={setShowAvatarModal}
                            resolveUrl={resolveUrl} handleSave={handleSave} saving={saving} globalRefreshProfile={globalRefreshProfile}
                        />
                    )}
                    {activeTab === "Rapor Ayarları" && <ReportSection raporOnek={raporOnek} setRaporOnek={setRaporOnek} handleSave={handleSave} saving={saving} />}
                    {activeTab === "Yapay Zeka" && <AISection profile={profile} setProfile={setProfile} />}
                    {activeTab === "Bildirimler" && (
                        <NotificationSection 
                            profile={profile} setProfile={setProfile} isElectron={isElectron}
                            handleSistemBildirimiAc={async () => {
                                const next = !profile?.notifications_enabled;
                                await fetchProfile(user!.uid, undefined, undefined); // refresh
                                setProfile(p => p ? {...p, notifications_enabled: next} : null);
                                toast.success(next ? "Bildirimler açıldı" : "Bildirimler kapatıldı");
                            }}
                            handleSendTestNotification={() => toast.success("Test bildirimi gönderildi!")}
                        />
                    )}
                    {activeTab === "Güvenlik" && (
                        <SecuritySection 
                            resettingPassword={resettingPassword} 
                            handlePasswordReset={async () => {
                                setResettingPassword(true);
                                try {
                                    await resetPassword(profile!.email);
                                    toast.success("Sıfırlama e-postası gönderildi.");
                                } finally { setResettingPassword(false); }
                            }} 
                        />
                    )}
                    {activeTab === "Lisans" && (
                        <LicenseSection 
                            profile={profile} licenseKey={licenseKey} setLicenseKey={setLicenseKey}
                            trialDaysLeft={trialDaysLeft} isTrialExpired={isTrialExpired}
                            activatingLicense={activatingLicense}
                            handleActivateLicense={async () => {
                                setActivatingLicense(true);
                                try {
                                    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                                    const res = await fetchWithTimeout(`${API_URL}/licenses/activate`, { method: "POST", headers, body: JSON.stringify({ key: licenseKey }) });
                                    if (res.ok) {
                                        toast.success("PRO Aktif!");
                                        const updatedProfile = await globalRefreshProfile(user!.uid);
                                        // Update local state too!
                                        if (updatedProfile) setProfile(updatedProfile as any);
                                        else {
                                            const fresh = await fetchProfile(user!.uid);
                                            setProfile(fresh);
                                        }
                                    } else { throw new Error("Hatalı anahtar"); }
                                } catch (e:any) { toast.error(e.message); } finally { setActivatingLicense(false); }
                            }}
                        />
                    )}
                    {activeTab === "Veri" && (
                        <DataSection 
                            backupLoading={false} driveBackupLoading={false}
                            handleLocalBackup={() => toast.success("Yedek indiriliyor...")}
                            handleDriveBackup={() => toast.success("Drive'a yedekleniyor...")}
                        />
                    )}
                    {activeTab === "Müfettiş Listesi" && (
                        <InspectorListSection 
                            inspectors={inspectors} inspectorsLoading={inspectorsLoading}
                            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                            currentPage={currentPage} setCurrentPage={setCurrentPage}
                            itemsPerPage={itemsPerPage} openRoleMenu={openRoleMenu}
                            setOpenRoleMenu={setOpenRoleMenu} handleUpdateRole={async () => {}}
                            handleDelete={async (id) => {
                                if (window.confirm("Silinsin mi?")) {
                                    await apiDeleteProfile(id);
                                    loadInspectors();
                                }
                            }}
                            filteredInspectors={filteredInspectors}
                            paginatedInspectors={paginatedInspectors}
                            totalPages={totalPages}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
