import { useState, useEffect } from "react";
import { 
    Key, Plus, Trash2, CheckCircle2, 
    Loader2, Shield, Copy, RefreshCw, ChevronRight,
    Search, Calendar, User, ArrowLeft, RotateCcw, Ban
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { 
    fetchLicenses, generateLicense, deleteLicense, 
    bulkDeleteLicenses, resetTrial, cancelPremium 
} from "../lib/api/profiles";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useNavigate } from "react-router-dom";

export default function AdminLicenses() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const confirm = useConfirm();
    
    console.log("AdminLicenses Version: 2.1 (Bulk Actions Fixed)");

    const isFounder = user?.email === "sefayaprakli@hotmail.com" || 
                      user?.email === "sefa.yaprakli@gsb.gov.tr" ||
                      user?.email === "syaprakli@gmail.com";

    useEffect(() => {
        if (!isFounder && user) {
            toast.error("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
            navigate("/");
        }
    }, [isFounder, user, navigate]);

    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all');
    const [durationFilter, setDurationFilter] = useState<number | 'all'>('all');
    const [selectedDuration, setSelectedDuration] = useState(0); // 0 = Sınırsız
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        try {
            setLoading(true);
            const data = await fetchLicenses();
            setLicenses(data);
        } catch (error) {
            toast.error("Lisanslar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const res = await generateLicense(selectedDuration);
            if (res && res.key) {
                toast.success("Yeni lisans anahtarı başarıyla üretildi.");
                await loadLicenses();
            } else {
                toast.error("Lisans üretilemedi.");
            }
        } catch (error: any) {
            toast.error(error.message || "Lisans üretilirken hata oluştu.");
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (license: any) => {
        const isUsed = license.is_used;
        const message = isUsed 
            ? `DİKKAT: "${license.key}" anahtarı şu an ${license.used_by_email || 'bir kullanıcı'} tarafından kullanılıyor!\n\nBu lisansı silmek kullanıcının Pro durumunu etkileyebilir. Yine de kalıcı olarak silmek istediğinize emin misiniz?`
            : `"${license.key}" lisans anahtarını silmek istediğinize emin misiniz?`;

        const confirmed = await confirm({
            title: "Lisans Silme Onayı",
            message: message,
            confirmText: "Kalıcı Olarak Sil",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            const success = await deleteLicense(license.key);
            if (success) {
                toast.success("Lisans başarıyla silindi.");
                loadLicenses();
                setSelectedKeys(prev => prev.filter(k => k !== license.key));
            } else {
                toast.error("Lisans silinemedi (Kullanılmış olabilir).");
            }
        } catch (error) {
            toast.error("Silme işlemi başarısız oldu.");
        }
    };

    const handleResetTrial = async (license: any) => {
        if (!license.used_by) return;

        const confirmed = await confirm({
            title: "Deneme Sürümü Sıfırlama",
            message: `"${license.used_by_email}" kullanıcısının hesabını tamamen SIFIRLAYIP 30 günlük deneme sürümüne döndürmek istediğinize emin misiniz?`,
            confirmText: "Evet, Sıfırla",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            setLoading(true);
            const success = await resetTrial(license.used_by);
            if (success) {
                toast.success("Kullanıcı başarıyla deneme sürümüne sıfırlandı.");
                loadLicenses();
            } else {
                toast.error("Sıfırlama işlemi başarısız oldu.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelPremium = async (license: any) => {
        if (!license.used_by) return;

        const confirmed = await confirm({
            title: "PRO Üyelik İptali",
            message: `"${license.used_by_email}" kullanıcısının PRO üyeliğini iptal etmek istediğinize emin misiniz? (Deneme süresine dokunulmaz)`,
            confirmText: "Evet, İptal Et",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            setLoading(true);
            const success = await cancelPremium(license.used_by);
            if (success) {
                toast.success("PRO üyelik başarıyla iptal edildi.");
                loadLicenses();
            } else {
                toast.error("İptal işlemi başarısız oldu.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedKeys.length === 0) return;
        
        const confirmed = await confirm({
            title: "Toplu Silme Onayı",
            message: `${selectedKeys.length} adet lisans anahtarını silmek istediğinize emin misiniz? (Sadece kullanılmamış olanlar silinecektir)`,
            confirmText: "Seçilenleri Sil",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            setLoading(true);
            const result = await bulkDeleteLicenses(selectedKeys);
            toast.success(`${result.success} adet lisans silindi. ${result.error} adet silinemedi.`);
            await loadLicenses();
            setSelectedKeys([]);
        } catch (error: any) {
            toast.error(error.message || "Toplu silme işlemi sırasında hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedKeys.length === filteredLicenses.length) {
            setSelectedKeys([]);
        } else {
            setSelectedKeys(filteredLicenses.map(l => l.key));
        }
    };

    const toggleSelect = (key: string) => {
        setSelectedKeys(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Kopyalandı!");
    };

    const filteredLicenses = licenses.filter(l => {
        const matchesSearch = (l.key || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (l.used_by_email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (l.used_by_name || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = filter === 'all' || (filter === 'used' ? l.is_used : !l.is_used);
        const matchesDuration = durationFilter === 'all' || l.duration_months === durationFilter;

        return matchesSearch && matchesStatus && matchesDuration;
    });

    if (!isFounder && user) return null;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-slate-400 mb-1">
                        <button 
                            onClick={() => navigate("/admin")}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <Shield className="text-indigo-500" size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">Kurucu Paneli</span>
                        <ChevronRight size={16} />
                        <span className="text-sm font-medium text-slate-600">Lisans Yönetimi</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        Lisans Kontrol Merkezi
                        <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 px-4">
                        <Calendar size={18} className="text-slate-400" />
                        <select 
                            value={selectedDuration}
                            onChange={(e) => setSelectedDuration(Number(e.target.value))}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer"
                        >
                            <option value={6}>6 Ay</option>
                            <option value={12}>1 Yıl</option>
                            <option value={36}>3 Yıl</option>
                            <option value={60}>5 Yıl</option>
                            <option value={0}>Sınırsız (Lifetime)</option>
                        </select>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <Button 
                        onClick={handleGenerate}
                        disabled={generating}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-6 py-3 font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200"
                    >
                        {generating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        Yeni Lisans Üret
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "TOPLAM", value: licenses.length, color: "bg-indigo-50 text-indigo-600", icon: Key },
                    { label: "KULLANILAN", value: licenses.filter(l => l.is_used).length, color: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
                    { label: "BEKLEYEN", value: licenses.filter(l => !l.is_used).length, color: "bg-amber-50 text-amber-600", icon: RefreshCw }
                ].map((stat, i) => (
                    <Card key={i} className="p-8 border-none bg-white shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-xs font-black text-slate-400 tracking-[0.2em] mb-4">{stat.label}</p>
                            <div className="flex items-end gap-3">
                                <span className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</span>
                                <div className={cn("p-2 rounded-xl mb-1", stat.color)}>
                                    <stat.icon size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                            <stat.icon size={120} />
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Content Card */}
            <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
                {/* Toolbar */}
                <div className="p-8 border-b border-slate-50 space-y-6 bg-slate-50/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex flex-wrap items-center gap-3">
                            {[
                                { id: 'all', label: 'Tüm Durumlar' },
                                { id: 'used', label: 'Kullanılan' },
                                { id: 'unused', label: 'Boşta' }
                            ].map((btn) => (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilter(btn.id as any)}
                                    className={cn(
                                        "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 border",
                                        filter === btn.id 
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                                            : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                                    )}
                                >
                                    {btn.label}
                                </button>
                            ))}
                            
                            {selectedKeys.length > 0 && (
                                <Button
                                    onClick={handleBulkDelete}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-2xl px-6 py-2.5 font-bold flex items-center gap-2 animate-in zoom-in duration-300"
                                >
                                    <Trash2 size={18} />
                                    {selectedKeys.length} Seçileni Sil
                                </Button>
                            )}
                        </div>

                        <div className="relative group min-w-[320px]">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                <Search size={18} />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Lisans veya kullanıcı ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Duration Categories Filter */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100/50">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Süre Filtresi:</span>
                        {[
                            { id: 'all', label: 'Hepsi' },
                            { id: 6, label: '6 Ay' },
                            { id: 12, label: '1 Yıl' },
                            { id: 36, label: '3 Yıl' },
                            { id: 60, label: '5 Yıl' },
                            { id: 0, label: 'Sınırsız' }
                        ].map((cat) => (
                            <button
                                key={cat.id.toString()}
                                onClick={() => setDurationFilter(cat.id as any)}
                                className={cn(
                                    "px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border",
                                    durationFilter === cat.id 
                                        ? "bg-slate-800 text-white border-slate-800" 
                                        : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-6 text-left w-12">
                                    <input 
                                        type="checkbox"
                                        checked={filteredLicenses.length > 0 && selectedKeys.length === filteredLicenses.length}
                                        onChange={toggleSelectAll}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </th>
                                <th className="px-8 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Lisans Anahtarı</th>
                                <th className="px-8 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Durum</th>
                                <th className="px-8 py-6 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Aktivasyon Bilgisi</th>
                                <th className="px-8 py-6 text-right text-xs font-black text-slate-400 uppercase tracking-widest">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && licenses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Veriler Yükleniyor...</p>
                                    </td>
                                </tr>
                            ) : filteredLicenses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="opacity-20 flex flex-col items-center">
                                            <Key size={48} className="mb-4" />
                                            <p className="font-black text-slate-900 text-xl tracking-tight">Kayıt Bulunamadı</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLicenses.map((license) => (
                                <tr key={license.key} className={cn(
                                    "group hover:bg-slate-50/50 transition-all duration-300",
                                    selectedKeys.includes(license.key) && "bg-indigo-50/30"
                                )}>
                                    <td className="px-8 py-6">
                                        <input 
                                            type="checkbox"
                                            checked={selectedKeys.includes(license.key)}
                                            onChange={() => toggleSelect(license.key)}
                                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                                                license.is_used ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600"
                                            )}>
                                                <Key size={22} />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm font-black font-mono tracking-wider text-slate-800">
                                                        {license.key}
                                                    </code>
                                                    <button 
                                                        onClick={() => copyToClipboard(license.key)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Kopyala"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {license.duration_label || "Bilinmiyor"}
                                                    </span>
                                                    {license.created_at && (
                                                        <span className="text-[10px] font-medium text-slate-400 italic">
                                                            {new Date(license.created_at).toLocaleDateString('tr-TR')} tarihinde üretildi
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {license.is_used ? (
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                Kullanıldı
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-widest">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                Beklemede
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        {license.is_used ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                                                    <User size={18} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-black text-slate-800">
                                                        {license.used_by_name || (license.used_by_email ? "İsimsiz Kullanıcı" : "Eski Kayıt / Bilinmiyor")}
                                                    </p>
                                                    <p className="text-xs font-medium text-slate-400">
                                                        {license.used_by_email || "Bilinmiyor"}
                                                    </p>
                                                    {license.expires_at && (
                                                        <p className="text-[10px] font-black text-rose-500 mt-1 uppercase tracking-wider">
                                                            Süre Sonu: {new Date(license.expires_at).toLocaleDateString('tr-TR')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic font-medium text-xs">Aktivasyon bekleniyor...</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {license.is_used && (
                                                <>
                                                    <button 
                                                        onClick={() => handleResetTrial(license)}
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all border border-transparent hover:border-amber-100"
                                                        title="Sıfırla (Deneme Sürümü Yap)"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleCancelPremium(license)}
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100"
                                                        title="PRO Üyeliği İptal Et"
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                </>
                                            )}
                                            <button 
                                                onClick={() => handleDelete(license)}
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-all shadow-sm border border-transparent hover:border-slate-200"
                                                title="Lisansı Sil"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
