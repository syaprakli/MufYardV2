import { 
    Shield, Users, Star, Key,
    ChevronRight, ArrowLeft,
    Activity, ShieldCheck, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useAuth } from "../lib/hooks/useAuth";
import { useEffect } from "react";
import { toast } from "react-hot-toast";

const HUB_ITEMS = [
    {
        id: "inspectors",
        title: "Müfettiş Listesi",
        description: "Sistemdeki tüm kayıtlı müfettişleri ve kullanıcıları yönetin.",
        icon: Users,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        href: "/admin/inspectors"
    },
    {
        id: "roles",
        title: "Moderatör İzinleri",
        description: "Moderatör rollerinin hangi modüllere erişebileceğini belirleyin.",
        icon: ShieldCheck,
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        href: "/admin/roles"
    },
    {
        id: "licenses",
        title: "Lisans Yönetimi",
        description: "Pro sürüm için yeni lisans anahtarları üretin ve takip edin.",
        icon: Key,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
        href: "/admin/licenses"
    },
    {
        id: "feedback",
        title: "Sistem Değerlendirmeleri",
        description: "Kullanıcılardan gelen geri bildirimleri ve puanları inceleyin.",
        icon: Star,
        color: "text-amber-600",
        bgColor: "bg-amber-50",
        href: "/admin/feedback"
    }
];

export default function FounderHub() {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();

    const isFounder = profile?.role === "admin";

    useEffect(() => {
        if (!loading && user && !isFounder) {
            toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            navigate("/");
        }
    }, [isFounder, user, loading, navigate]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-16 px-2 sm:px-4">
            {/* Header */}
            <div className="flex flex-col gap-1.5 px-1">
                <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1 bg-amber-50 w-fit px-2.5 py-1 rounded-full border border-amber-100">
                    <Shield size={12} />
                    <span>Sistem Yönetimi</span>
                    <ChevronRight size={12} />
                    <span className="text-amber-700">Kurucu Paneli</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Kurucu Kontrol Merkezi
                </h1>
                <p className="text-slate-500 text-xs md:text-sm font-medium max-w-xl leading-normal">
                    Yönetimsel süreçleri ve yetkilendirmeleri buradan kontrol edin.
                </p>
            </div>

            {/* Hub Grid - 4 items in compact responsive layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
                {HUB_ITEMS.map((item) => (
                    <Card 
                        key={item.id}
                        onClick={() => navigate(item.href)}
                        className="group relative p-4 md:p-5 border border-slate-200/80 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer overflow-hidden rounded-2xl bg-white flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-10 h-10 md:w-11 md:h-11 ${item.bgColor} ${item.color} rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-xs`}>
                                    <item.icon size={20} />
                                </div>
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0">
                                    <ChevronRight size={15} />
                                </div>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 tracking-tight group-hover:text-primary transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-slate-500 text-xs md:text-sm font-normal leading-relaxed mt-1 line-clamp-2">
                                {item.description}
                            </p>
                        </div>

                        {/* Background subtle decoration */}
                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${item.bgColor} opacity-0 group-hover:opacity-15 rounded-full blur-2xl transition-opacity duration-300 pointer-events-none`} />
                    </Card>
                ))}
            </div>

            {/* Bottom Section: Quick Stats or Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 md:gap-4">
                <Card className="p-4 md:p-5 bg-slate-900 text-white border-none rounded-2xl flex items-center gap-4 shadow-md shadow-slate-200">
                    <div className="w-10 h-10 md:w-11 md:h-11 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                        <Activity size={20} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Sistem Durumu</p>
                        <h4 className="text-sm md:text-base font-bold tracking-tight">Tüm Sistemler Aktif</h4>
                    </div>
                </Card>

                <Card className="p-4 md:p-5 bg-white border border-slate-200/80 rounded-2xl lg:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 md:w-11 md:h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                            <Zap size={20} />
                        </div>
                        <p className="text-slate-600 text-xs md:text-sm font-semibold max-w-sm">
                            Platform performansı ve güvenlik duvarları %100 kapasiteyle çalışıyor.
                        </p>
                    </div>
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold text-xs md:text-sm transition-colors mt-1 sm:mt-0"
                    >
                        <ArrowLeft size={14} />
                        Anasayfa
                    </button>
                </Card>
            </div>
        </div>
    );
}
