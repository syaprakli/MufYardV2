import { FileText, Loader2, AlertCircle, Clock, CheckCircle2, TrendingUp, Filter, FileSpreadsheet, Zap, Bell, ArrowUpRight, BarChart3, PieChart as PieIcon, Shield, ChevronRight, X, Download, Bot, Sparkles, ExternalLink, Globe, BookOpen } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { fetchStats } from "../lib/api";
import { API_URL } from "../lib/config";
import { fetchTasks, type Task } from "../lib/api/tasks";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { useTheme } from "../lib/context/ThemeContext";
import { fetchProfile } from "../lib/api/profiles";
import { toast } from "react-hot-toast";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend
} from 'recharts';
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

// Premium Color Palette with Dark Mode support
const COLORS = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-900/30', text: 'text-blue-700 dark:text-blue-400', chart: '#3b82f6' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', chart: '#10b981' },
    rose: { bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-100 dark:border-rose-900/30', text: 'text-rose-700 dark:text-rose-400', chart: '#f43f5e' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-100 dark:border-amber-900/30', text: 'text-amber-700 dark:text-amber-400', chart: '#f59e0b' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/20', border: 'border-indigo-100 dark:border-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', chart: '#6366f1' },
    slate: { bg: 'bg-slate-50 dark:bg-slate-800/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', chart: '#64748b' }
};

// Mock Chart Data


const RAPOR_DURUMLARI = ["Başlanmadı", "Devam Ediyor", "Evrak Bekleniyor", "İncelemede", "Tamamlandı"];

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
    if (diff >= total / 2) return "#10b981"; // Yeşil
    if (diff >= 0) return "#3b82f6";        // Mavi
    if (diff >= -30) return "#fbbf24";     // Sarı
    if (diff >= -90) return "#f97316";     // Turuncu
    return "#ef4444";                      // Kırmızı
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme } = useTheme();
    const [data, setData] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // ─── Filtre State ───
    const [showFilters, setShowFilters] = useState(false);
    const [filterType, setFilterType] = useState<string>("Tümü");
    const [filterStatus, setFilterStatus] = useState<string>("Tümü");
    const [filterPeriod, setFilterPeriod] = useState<string>("Tümü");
    const filterRef = useRef<HTMLDivElement>(null);

    // ─── Analiz Raporu State ───
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisText, setAnalysisText] = useState("");
    const [analysisLoading, setAnalysisLoading] = useState(false);
    
    // Get identity once from useAuth or fallback (same as Tasks.tsx)
    const currentUser = user || JSON.parse(localStorage.getItem('demo_user') || '{"email": "mufettis@gsb.gov.tr", "uid": "mufettis@gsb.gov.tr"}');
    const effectiveUid = currentUser.uid;

    // Filtre dışı tıklama
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilters(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!effectiveUid) return;
            try {
                const [statsResult, tasksResult, profileResult] = await Promise.allSettled([
                    fetchStats(),
                    fetchTasks(effectiveUid),
                    fetchProfile(effectiveUid, currentUser.email || undefined)
                ]);

                const stats =
                    statsResult.status === "fulfilled"
                        ? statsResult.value
                        : { stats: [], news: [] };
                const taskList =
                    tasksResult.status === "fulfilled"
                        ? tasksResult.value
                        : [];
                
                const myTasks = taskList.filter((t: any) => 
                    t.owner_id === effectiveUid || 
                    t.accepted_collaborators?.includes(effectiveUid)
                );

                const profileData = 
                    profileResult.status === "fulfilled"
                        ? profileResult.value
                        : null;

                setData(stats);
                setTasks(myTasks);
                setProfile(profileData);
            } catch (err) {
                console.error("Dashboard yüklenirken hata:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [effectiveUid]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sistem Yükleniyor...</p>
            </div>
        );
    }

    const todayStr = new Intl.DateTimeFormat('tr-TR', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    }).format(new Date());

    // ─── Filtreleme Mantığı ───
    const filteredTasks = tasks.filter(task => {
        // Tür filtresi
        if (filterType !== "Tümü" && task.rapor_turu !== filterType) return false;
        // Durum filtresi
        if (filterStatus !== "Tümü") {
            if (filterStatus === "Gecikmiş") {
                const start = new Date(task.baslama_tarihi);
                const end = new Date(start);
                end.setDate(end.getDate() + task.sure_gun);
                const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
                if (diff >= 0 || task.rapor_durumu === "Tamamlandı") return false;
            } else if (task.rapor_durumu !== filterStatus) return false;
        }
        // Tarih filtresi
        if (filterPeriod !== "Tümü") {
            const taskDate = new Date(task.baslama_tarihi);
            const now = new Date();
            if (filterPeriod === "Bu Ay") {
                if (taskDate.getMonth() !== now.getMonth() || taskDate.getFullYear() !== now.getFullYear()) return false;
            } else if (filterPeriod === "Son 3 Ay") {
                const threeMonths = new Date();
                threeMonths.setMonth(threeMonths.getMonth() - 3);
                if (taskDate < threeMonths) return false;
            } else if (filterPeriod === "Bu Yıl") {
                if (taskDate.getFullYear() !== now.getFullYear()) return false;
            }
        }
        return true;
    });

    const isFilterActive = filterType !== "Tümü" || filterStatus !== "Tümü" || filterPeriod !== "Tümü";
    const clearFilters = () => { setFilterType("Tümü"); setFilterStatus("Tümü"); setFilterPeriod("Tümü"); };

    // ─── Türleri topla (filtre dropdown için) ───
    const uniqueTypes = [...new Set(tasks.map(t => t.rapor_turu))];

    // ─── Excel'e Aktar ───
    const handleExportExcel = () => {
        import("xlsx")
            .then((XLSX) => {
                const exportData = filteredTasks.map(task => {
                    const start = new Date(task.baslama_tarihi);
                    const end = new Date(start);
                    end.setDate(end.getDate() + task.sure_gun);
                    const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
                    return {
                        "Rapor No": task.rapor_kodu,
                        "Görev Adı": task.rapor_adi,
                        "Tür": task.rapor_turu,
                        "Başlama Tarihi": task.baslama_tarihi,
                        "Süre (Gün)": task.sure_gun,
                        "Kalan Gün": diff,
                        "Durum": task.rapor_durumu,
                    };
                });
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Görevler");
                ws["!cols"] = [{ wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
                XLSX.writeFile(wb, `MufYard_Gorevler_${new Date().toISOString().slice(0, 10)}.xlsx`);
                toast.success("Excel dosyası indirildi!");
            })
            .catch((err) => {
                console.error("Excel export yüklenemedi:", err);
                toast.error("Excel modülü yüklenemedi.");
            });
    };

    // ─── AI Analiz Raporu ───
    const handleAnalysis = async () => {
        setShowAnalysis(true);
        setAnalysisLoading(true);
        setAnalysisText("");
        try {
            const summary = {
                toplam: tasks.length,
                aktif: tasks.filter(t => t.rapor_durumu !== "Tamamlandı").length,
                tamamlanan: tasks.filter(t => t.rapor_durumu === "Tamamlandı").length,
                geciken: tasks.filter(t => {
                    const s = new Date(t.baslama_tarihi);
                    const e = new Date(s); e.setDate(e.getDate() + t.sure_gun);
                    return Math.ceil((e.getTime() - Date.now()) / (1000 * 3600 * 24)) < 0 && t.rapor_durumu !== "Tamamlandı";
                }).length,
                turler: Object.entries(tasks.reduce((acc: Record<string, number>, t) => { acc[t.rapor_turu] = (acc[t.rapor_turu] || 0) + 1; return acc; }, {})),
                durumlar: Object.entries(tasks.reduce((acc: Record<string, number>, t) => { acc[t.rapor_durumu] = (acc[t.rapor_durumu] || 0) + 1; return acc; }, {})),
                gorevler: tasks.map(t => {
                    const s = new Date(t.baslama_tarihi);
                    const e = new Date(s); e.setDate(e.getDate() + t.sure_gun);
                    return `${t.rapor_kodu} - ${t.rapor_adi} (${t.rapor_turu}) — Durum: ${t.rapor_durumu}, Kalan: ${Math.ceil((e.getTime() - Date.now()) / (1000 * 3600 * 24))} gün`;
                }),
            };
            const message = `Aşağıdaki müfettişlik görev verilerini analiz et ve detaylı bir performans raporu yaz.

GÖREV İSTATİSTİKLERİ:
- Toplam görev: ${summary.toplam}
- Aktif görev: ${summary.aktif}
- Tamamlanan: ${summary.tamamlanan}
- Geciken: ${summary.geciken}
- Tür dağılımı: ${summary.turler.map(([k, v]) => `${k}: ${v}`).join(", ")}
- Durum dağılımı: ${summary.durumlar.map(([k, v]) => `${k}: ${v}`).join(", ")}

GÖREV DETAYLARI:
${summary.gorevler.join("\n")}

Lütfen şunları analiz et:
1. Genel performans değerlendirmesi
2. Gecikme analizi ve risk değerlendirmesi
3. Tür bazlı verimlilik
4. Öneriler ve aksiyon planı`;

            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetchWithTimeout(`${API_URL}/ai/chat`, {
                method: "POST",
                headers,
                body: JSON.stringify({ message, context: "analysis" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.detail || "Analiz başarısız");
            setAnalysisText(data.response || "Analiz sonucu alınamadı.");
        } catch (err: any) {
            setAnalysisText(`Analiz sırasında hata oluştu: ${err?.message || "Bilinmeyen hata"}`);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const sanitizeAnalysisHtml = (text: string) => {
        const markdownToStrong = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        const removeScriptBlocks = markdownToStrong.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
        const keepSafeTagsOnly = removeScriptBlocks.replace(/<(?!\/?(strong|br)\b)[^>]*>/gi, "");
        return keepSafeTagsOnly;
    };

    const stripTags = (text: string) => text.replace(/<[^>]*>/g, "");


    // Process Task Status Data (filtrelenmiş veriye göre)
    const statusCounts = RAPOR_DURUMLARI.map(status => ({
        name: status,
        value: filteredTasks.filter(t => t.rapor_durumu === status).length,
        color: getDurumColor(status)
    })).filter(s => s.value > 0);

    // Process Deadline Data
    const sureData = [
        { name: 'Süresi Var', value: 0, color: '#10b981' },
        { name: '0-1 Ay Gecikti', value: 0, color: '#fbbf24' },
        { name: '1-3 Ay Gecikti', value: 0, color: '#f97316' },
        { name: '3 Ay+ Gecikti', value: 0, color: '#ef4444' },
    ];

    filteredTasks.forEach(task => {
        const start = new Date(task.baslama_tarihi);
        const end = new Date(start);
        end.setDate(end.getDate() + task.sure_gun);
        const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));

        if (diff >= 0) sureData[0].value++;
        else if (diff >= -30) sureData[1].value++;
        else if (diff >= -90) sureData[2].value++;
        else sureData[3].value++;
    });

    // Calculations for Summary StatCards
    const activeTasksCount = filteredTasks.filter(t => t.rapor_durumu !== "Tamamlandı" && t.rapor_durumu !== "Askıya Alındı").length;
    const completedTasksCount = filteredTasks.filter(t => t.rapor_durumu === "Tamamlandı").length;
    
    // Calculate "Acil" (Urgent) tasks: e.g., less than 0 days (overdue) or in critique status
    const urgentTasksCount = filteredTasks.filter(task => {
        const start = new Date(task.baslama_tarihi);
        const end = new Date(start);
        end.setDate(end.getDate() + task.sure_gun);
        const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
        return diff < 0 && task.rapor_durumu !== "Tamamlandı";
    }).length;

    // Process Type Data
    const typesMap: Record<string, number> = {};
    filteredTasks.forEach(t => {
        typesMap[t.rapor_turu] = (typesMap[t.rapor_turu] || 0) + 1;
    });
    const typeData = Object.entries(typesMap).map(([name, value], idx) => ({
        name,
        value,
        color: Object.values(COLORS)[idx % 6].chart
    }));

    return (
        <div className="max-w-[1600px] mx-auto space-y-4 lg:space-y-8 animate-in fade-in duration-500 pb-12 pr-2 lg:pr-4 pl-2 lg:pl-2">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 lg:mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Genel Bakış</span>
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        Hoş Geldiniz, <span className="text-primary">{profile?.full_name?.split(' ')[0] || user?.displayName?.split(' ')[0] || "Müfettiş"}</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-1">
                         <span className="flex items-center gap-1.5 text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-tighter">
                            <Clock size={14} className="text-primary/40" /> {todayStr}
                         </span>
                         <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[9px] lg:text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sistem Aktif</span>
                         </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none" ref={filterRef}>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn(
                                "w-full lg:w-auto bg-card border-slate-100 dark:border-slate-800 border font-bold text-[11px] rounded-xl px-4 h-11 transition-all",
                                isFilterActive ? "border-primary text-primary" : "text-slate-500"
                            )}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter size={14} className="mr-2" /> Filtrele
                        </Button>

                        {/* ─── Filtre Dropdown ─── */}
                        {showFilters && (
                            <div className="absolute left-0 lg:right-0 lg:left-auto top-14 z-50 bg-card border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-black/40 p-5 w-[280px] sm:w-[320px] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtreler</span>
                                    {isFilterActive && (
                                        <button onClick={clearFilters} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors">
                                            Temizle
                                        </button>
                                    )}
                                </div>

                                {/* Tür */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Rapor Türü</label>
                                    <select 
                                        value={filterType} 
                                        onChange={e => setFilterType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-semibold text-slate-700 dark:text-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    >
                                        <option value="Tümü">Tümü</option>
                                        {uniqueTypes.map(t => <option key={t} value={t} className="dark:bg-slate-900">{t}</option>)}
                                    </select>
                                </div>

                                {/* Durum */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Durum</label>
                                    <select 
                                        value={filterStatus} 
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="w-full rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-semibold text-slate-700 dark:text-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    >
                                        <option value="Tümü" className="dark:bg-slate-900">Tümü</option>
                                        {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="dark:bg-slate-900">{d}</option>)}
                                        <option value="Gecikmiş" className="dark:bg-slate-900">Gecikmiş</option>
                                    </select>
                                </div>

                                {/* Dönem */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Dönem</label>
                                    <select 
                                        value={filterPeriod} 
                                        onChange={e => setFilterPeriod(e.target.value)}
                                        className="w-full rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-semibold text-slate-700 dark:text-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    >
                                        <option value="Tümü" className="dark:bg-slate-900">Tümü</option>
                                        <option value="Bu Ay" className="dark:bg-slate-900">Bu Ay</option>
                                        <option value="Son 3 Ay" className="dark:bg-slate-900">Son 3 Ay</option>
                                        <option value="Bu Yıl" className="dark:bg-slate-900">Bu Yıl</option>
                                    </select>
                                </div>

                                <div className="text-[10px] font-semibold text-slate-400 text-center pt-1">
                                    {filteredTasks.length} / {tasks.length} görev
                                </div>
                            </div>
                        )}
                    </div>
                    <Button 
                        size="sm" 
                        className="flex-1 lg:flex-none rounded-xl font-bold text-[11px] px-5 shadow-lg shadow-primary/20 h-11"
                        onClick={handleAnalysis}
                    >
                        <Sparkles size={14} className="mr-2" /> Analiz
                    </Button>
                </div>
            </div>

            {/* Main Stats Row: 4 Integrated Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Aktif Denetimler" 
                    value={activeTasksCount.toString()} 
                    trend={`${activeTasksCount > 0 ? "+0" : ""} bu hafta`}
                    icon={FileText} 
                    style={COLORS.blue}
                />
                {/* 2. Tamamlanan Raporlar (Dinamik) */}
                <StatCard 
                    title="Tamamlanan Raporlar" 
                    value={completedTasksCount.toString()} 
                    trend="Toplam"
                    icon={CheckCircle2} 
                    style={COLORS.green}
                />
                {/* 3. ACİL GÖREVLER (Süresi Geçenler) */}
                <StatCard 
                    title="Acil Görevler" 
                    value={urgentTasksCount.toString()} 
                    trend={urgentTasksCount > 0 ? "İvedi Müdahale" : "Her Şey Yolunda"}
                    icon={AlertCircle} 
                    style={COLORS.rose}
                    isAlert={urgentTasksCount > 0}
                />
                {/* 4. Performans Skoru */}
                <StatCard 
                    title="Performans Skoru" 
                    value={completedTasksCount > 0 ? `%${Math.min(100, Math.round((completedTasksCount / (tasks.length || 1)) * 100))}` : "%0"} 
                    trend="Başarı Oranı"
                    icon={Zap} 
                    style={COLORS.amber}
                />
            </div>

            {/* Charts Section: Pastel & Integrated Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Süre Durumu */}
                <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                        <BarChart3 size={16} className="text-slate-400" />
                        <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Görev Süre Durumu</h3>
                    </div>
                    <div className="h-[300px] w-full relative">
                        {sureData.every(d => d.value === 0) ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                            <BarChart data={sureData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={(theme as string) === 'dark' ? '#1e293b' : '#f8fafc'} />
                                <XAxis 
                                    dataKey="name" 
                                    fontSize={9} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    fontWeight={900}
                                    interval={0} 
                                    angle={-35}
                                    textAnchor="end"
                                    height={50}
                                    stroke={(theme as string) === 'dark' ? '#94a3b8' : '#64748b'}
                                    className="font-outfit"
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    fontSize={10} 
                                    fontWeight="bold" 
                                    domain={[0, (dataMax: number) => Math.max(dataMax, 10)]} 
                                    allowDecimals={false}
                                    stroke={(theme as string) === 'dark' ? '#94a3b8' : '#64748b'}
                                    className="font-outfit"
                                />
                                <Tooltip cursor={{fill: (theme as string) === 'dark' ? '#0f172a' : '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', background: (theme as string) === 'dark' ? '#1e293b' : '#ffffff', color: (theme as string) === 'dark' ? '#f1f5f9' : '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.25)'}} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                                    {sureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Görev Türü Dağılımı */}
                <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
                     <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                        <PieIcon size={16} className="text-slate-400" />
                        <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Görev Türü Analizi</h3>
                    </div>
                    <div className="h-[300px] w-full relative">
                        {typeData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                                    paddingAngle={5} dataKey="value" strokeWidth={0}
                                >
                                    {typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                            </PieChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Rapor Yazım Durumu */}
                <Card className="p-6 border-slate-100 dark:border-slate-800 shadow-none dark:bg-slate-900">
                     <div className="flex items-center gap-2 mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                        <FileText size={16} className="text-slate-400" />
                        <h3 className="font-black text-[11px] text-slate-500 uppercase tracking-widest">Rapor Yazım Süreci</h3>
                    </div>
                    <div className="h-[300px] w-full relative">
                        {statusCounts.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold">Henüz veri yok</div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={statusCounts}
                                    cx="50%" cy="50%" innerRadius={60} outerRadius={85}
                                    paddingAngle={5} dataKey="value" strokeWidth={0}
                                >
                                    {statusCounts.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                            </PieChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            {/* Duyurular + Hızlı Erişim yan yana */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sistem Duyuruları */}
                <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-sm bg-card xl:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className="text-primary" />
                            <h3 className="font-black text-[11px] text-slate-800 dark:text-slate-200 uppercase tracking-widest">Sistem Duyuruları</h3>
                        </div>
                        <Button 
                            variant="link" 
                            className="text-[10px] font-black uppercase text-primary tracking-[0.2em] group hover:no-underline font-outfit"
                            onClick={() => navigate('/public-space', { state: { category: 'Duyurular' } })}
                        >
                            Tümünü Gör <TrendingUp size={14} className="ml-2 group-hover:translate-x-1 transition-transform opacity-60" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data?.news?.map((news: any, index: number) => (
                            <div 
                                key={index} 
                                onClick={() => navigate('/public-space', { state: { category: 'Duyurular', postId: news.id } })}
                                className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-primary/5 text-primary rounded-md">{news.category}</span>
                                    <span className="text-[9px] font-bold text-slate-400">{news.date}</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed group-hover:text-primary transition-colors">{news.title}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Hızlı Erişim */}
                <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-sm bg-card">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe size={14} className="text-primary" />
                        <h3 className="font-black text-[10px] text-slate-800 dark:text-slate-200 uppercase tracking-widest">Hızlı Erişim</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { name: "BelgeNET", url: "https://belgenet.gsb.gov.tr/", icon: FileText, color: "#3b82f6" },
                            { name: "Mevzuat", url: "https://www.mevzuat.gov.tr/", icon: BookOpen, color: "#8b5cf6" },
                            { name: "GSB Mevzuat", url: "https://gsb.gov.tr/tr/sayfa/36-mevzuat", icon: Shield, color: "#059669" },
                            { name: "Resmi Gazete", url: "https://www.resmigazete.gov.tr/", icon: FileSpreadsheet, color: "#dc2626" },
                            { name: "E-Posta", url: "https://eposta.gsb.gov.tr/my.policy", icon: Bell, color: "#f59e0b" },
                            { name: "Kurumsal", url: "https://kurumsal.gsb.gov.tr/login", icon: ExternalLink, color: "#0ea5e9" },
                        ].map((link) => (
                            <a
                                key={link.name}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2.5 bg-white dark:bg-slate-950 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all group"
                            >
                                <link.icon size={14} style={{ color: link.color }} className="flex-shrink-0" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors truncate">{link.name}</span>
                            </a>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Alt Bölüm: Görevler (Özet) Tablosu (Görsele Birebir) */}
            <Card className="p-0 overflow-hidden shadow-none border-slate-100 dark:border-slate-800 bg-card">
                <div className="p-4 md:p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card">
                    <h3 className="font-black text-lg md:text-xl text-slate-900 dark:text-slate-100 font-outfit tracking-tight">Görevler (Özet)</h3>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto bg-card border-slate-100 dark:border-slate-800 border text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl px-4 h-10 hover:border-primary/20 hover:text-primary transition-all"
                        onClick={handleExportExcel}
                    >
                        <Download size={16} className="mr-2 opacity-60" /> Excel'e Aktar
                    </Button>
                </div>
                
                {/* Mobile List View (Hidden on Desktop) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTasks.slice(0, 5).map(task => {
                         const start = new Date(task.baslama_tarihi);
                         const end = new Date(start);
                         end.setDate(end.getDate() + task.sure_gun);
                         const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
                         const total = task.sure_gun;
                         const color = getKalanColor(diff, total);
                         const statusColor = getDurumColor(task.rapor_durumu);

                         return (
                             <div key={task.id} className="p-4 space-y-3">
                                 <div className="flex justify-between items-start">
                                     <div className="space-y-1">
                                         <span className="text-[10px] font-black text-primary tracking-widest">{task.rapor_kodu}</span>
                                         <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{task.rapor_adi}</h4>
                                     </div>
                                     <span 
                                         className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter"
                                         style={{ backgroundColor: statusColor + '15', color: statusColor }}
                                     >
                                         {task.rapor_durumu}
                                     </span>
                                 </div>
                                 <div className="flex items-center justify-between text-[11px] font-bold">
                                     <span className="text-slate-400">{task.rapor_turu}</span>
                                     <span className="flex items-center gap-1.5" style={{ color }}>
                                         <Clock size={12} /> {diff} Gün
                                     </span>
                                 </div>
                             </div>
                         );
                    })}
                </div>

                {/* Desktop Table View (Hidden on Mobile) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#f8fafc]/50 dark:bg-slate-950/50 text-slate-400/80 font-black uppercase text-[11px] tracking-[0.15em] border-b border-slate-100 dark:border-slate-800 font-outfit">
                            <tr>
                                <th className="px-6 py-5 text-left">Rapor No</th>
                                <th className="px-6 py-5 text-left">Görev Adı</th>
                                <th className="px-6 py-5 text-left">Tür</th>
                                <th className="px-6 py-5 text-left text-center">Kalan</th>
                                <th className="px-6 py-5 text-center">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredTasks.slice(0, 5).map(task => {
                                const start = new Date(task.baslama_tarihi);
                                const end = new Date(start);
                                end.setDate(end.getDate() + task.sure_gun);
                                const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
                                const total = task.sure_gun;
                                const color = getKalanColor(diff, total);
                                
                                return (
                                    <TableRow 
                                        key={task.id}
                                        code={task.rapor_kodu} 
                                        title={task.rapor_adi} 
                                        type={task.rapor_turu} 
                                        status={task.rapor_durumu} 
                                        diff={diff}
                                        total={total}
                                        rawColor={color}
                                        rawStatusColor={getDurumColor(task.rapor_durumu)}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-card flex justify-end items-center border-t border-slate-50 dark:border-slate-800">
                    <Button 
                        variant="link" 
                        size="sm" 
                        className="text-primary font-black text-[10px] uppercase tracking-[0.2em] group hover:no-underline font-outfit"
                        onClick={() => navigate('/tasks')}
                    >
                        Tümünü Gör <TrendingUp size={14} className="ml-2 group-hover:translate-x-1 transition-transform opacity-60" />
                    </Button>
                </div>
            </Card>

            {/* ─── AI Analiz Raporu Drawer ─── */}
            {showAnalysis && createPortal(
                <div className="fixed inset-0 z-[1000] flex justify-end">
                    {/* Overlay */}
                    <div 
                        className="absolute inset-0 bg-black/30 backdrop-blur-md animate-in fade-in duration-200"
                        onClick={() => setShowAnalysis(false)}
                    />
                    {/* Drawer */}
                    <div className="relative w-full max-w-xl bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-slate-100 dark:border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <Bot size={18} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 tracking-tight">AI Performans Analizi</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gemini ile oluşturuldu</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowAnalysis(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {analysisLoading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analiz Oluşturuluyor...</p>
                                    <p className="text-xs text-slate-400">AI görev verilerini inceliyor</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none 
                                    prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-800 dark:prose-headings:text-slate-100
                                    prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                                    prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-slate-600 dark:prose-p:text-slate-400
                                    prose-li:text-[13px] prose-li:text-slate-600 dark:prose-li:text-slate-400
                                    prose-strong:text-slate-800 dark:prose-strong:text-slate-100
                                ">
                                    {analysisText.split('\n').map((line, i) => {
                                        if (line.startsWith('###')) return <h3 key={i}>{stripTags(line.replace(/^###\s*/, ''))}</h3>;
                                        if (line.startsWith('##')) return <h2 key={i}>{stripTags(line.replace(/^##\s*/, ''))}</h2>;
                                        if (line.startsWith('#')) return <h1 key={i}>{stripTags(line.replace(/^#\s*/, ''))}</h1>;
                                        if (line.startsWith('- ') || line.startsWith('* ')) {
                                            const cleanLine = sanitizeAnalysisHtml(line.replace(/^[-*]\s*/, ''));
                                            return <p key={i} dangerouslySetInnerHTML={{ __html: `• ${cleanLine}` }} />;
                                        }
                                        if (line.trim() === '') return <br key={i} />;
                                        return <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeAnalysisHtml(line) }} />;
                                    })}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        {!analysisLoading && analysisText && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 bg-white/50 dark:bg-slate-900/50">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="flex-1 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                    onClick={() => {
                                        navigator.clipboard.writeText(analysisText);
                                        toast.success("Analiz kopyalandı!");
                                    }}
                                >
                                    Kopyala
                                </Button>
                                <Button 
                                    size="sm" 
                                    className="flex-1 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                    onClick={handleAnalysis}
                                >
                                    <Sparkles size={12} className="mr-1.5" /> Yeniden Analiz
                                </Button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function TableRow({ code, title, type, status, diff, rawColor, rawStatusColor }: any) {
    return (
        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
            <td className="px-6 py-5 font-black text-primary dark:text-primary-light text-[10px] tracking-wider font-outfit">{code}</td>
            <td className="px-6 py-5 font-bold text-slate-800 dark:text-slate-200 text-[13px] font-inter">{title}</td>
            <td className="px-6 py-5 text-[11px] font-bold text-slate-500/80 dark:text-slate-400 font-inter">{type}</td>
            <td className="px-6 py-4">
                <span style={{ 
                    fontSize: "0.75rem", 
                    padding: "0.25rem 0.5rem", 
                    borderRadius: "0.5rem", 
                    backgroundColor: rawColor + "15", 
                    color: rawColor, 
                    fontWeight: 700 
                }}>
                    {diff} Gün
                </span>
            </td>
            <td className="px-6 py-4 text-center">
                <span 
                    style={{ 
                        fontSize: "0.68rem",
                        padding: "0.3rem 0.7rem",
                        borderRadius: "0.5rem",
                        backgroundColor: rawStatusColor + "15",
                        color: rawStatusColor,
                        fontWeight: 900,
                        display: "inline-block",
                        letterSpacing: "0.02em"
                    }}
                >
                    {status}
                </span>
            </td>
        </tr>
    );
}


function StatCard({ title, value, trend, icon: Icon, isAlert, style }: any) {
    return (
        <Card 
            className={cn(
                "p-5 border-none shadow-none transition-all group",
                style?.bg || (isAlert ? "bg-rose-50 dark:bg-rose-950/20" : "bg-card"),
                "border dark:border-slate-800",
                style?.border || (isAlert ? "border-rose-100 dark:border-rose-900/30" : "border-slate-100 dark:border-slate-800")
            )}
        >
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</p>
                    <p className={cn("text-2xl font-black tracking-tighter", style?.text || (isAlert ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-100"))}>{value}</p>
                    <p className={cn("text-[9px] font-bold flex items-center gap-1", isAlert ? "text-rose-400 dark:text-rose-500" : "text-emerald-500")}>
                        {isAlert ? <AlertCircle size={10} /> : <ArrowUpRight size={10} />} {trend}
                    </p>
                </div>
                <div className={cn("p-3 rounded-xl transition-all", isAlert ? "bg-rose-100 dark:bg-rose-900/30" : "bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/5 dark:group-hover:bg-primary/20")}>
                    <Icon size={20} className={cn(isAlert ? "text-rose-500 dark:text-rose-400" : "text-slate-400 dark:text-slate-500 group-hover:text-primary dark:group-hover:text-primary-light")} />
                </div>
            </div>
        </Card>
    );
}
