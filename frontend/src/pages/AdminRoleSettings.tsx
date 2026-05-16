import { useState, useEffect } from "react";
import { 
    Shield, ChevronRight, Save, Loader2, Check, 
    LayoutDashboard, FileText, 
    Users, StickyNote, Calendar, 
    MessageSquare, Globe, Lock, Bot, ArrowLeft,
    CheckSquare, ClipboardCheck, FolderTree, BookOpen, Star
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchRolesSettings, updateRolesSettings } from "../lib/api/settings";
import { useAuth } from "../lib/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const MODUL_LISTESI = [
    { 
        id: "dashboard", 
        label: "Genel Bakış", 
        icon: LayoutDashboard,
        description: "Genel istatistikler ve özet bilgilere erişim."
    },
    { 
        id: "tasks", 
        label: "Görevler", 
        icon: CheckSquare,
        description: "Denetim görevlerini görüntüleme ve yönetme yetkisi."
    },
    { 
        id: "report-analytics", 
        label: "Görev Analizleri", 
        icon: ClipboardCheck,
        description: "Tamamlanan görevlerin derinlemesine analizleri."
    },
    { 
        id: "audit", 
        label: "Raporlar", 
        icon: FileText,
        description: "Denetim raporlarına ve analiz araçlarına tam erişim."
    },
    { 
        id: "notes", 
        label: "Hızlı Notlar", 
        icon: StickyNote,
        description: "Hızlı notlar ve kişisel çalışma alanı."
    },
    { 
        id: "files", 
        label: "Dosyalar", 
        icon: FolderTree,
        description: "Dosya yönetimi ve arşiv sistemi."
    },
    { 
        id: "legislation", 
        label: "Mevzuat", 
        icon: BookOpen,
        description: "Mevzuat verilerine erişim ve yönetim."
    },
    { 
        id: "calendar", 
        label: "Takvim", 
        icon: Calendar,
        description: "Denetim takvimi ve program yönetimi."
    },
    { 
        id: "contacts", 
        label: "Rehber", 
        icon: Users,
        description: "Müfettiş ve personel iletişim bilgilerine erişim."
    },
    { 
        id: "messages", 
        label: "Mesajlar", 
        icon: MessageSquare,
        description: "Sistem içi mesajlaşma ve iletişim."
    },
    { 
        id: "public_space", 
        label: "Kamusal Alan", 
        icon: Globe,
        description: "Forum ve ortak paylaşım alanı."
    },
    { 
        id: "assistant", 
        label: "Dijital Müfettiş", 
        icon: Bot,
        description: "Yapay zeka destekli denetim asistanı."
    },
    { 
        id: "feedback", 
        label: "Bize Puan Verin", 
        icon: Star,
        description: "Sistem geri bildirimlerini iletme."
    },
];

export default function AdminRoleSettings() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const isFounder = user?.email === "sefayaprakli@hotmail.com" || 
                      user?.email === "sefa.yaprakli@gsb.gov.tr" ||
                      user?.email === "syaprakli@gmail.com" ||
                      user?.uid === "VKV8SfuNkWf9WeTYeSCTizd4oG83";

    useEffect(() => {
        if (!isFounder && user) {
            toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            navigate("/");
        }
    }, [isFounder, user, navigate]);

    const [permissions, setPermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await fetchRolesSettings();
            setPermissions(data.moderator_permissions || []);
        } catch (error) {
            console.error("Yetkiler yüklenemedi:", error);
            toast.error("Ayarlar yüklenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (moduleId: string) => {
        setPermissions(prev => 
            prev.includes(moduleId) 
                ? prev.filter(p => p !== moduleId) 
                : [...prev, moduleId]
        );
    };

    const handleSelectAll = () => {
        setPermissions(MODUL_LISTESI.map(m => m.id));
    };

    const handleClearAll = () => {
        setPermissions([]);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateRolesSettings({ moderator_permissions: permissions });
            toast.success("Moderatör yetkileri başarıyla güncellendi.");
        } catch (error) {
            toast.error("Yetkiler güncellenemedi.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-primary/60 mb-3 bg-primary/5 w-fit px-3 py-1.5 rounded-full">
                        <button 
                            onClick={() => navigate('/admin')}
                            className="flex items-center gap-1 hover:text-primary transition-colors mr-2 group border-r border-primary/20 pr-2"
                        >
                            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
                            <span>Panele Dön</span>
                        </button>
                        <Lock size={12} />
                        <span>Güvenlik</span>
                        <ChevronRight size={10} />
                        <span className="text-primary">Yetkiler</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-3">
                        Yetki Kontrol Paneli
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-bold uppercase tracking-tighter">Admin</span>
                    </h1>
                    <p className="text-slate-500 text-sm md:text-base font-medium mt-2 max-w-2xl leading-relaxed">
                        Moderatörlerin hangi modüllere erişebileceğini buradan belirleyin.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <Button
                        variant="outline"
                        onClick={handleClearAll}
                        className="h-11 md:h-12 px-5 rounded-2xl font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 text-xs md:text-sm"
                    >
                        Sıfırla
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="h-11 md:h-12 px-8 rounded-2xl font-bold bg-primary text-white shadow-xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs md:text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Değişiklikleri Uygula
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Summary & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="p-6 border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Moderatör Rolü</h3>
                                <p className="text-xs text-slate-500">Aktif Yetki: {permissions.length} / {MODUL_LISTESI.length}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                Seçilen yetkiler, moderatörlerin sol menüsünde anında aktifleşir.
                            </p>
                            <div className="h-px bg-slate-200" />
                            <button 
                                onClick={handleSelectAll}
                                className="w-full text-left p-3 rounded-xl hover:bg-white transition-colors text-primary font-bold text-sm flex items-center justify-between"
                            >
                                Tüm Yetkileri Ver
                                <Check size={16} />
                            </button>
                        </div>
                    </Card>

                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                        <h4 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
                            ⚠️ Güvenlik Notu
                        </h4>
                        <p className="text-amber-700/80 text-xs leading-relaxed font-medium">
                            Mevzuat Yönetimi yetkisi verilen kullanıcılar, sistem genelindeki tüm yasama verilerini değiştirebilir. Bu yetkiyi sadece güvendiğiniz moderatörlere tanımlayın.
                        </p>
                    </div>
                </div>

                {/* Right Side: Grid of Modules */}
                <div className="lg:col-span-2">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <p className="text-slate-500 font-bold mt-4 tracking-tight">Senkronize ediliyor...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {MODUL_LISTESI.map(modul => {
                                const isChecked = permissions.includes(modul.id);
                                const Icon = modul.icon;
                                return (
                                    <div
                                        key={modul.id}
                                        onClick={() => handleToggle(modul.id)}
                                        className={`group relative flex items-start gap-4 p-5 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                                            isChecked 
                                                ? "border-primary bg-white shadow-xl shadow-primary/5" 
                                                : "border-slate-100 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                            isChecked ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : "bg-white text-slate-400 group-hover:text-primary"
                                        }`}>
                                            <Icon size={22} />
                                        </div>
                                        
                                        <div className="flex-1 pt-0.5">
                                            <h4 className={`font-bold transition-colors ${isChecked ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"}`}>
                                                {modul.label}
                                            </h4>
                                            <p className="text-[11px] text-slate-400 font-medium leading-normal mt-1 pr-4">
                                                {modul.description}
                                            </p>
                                        </div>

                                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${
                                            isChecked ? "bg-primary text-white rotate-0 scale-100" : "bg-slate-200 text-transparent rotate-90 scale-50"
                                        }`}>
                                            <Check size={14} strokeWidth={4} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
