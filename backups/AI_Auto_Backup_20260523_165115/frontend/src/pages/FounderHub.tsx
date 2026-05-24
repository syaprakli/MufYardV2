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

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2 px-1">
                <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-2 bg-amber-50 w-fit px-3 py-1.5 rounded-full border border-amber-100">
                    <Shield size={12} />
                    <span>Sistem Yönetimi</span>
                    <ChevronRight size={12} />
                    <span className="text-amber-700">Kurucu Paneli</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                    Kurucu Kontrol Merkezi
                </h1>
                <p className="text-slate-500 text-sm md:text-lg font-medium max-w-2xl leading-relaxed">
                    Yönetimsel süreçleri buradan kontrol edin.
                </p>
            </div>

            {/* Hub Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {HUB_ITEMS.map((item) => (
                    <Card 
                        key={item.id}
                        onClick={() => navigate(item.href)}
                        className="group relative p-6 md:p-8 border-2 border-slate-100 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-white"
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div className="space-y-4">
                                <div className={`w-14 h-14 md:w-16 md:h-16 ${item.bgColor} ${item.color} rounded-2xl md:rounded-3xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm`}>
                                    <item.icon size={28} className="md:w-8 md:h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{item.title}</h3>
                                    <p className="text-slate-500 text-sm md:text-base font-medium leading-relaxed max-w-[280px]">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner shrink-0">
                                <ChevronRight size={20} className="md:w-6 md:h-6" />
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className={`absolute -right-4 -bottom-4 w-32 h-32 ${item.bgColor} opacity-0 group-hover:opacity-10 rounded-full blur-3xl transition-opacity duration-500`} />
                    </Card>
                ))}
            </div>

            {/* Bottom Section: Quick Stats or Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <Card className="p-6 bg-slate-900 text-white border-none rounded-[1.5rem] md:rounded-[2rem] flex items-center gap-6 shadow-xl shadow-slate-200">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                        <Activity className="text-amber-400" />
                    </div>
                    <div>
                        <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Sistem Durumu</p>
                        <h4 className="text-base md:text-lg font-black tracking-tight">Tüm Sistemler Aktif</h4>
                    </div>
                </Card>

                <Card className="p-6 bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] lg:col-span-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:px-10 shadow-sm">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                            <Zap size={24} />
                        </div>
                        <p className="text-slate-600 text-sm md:text-base font-bold max-w-sm">
                            Platform performansı ve güvenlik duvarları %100 kapasiteyle çalışıyor.
                        </p>
                    </div>
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-sm transition-colors mt-2 md:mt-0"
                    >
                        <ArrowLeft size={16} />
                        Anasayfa
                    </button>
                </Card>
            </div>
        </div>
    );
}
