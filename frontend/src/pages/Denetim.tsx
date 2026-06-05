import { useNavigate } from "react-router-dom";
import {
    Shield, BookOpen, ClipboardCheck, Bot, ChevronRight, ArrowRight,
    Building2, Activity
} from "lucide-react";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { AUDIT_TEMPLATES } from "../lib/auditTemplates";

const categoryMap: Record<string, string> = {
    il: "İl Denetimi",
    federasyon: "Federasyon Denetimi",
    kyk: "Kyk Yurt Denetimi",
    ozel: "Özel Yurt Denetimi",
    spor: "Spor Kulüpleri Denetimi"
};

const CARDS = [
    {
        id: "il",
        title: "İl Müdürlükleri Denetimi",
        description: "İl müdürlükleri teşkilat yapısı, spor faaliyetleri, gençlik hizmetleri, tesislerin işletimi ve mali işlemlerinin denetimi.",
        path: "/denetim/il",
        icon: Shield,
        color: {
            bg: "bg-blue-50/50 dark:bg-blue-950/10",
            border: "border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700/50",
            text: "text-blue-600 dark:text-blue-400",
            glow: "shadow-blue-500/5 dark:shadow-blue-500/10"
        },
        stats: `${AUDIT_TEMPLATES.il?.length || 80} Standart Soru`
    },
    {
        id: "federasyon",
        title: "Federasyon Denetimi",
        description: "Bağımsız ve bağımlı spor federasyonlarının ana statü, genel kurul işlemleri, yönetim kurulları, bütçe harcamaları ve idari süreç denetimleri.",
        path: "/denetim/federasyon",
        icon: BookOpen,
        color: {
            bg: "bg-emerald-50/50 dark:bg-emerald-950/10",
            border: "border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700/50",
            text: "text-emerald-600 dark:text-emerald-400",
            glow: "shadow-emerald-500/5 dark:shadow-emerald-500/10"
        },
        stats: `${AUDIT_TEMPLATES.federasyon?.length || 8} Standart Soru`
    },
    {
        id: "kyk",
        title: "KYK Yurt Denetimi",
        description: "Öğrenci yurtlarının barınma şartları, yemekhane/kantin hijyen kontrolleri, güvenlik sistemleri ve genel işletme faaliyetlerinin teftişi.",
        path: "/denetim/kyk",
        icon: Building2,
        color: {
            bg: "bg-amber-50/50 dark:bg-amber-950/10",
            border: "border-amber-100 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700/50",
            text: "text-amber-600 dark:text-amber-400",
            glow: "shadow-amber-500/5 dark:shadow-amber-500/10"
        },
        stats: `${AUDIT_TEMPLATES.kyk?.length || 5} Standart Soru`
    },
    {
        id: "ozel",
        title: "Özel Yurt Denetimi",
        description: "Özel öğrenci yurtlarının ruhsatlandırma, yangın güvenliği, barınma kapasiteleri, personel izinleri ve mevzuata uygunluk denetimleri.",
        path: "/denetim/ozel",
        icon: ClipboardCheck,
        color: {
            bg: "bg-rose-50/50 dark:bg-rose-950/10",
            border: "border-rose-100 dark:border-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700/50",
            text: "text-rose-600 dark:text-rose-400",
            glow: "shadow-rose-500/5 dark:shadow-rose-500/10"
        },
        stats: `${AUDIT_TEMPLATES.ozel?.length || 8} Standart Soru`
    },
    {
        id: "spor",
        title: "Spor Kulübü Denetimi",
        description: "Spor kulübü derneklerinin üye kayıtları, tescil işlemleri, antrenör vizeleri, karar defterleri ve mali kaynaklarının mevzuata uygunluk teftişi.",
        path: "/denetim/spor",
        icon: Activity,
        color: {
            bg: "bg-indigo-50/50 dark:bg-indigo-950/10",
            border: "border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700/50",
            text: "text-indigo-600 dark:text-indigo-400",
            glow: "shadow-indigo-500/5 dark:shadow-indigo-500/10"
        },
        stats: `${AUDIT_TEMPLATES.spor?.length || 105} Standart Soru`
    },
    {
        id: "bilgi_bankasi",
        title: "AI Bilgi Bankası",
        description: "Müfettişlik raporlarında ve teftiş süreçlerinde kullanılabilecek, yapay zeka destekli ortak tenkit metinleri kütüphanesi ve mevzuat havuzu.",
        path: "/denetim/bilgi-bankasi",
        icon: Bot,
        color: {
            bg: "bg-slate-50/50 dark:bg-slate-900/10",
            border: "border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700",
            text: "text-slate-700 dark:text-slate-300",
            glow: "shadow-slate-500/5 dark:shadow-slate-500/10"
        },
        stats: "Yapay Zeka Kütüphanesi"
    }
];

export default function Denetim() {
    const navigate = useNavigate();
    const { data: cachedData } = useGlobalData();

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-12 pr-2 lg:pr-4 pl-2 lg:pl-2">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-6 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Denetim Modülleri</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        Denetim Kontrol Paneli
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                        Yürütmekte olduğunuz teftiş türünü seçerek ilgili denetim ekranına, soru havuzlarına ve yan modüllere erişebilirsiniz.
                    </p>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {CARDS.map(card => {
                    const Icon = card.icon;
                    
                    // Calculate task counts
                    const hasTasks = card.id !== "bilgi_bankasi";
                    const totalTasks = hasTasks 
                        ? cachedData?.tasks?.filter((t: any) => t.rapor_turu === categoryMap[card.id]).length || 0
                        : 0;
                    const activeTasks = hasTasks
                        ? cachedData?.tasks?.filter((t: any) => 
                            t.rapor_turu === categoryMap[card.id] && 
                            t.rapor_durumu !== "Tamamlandı" && 
                            t.rapor_durumu !== "Askıya Alındı"
                          ).length || 0
                        : 0;

                    return (
                        <div
                            key={card.id}
                            onClick={() => navigate(card.path)}
                            className={`group relative flex flex-col justify-between bg-white dark:bg-slate-900/35 border ${card.color.border} rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${card.color.glow}`}
                        >
                            <div className="space-y-4">
                                {/* Card Header with Icon & Badges */}
                                <div className="flex items-start justify-between">
                                    <div className={`w-12 h-12 rounded-2xl ${card.color.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
                                        <Icon size={22} className={card.color.text} />
                                    </div>
                                    
                                    {hasTasks && totalTasks > 0 ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                Denetim Görevleri
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {activeTasks > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                        {activeTasks} Aktif
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                    {totalTasks} Toplam
                                                </span>
                                            </div>
                                        </div>
                                    ) : hasTasks ? (
                                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500">
                                            Görev Yok
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500">
                                            AI Destekli
                                        </span>
                                    )}
                                </div>

                                {/* Title & Description */}
                                <div className="space-y-2">
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-primary transition-colors">
                                        {card.title}
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed">
                                        {card.description}
                                    </p>
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50 pt-4 mt-6">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${card.color.text}`}>
                                    {card.stats}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-primary dark:group-hover:text-slate-350 transition-colors">
                                    <span>Giriş Yap</span>
                                    <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
