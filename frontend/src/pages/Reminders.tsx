import React, { useState, useEffect, useMemo } from "react";
import {
    Clock,
    AlertTriangle,
    Plus,
    Search,
    CheckCircle2,
    Trash2,
    Edit3,
    Bell,
    Filter,
    Info,
    CalendarDays
} from "lucide-react";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/utils";
import { toast } from "react-hot-toast";
import type {
    Reminder,
    ReminderCreate,
    ReminderType,
    ReminderCategory,
    ReminderPriority
} from "../lib/api/reminders";
import {
    ALL_CATEGORIES,
    fetchReminders,
    createReminder,
    updateReminder,
    deleteReminder,
    calculateExpirationDate,
    getDaysRemaining
} from "../lib/api/reminders";
import {
    sendDesktopNotification,
    checkAndNotifyExpiringReminders
} from "../utils/reminderNotifications";

interface RemindersProps {
    hideHeader?: boolean;
}

export default function Reminders({ hideHeader = false }: RemindersProps) {
    const { user } = useAuth();
    const confirm = useConfirm();

    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Tab / Mode filters:
    // 'all' | 'zamanasimi' | 'genel' | 'expiring_2m' | 'completed'
    const [activeTab, setActiveTab] = useState<"all" | "zamanasimi" | "genel" | "expiring_2m" | "completed">("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

    // Form fields
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        reminder_type: ReminderType;
        category: ReminderCategory | string;
        incident_date: string;
        expiration_date: string;
        notify_before_months: number;
        notify_before_days: number;
        priority: ReminderPriority;
        status: "active" | "completed" | "archived";
    }>({
        title: "",
        description: "",
        reminder_type: "zamanasimi",
        category: "disiplin_657",
        incident_date: "",
        expiration_date: "",
        notify_before_months: 2,
        notify_before_days: 3,
        priority: "urgent",
        status: "active"
    });

    const [isSaving, setIsSaving] = useState(false);

    // Load data
    const loadReminders = async (triggerStartupCheck = false) => {
        try {
            setLoading(true);
            const data = await fetchReminders(user?.uid);
            setReminders(data);
            if (triggerStartupCheck) {
                checkAndNotifyExpiringReminders(data, true);
            }
        } catch (err: any) {
            console.error("Hatırlatıcı kayıtları alınamadı:", err);
            toast.error("Hatırlatıcılar yüklenirken bir sorun oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReminders(true);
    }, [user?.uid]);

    // Handle form incident date change & auto calculate expiration
    const handleIncidentDateChange = (dateVal: string) => {
        const updated = { ...formData, incident_date: dateVal };
        if (formData.reminder_type === "zamanasimi" && formData.category !== "ozel" && dateVal) {
            const calculatedExp = calculateExpirationDate(dateVal, formData.category);
            if (calculatedExp) {
                updated.expiration_date = calculatedExp;
            }
        }
        setFormData(updated);
    };

    // Handle type change (Zamanaşımı vs Genel)
    const handleTypeChange = (typeVal: ReminderType) => {
        if (typeVal === "zamanasimi") {
            setFormData(prev => ({
                ...prev,
                reminder_type: "zamanasimi",
                category: "disiplin_657",
                notify_before_months: 2
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                reminder_type: "genel",
                category: "toplanti",
                notify_before_days: 3
            }));
        }
    };

    // Handle category change & re-calc if incident date exists
    const handleCategoryChange = (cat: string) => {
        const updated = { ...formData, category: cat };
        if (formData.reminder_type === "zamanasimi" && cat !== "ozel" && formData.incident_date) {
            const calculatedExp = calculateExpirationDate(formData.incident_date, cat);
            if (calculatedExp) {
                updated.expiration_date = calculatedExp;
            }
        }
        setFormData(updated);
    };

    const openCreateModal = () => {
        setEditingReminder(null);
        setFormData({
            title: "",
            description: "",
            reminder_type: activeTab === "genel" ? "genel" : "zamanasimi",
            category: activeTab === "genel" ? "toplanti" : "disiplin_657",
            incident_date: "",
            expiration_date: "",
            notify_before_months: 2,
            notify_before_days: 3,
            priority: "urgent",
            status: "active"
        });
        setIsModalOpen(true);
    };

    const openEditModal = (r: Reminder) => {
        setEditingReminder(r);
        const remType = (r.reminder_type || "zamanasimi") as ReminderType;
        setFormData({
            title: r.title,
            description: r.description || "",
            reminder_type: remType,
            category: r.category,
            incident_date: r.incident_date || "",
            expiration_date: r.expiration_date,
            notify_before_months: r.notify_before_months || 2,
            notify_before_days: r.notify_before_days || 3,
            priority: r.priority,
            status: r.status
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error("Lütfen hatırlatıcı başlığını giriniz.");
            return;
        }
        if (!formData.expiration_date) {
            toast.error("Lütfen hedef / zamanaşımı tarihini belirleyiniz.");
            return;
        }

        try {
            setIsSaving(true);
            if (editingReminder) {
                const updated = await updateReminder(editingReminder.id, formData);
                setReminders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                toast.success("Hatırlatıcı güncellendi.");
            } else {
                const created = await createReminder(formData as ReminderCreate);
                setReminders((prev) => [created, ...prev]);
                toast.success("Yeni hatırlatıcı başarıyla eklendi.");
                
                const days = getDaysRemaining(created.expiration_date);
                if (created.reminder_type === "zamanasimi") {
                    if (days <= (created.notify_before_months || 2) * 30) {
                        sendDesktopNotification(
                            `⚠️ Yeni Zamanaşımı Takibi: ${created.title}`,
                            `Bu dosyanın zamanaşımına yalnızca ${days} gün kaldı! Takip sistemine işlendi.`
                        );
                    }
                } else {
                    if (days <= (created.notify_before_days || 3)) {
                        sendDesktopNotification(
                            `📌 Yeni Hatırlatıcı: ${created.title}`,
                            `Hatırlatıcı tarihi: ${new Date(created.expiration_date).toLocaleDateString("tr-TR")} (${days} gün kaldı).`
                        );
                    }
                }
            }
            setIsModalOpen(false);
        } catch (err: any) {
            console.error("Kaydetme hatası:", err);
            toast.error(err.message || "İşlem sırasında bir hata oluştu.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleComplete = async (reminder: Reminder) => {
        const newStatus = reminder.status === "completed" ? "active" : "completed";
        try {
            const updated = await updateReminder(reminder.id, { status: newStatus });
            setReminders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            toast.success(
                newStatus === "completed" 
                    ? "Hatırlatıcı tamamlandı olarak işaretlendi." 
                    : "Hatırlatıcı yeniden aktif takibe alındı."
            );
        } catch {
            toast.error("Durum güncellenemedi.");
        }
    };

    const handleDelete = async (reminder: Reminder) => {
        const confirmed = await confirm({
            title: "Hatırlatıcıyı Sil",
            message: `"${reminder.title}" başlıklı hatırlatıcıyı silmek istediğinize emin misiniz?`,
            confirmText: "Sil",
            cancelText: "Vazgeç",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            await deleteReminder(reminder.id);
            setReminders((prev) => prev.filter((item) => item.id !== reminder.id));
            toast.success("Hatırlatıcı silindi.");
        } catch {
            toast.error("Silme işlemi yapılamadı.");
        }
    };

    const handleTestNotification = () => {
        sendDesktopNotification(
            "🔔 MufYARD Hatırlatıcı Test Bildirimi",
            "Masaüstü Windows ve sistem bildirimleriniz sorunsuz çalışıyor!"
        );
        toast.success("Masaüstü bildirim testi gönderildi!");
    };

    // Calculate metrics
    const metrics = useMemo(() => {
        let total = reminders.length;
        let zamanasimiCount = 0;
        let genelCount = 0;
        let expiring2Months = 0;
        let completed = 0;

        reminders.forEach((r) => {
            if (r.status === "completed") {
                completed++;
                return;
            }
            const isZamanasimi = (r.reminder_type || "zamanasimi") === "zamanasimi";
            if (isZamanasimi) {
                zamanasimiCount++;
                const days = getDaysRemaining(r.expiration_date);
                if (days >= 0 && days <= (r.notify_before_months || 2) * 30) {
                    expiring2Months++;
                }
            } else {
                genelCount++;
            }
        });

        return { total, zamanasimiCount, genelCount, expiring2Months, completed };
    }, [reminders]);

    // Filtered list
    const filteredReminders = useMemo(() => {
        return reminders.filter((r) => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = r.title.toLowerCase().includes(q);
                const descMatch = (r.description || "").toLowerCase().includes(q);
                if (!titleMatch && !descMatch) return false;
            }

            if (categoryFilter !== "all" && r.category !== categoryFilter) {
                return false;
            }

            const remType = r.reminder_type || "zamanasimi";

            if (activeTab === "completed") {
                return r.status === "completed";
            }
            if (r.status === "completed" && activeTab !== "all") {
                return false;
            }

            if (activeTab === "zamanasimi") {
                return remType === "zamanasimi";
            }
            if (activeTab === "genel") {
                return remType === "genel";
            }
            if (activeTab === "expiring_2m") {
                if (remType !== "zamanasimi") return false;
                const days = getDaysRemaining(r.expiration_date);
                return days >= 0 && days <= (r.notify_before_months || 2) * 30;
            }

            return true;
        });
    }, [reminders, searchQuery, categoryFilter, activeTab]);

    return (
        <div className="space-y-6">
            {/* Top Header / Actions Area */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight">
                            Hatırlatıcılar ve Zamanaşımı Takibi
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Zamanaşımı süreleri, toplantılar, evrak ve özel hatırlatıcıların tek merkezden yönetimi
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={handleTestNotification}
                            title="Windows bildirim sistemini test et"
                            className="h-12 px-4 rounded-xl border-border gap-2 font-bold text-xs"
                        >
                            <Bell className="w-4 h-4 text-amber-500" />
                            <span>Bildirim Testi</span>
                        </Button>

                        {/* Kullanıcının istediği "+ Yeni Not Ekle" stilindeki buton */}
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="h-12 px-6 shadow-lg shadow-primary/20 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                        >
                            <Plus size={20} className="text-white" />
                            <span>Yeni Hatırlatıcı Ekle</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 2 Ay Kalan Zamanaşımı (Critical Highlight) */}
                <Card
                    onClick={() => setActiveTab("expiring_2m")}
                    className={cn(
                        "p-5 cursor-pointer transition-all border rounded-2xl",
                        activeTab === "expiring_2m"
                            ? "ring-2 ring-amber-500 border-amber-500 shadow-md bg-amber-500/10"
                            : "hover:border-amber-500/50"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            2 Ay ve Daha Az Kalanlar
                        </span>
                        <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                            <AlertTriangle className="w-5 h-5 animate-pulse" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                            {metrics.expiring2Months}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">kritik dosya</span>
                    </div>
                </Card>

                {/* Zamanaşımı Hatırlatıcıları */}
                <Card
                    onClick={() => setActiveTab("zamanasimi")}
                    className={cn(
                        "p-5 cursor-pointer transition-all border rounded-2xl",
                        activeTab === "zamanasimi"
                            ? "ring-2 ring-primary border-primary shadow-md bg-primary/5"
                            : "hover:border-primary/50"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-foreground">
                            Zamanaşımı Modu
                        </span>
                        <div className="p-2 bg-muted text-foreground rounded-lg">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-foreground">
                            {metrics.zamanasimiCount}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">soruşturma & denetim</span>
                    </div>
                </Card>

                {/* Genel Hatırlatıcılar */}
                <Card
                    onClick={() => setActiveTab("genel")}
                    className={cn(
                        "p-5 cursor-pointer transition-all border rounded-2xl",
                        activeTab === "genel"
                            ? "ring-2 ring-blue-500 border-blue-500 shadow-md bg-blue-500/10"
                            : "hover:border-blue-500/50"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            Genel Hatırlatıcılar
                        </span>
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                            <CalendarDays className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                            {metrics.genelCount}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">toplantı, evrak vb.</span>
                    </div>
                </Card>

                {/* Tamamlananlar */}
                <Card
                    onClick={() => setActiveTab("completed")}
                    className={cn(
                        "p-5 cursor-pointer transition-all border rounded-2xl",
                        activeTab === "completed"
                            ? "ring-2 ring-emerald-500 border-emerald-500 shadow-md bg-emerald-500/10"
                            : "hover:border-emerald-500/50"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Tamamlananlar
                        </span>
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            {metrics.completed}
                        </span>
                        <span className="text-xs text-muted-foreground font-semibold">sonuçlandırıldı</span>
                    </div>
                </Card>
            </div>

            {/* Filter and Search Bar with EXACT User-Requested Tab Buttons ("TÜMÜ" style) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-card border border-border p-3.5 rounded-2xl shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Başlık, konu veya not ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Category Selector */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            aria-label="Kategori filtrele"
                            className="bg-background border border-border text-xs font-bold rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                        >
                            <option value="all">Tüm Kategoriler</option>
                            <optgroup label="Zamanaşımı Türleri">
                                <option value="disiplin_657">657 Disiplin (2 Yıl)</option>
                                <option value="ceza_tck">TCK Ceza (8 Yıl)</option>
                                <option value="mali_denetim">Mali Denetim 5018 (5 Yıl)</option>
                                <option value="genel_gorev">Teftiş / Görev Süresi (1 Yıl)</option>
                                <option value="ozel">Özel Zamanaşımı</option>
                            </optgroup>
                            <optgroup label="Genel Hatırlatıcılar">
                                <option value="toplanti">Toplantı / Görüşme</option>
                                <option value="evrak_yazi">Evrak & Yazışma Takibi</option>
                                <option value="durusma">Duruşma / İfade</option>
                                <option value="gorev">Genel Görev & Rapor</option>
                                <option value="diger">Diğer / Genel Not</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Mode Tabs in exact requested "TÜMÜ" Pill Button Style */}
                    <div className="flex bg-muted/60 p-1.5 rounded-xl border border-border gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("all")}
                            className={cn(
                                "px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                activeTab === "all"
                                    ? "bg-primary text-white shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            TÜMÜ ({metrics.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("zamanasimi")}
                            className={cn(
                                "px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                activeTab === "zamanasimi"
                                    ? "bg-primary text-white shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            ⚖️ ZAMANAŞIMI ({metrics.zamanasimiCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("genel")}
                            className={cn(
                                "px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                activeTab === "genel"
                                    ? "bg-primary text-white shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            📌 GENEL ({metrics.genelCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("expiring_2m")}
                            className={cn(
                                "px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                activeTab === "expiring_2m"
                                    ? "bg-primary text-white shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            ⚠️ 2 AY KALA ({metrics.expiring2Months})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("completed")}
                            className={cn(
                                "px-4 h-9 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer",
                                activeTab === "completed"
                                    ? "bg-primary text-white shadow-md shadow-primary/20"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            BİTEN ({metrics.completed})
                        </button>
                    </div>
                </div>
            </div>

            {/* List / Grid of Reminders */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
                    <Clock className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm font-bold">Hatırlatıcılar yükleniyor...</p>
                </div>
            ) : filteredReminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-card border border-dashed border-border rounded-2xl text-center">
                    <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <h3 className="text-base font-black text-foreground">Kayıt Bulunamadı</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-5">
                        Arama kriterlerinize uyan hatırlatıcı veya zamanaşımı kaydı bulunamadı.
                    </p>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="h-12 px-6 shadow-lg shadow-primary/20 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <Plus size={20} className="text-white" />
                        <span>Yeni Hatırlatıcı Ekle</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReminders.map((reminder) => {
                        const daysLeft = getDaysRemaining(reminder.expiration_date);
                        const isExpiredStatus = daysLeft < 0;
                        const isZamanasimi = (reminder.reminder_type || "zamanasimi") === "zamanasimi";
                        const isExpiringSoon = isZamanasimi 
                            ? (daysLeft >= 0 && daysLeft <= (reminder.notify_before_months || 2) * 30)
                            : (daysLeft >= 0 && daysLeft <= (reminder.notify_before_days || 3));
                        const isDone = reminder.status === "completed";

                        let badgeStyle = "bg-muted text-foreground border-border";
                        let statusText = `${daysLeft} gün kaldı`;

                        if (isDone) {
                            badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
                            statusText = "Tamamlandı";
                        } else if (isExpiredStatus) {
                            badgeStyle = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-black";
                            statusText = isZamanasimi ? `Zamanaşımı Doldu (${Math.abs(daysLeft)} gün önce)` : `Süresi Geçti (${Math.abs(daysLeft)} gün önce)`;
                        } else if (isExpiringSoon) {
                            badgeStyle = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-black animate-pulse";
                            statusText = isZamanasimi ? `⚠️ 2 Ay İçinde: ${daysLeft} gün kaldı` : `📌 Yaklaşıyor: ${daysLeft} gün kaldı`;
                        }

                        const categoryInfo = ALL_CATEGORIES[reminder.category] || { label: "Özel", description: "" };

                        return (
                            <Card
                                key={reminder.id}
                                className={cn(
                                    "flex flex-col justify-between p-5 border transition-all rounded-2xl",
                                    isDone 
                                        ? "opacity-60 bg-card/60" 
                                        : isExpiredStatus 
                                            ? "border-rose-500/40 bg-rose-500/5 shadow-sm" 
                                            : isExpiringSoon 
                                                ? "border-amber-500/50 bg-amber-500/5 shadow-sm" 
                                                : "hover:border-primary/40"
                                )}
                            >
                                <div>
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md",
                                                    isZamanasimi ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                )}>
                                                    {isZamanasimi ? "⚖️ Zamanaşımı" : "📌 Genel"}
                                                </span>
                                                <span className="text-[10px] font-black tracking-wider uppercase text-muted-foreground">
                                                    {categoryInfo.label}
                                                </span>
                                            </div>
                                            <h3 className={cn(
                                                "text-base font-black text-foreground mt-1 line-clamp-2",
                                                isDone && "line-through text-muted-foreground"
                                            )}>
                                                {reminder.title}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Remaining Days Badge */}
                                    <div className="mb-3">
                                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border", badgeStyle)}>
                                            {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            {statusText}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {reminder.description && (
                                        <p className="text-xs text-muted-foreground font-medium line-clamp-3 mb-4 whitespace-pre-wrap">
                                            {reminder.description}
                                        </p>
                                    )}

                                    {/* Date Details with crisp high-contrast text */}
                                    <div className="space-y-1.5 text-xs text-foreground bg-muted/40 p-3 rounded-xl border border-border">
                                        {isZamanasimi && reminder.incident_date && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground font-semibold">Fiil / Olay Tarihi:</span>
                                                <span className="font-black text-foreground">
                                                    {new Date(reminder.incident_date).toLocaleDateString("tr-TR")}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <span className={cn("font-bold", isZamanasimi ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400")}>
                                                {isZamanasimi ? "Zamanaşımı Bitiş:" : "Hedef Tarih:"}
                                            </span>
                                            <span className="font-black text-foreground">
                                                {new Date(reminder.expiration_date).toLocaleDateString("tr-TR")}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>Uyarı Eşiği:</span>
                                            <span className="font-bold text-foreground">
                                                {isZamanasimi 
                                                    ? `${reminder.notify_before_months || 2} ay önceden` 
                                                    : `${reminder.notify_before_days || 3} gün önceden`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Actions Footer */}
                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleComplete(reminder)}
                                        className={cn(
                                            "flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                                            isDone
                                                ? "text-primary hover:bg-muted"
                                                : "text-emerald-600 hover:bg-emerald-500/10"
                                        )}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>{isDone ? "Yeniden Aç" : "Tamamlandı"}</span>
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(reminder)}
                                            aria-label="Düzenle"
                                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                            title="Düzenle"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(reminder)}
                                            aria-label="Sil"
                                            className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                            title="Sil"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Modal with Mode Switcher */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingReminder ? "Hatırlatıcıyı Düzenle" : "Yeni Hatırlatıcı Ekle"}
                size="large"
            >
                <form onSubmit={handleSave} className="space-y-4 font-inter">
                    {/* Hatırlatıcı Modu Seçimi (Zamanaşımı vs Genel) */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                            Hatırlatıcı Türü / Modu
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-xl border border-border">
                            <button
                                type="button"
                                onClick={() => handleTypeChange("zamanasimi")}
                                className={cn(
                                    "py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
                                    formData.reminder_type === "zamanasimi"
                                        ? "bg-primary text-white shadow"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Clock size={16} />
                                <span>⚖️ Zamanaşımı Modu</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange("genel")}
                                className={cn(
                                    "py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
                                    formData.reminder_type === "genel"
                                        ? "bg-primary text-white shadow"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <CalendarDays size={16} />
                                <span>📌 Genel Hatırlatıcı</span>
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                            Başlık <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder={formData.reminder_type === "zamanasimi" 
                                ? "Örn: 2026/14 No'lu İl Müdürlüğü Disiplin Soruşturması" 
                                : "Örn: Federasyon Denetim Kurulu Toplantısı / Savunma Yazısı"}
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    {/* Category Selection based on Mode */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                            Kategori
                        </label>
                        {formData.reminder_type === "zamanasimi" ? (
                            <select
                                value={formData.category}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                aria-label="Zamanaşımı Kategorisi"
                                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                            >
                                <option value="disiplin_657">Disiplin Zamanaşımı (657 DMK - 2 Yıl)</option>
                                <option value="ceza_tck">Dava / Ceza Zamanaşımı (TCK 66 - 8 Yıl)</option>
                                <option value="mali_denetim">Mali Denetim / Sayıştay (5018 SK - 5 Yıl)</option>
                                <option value="genel_gorev">Teftiş / Görev Tamamlama Hedefi (1 Yıl)</option>
                                <option value="ozel">Özel Zamanaşımı (Serbest Tarih)</option>
                            </select>
                        ) : (
                            <select
                                value={formData.category}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                aria-label="Genel Hatırlatıcı Kategorisi"
                                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                            >
                                <option value="toplanti">Toplantı / Görüşme</option>
                                <option value="evrak_yazi">Evrak & Yazışma Takibi</option>
                                <option value="durusma">Duruşma / İfade Alma</option>
                                <option value="gorev">Genel Görev & Rapor</option>
                                <option value="diger">Diğer / Genel Not</option>
                            </select>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 font-medium">
                            <Info className="w-4 h-4 text-primary shrink-0" />
                            {ALL_CATEGORIES[formData.category]?.description || ""}
                        </p>
                    </div>

                    {/* Date Wizard Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-2xl border border-border">
                        {formData.reminder_type === "zamanasimi" ? (
                            <>
                                <div>
                                    <label className="block text-xs font-black text-foreground mb-1.5">
                                        Fiil / Olay / Başlangıç Tarihi
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.incident_date}
                                        onChange={(e) => handleIncidentDateChange(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                        Fiil tarihi girilirse zamanaşımı süresi türe göre otomatik hesaplanır.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-foreground mb-1.5">
                                        Zamanaşımı Bitiş Tarihi <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expiration_date}
                                        onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-black text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                        İsterseniz tarihi doğrudan elle de belirleyebilirsiniz.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-black text-foreground mb-1.5">
                                    Hatırlatma / Hedef Tarih <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.expiration_date}
                                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                            </div>
                        )}
                    </div>

                    {/* Notification Threshold & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                                Bildirim Başlangıcı
                            </label>
                            {formData.reminder_type === "zamanasimi" ? (
                                <select
                                    value={formData.notify_before_months}
                                    onChange={(e) => setFormData({ ...formData, notify_before_months: Number(e.target.value) })}
                                    aria-label="Bildirim Başlangıcı (Ay Önce)"
                                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                                >
                                    <option value={1}>1 Ay Önceden Bildir</option>
                                    <option value={2}>2 Ay Önceden Bildir (Önerilen)</option>
                                    <option value={3}>3 Ay Önceden Bildir</option>
                                    <option value={6}>6 Ay Önceden Bildir</option>
                                </select>
                            ) : (
                                <select
                                    value={formData.notify_before_days}
                                    onChange={(e) => setFormData({ ...formData, notify_before_days: Number(e.target.value) })}
                                    aria-label="Bildirim Başlangıcı (Gün Önce)"
                                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                                >
                                    <option value={0}>Aynı Gün Bildir</option>
                                    <option value={1}>1 Gün Önceden Bildir</option>
                                    <option value={3}>3 Gün Önceden Bildir</option>
                                    <option value={7}>1 Hafta Önceden Bildir</option>
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                                Öncelik / Aciliyet
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value as ReminderPriority })}
                                aria-label="Öncelik / Aciliyet"
                                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                            >
                                <option value="normal">Normal</option>
                                <option value="urgent">Yüksek (Acil)</option>
                                <option value="critical">Kritik (Acil İnceleme)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-foreground mb-1.5">
                            Açıklama, Notlar veya Dosya Referansı
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Savunma istemi, görüşme notu veya hatırlanacak hususlar..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    {/* Modal Actions */}
                    <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                            disabled={isSaving}
                            className="h-11 px-5 rounded-xl font-bold"
                        >
                            Vazgeç
                        </Button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="h-11 px-6 shadow-lg shadow-primary/20 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-sm flex items-center justify-center min-w-[140px] transition-all cursor-pointer"
                        >
                            {isSaving ? "Kaydediliyor..." : editingReminder ? "Değişiklikleri Kaydet" : "Hatırlatıcıyı Ekle"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
