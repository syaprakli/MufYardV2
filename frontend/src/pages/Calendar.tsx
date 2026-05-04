import { ChevronLeft, ChevronRight, Plus, Clock, FileText, Trash2, Shield, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "../components/ui/Modal";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { fetchTasks, type Task } from "../lib/api/tasks";
import {
    fetchCalendarNotes,
    createCalendarNote,
    deleteCalendarNote,
    type CalendarNote,
} from "../lib/api/calendar";

// ── Önemli Tarihler Verisi ───────────────────────────────────────────────────
type SpecialDateType = 'tatil' | 'bayram' | 'denetim' | 'ozel';

interface SpecialDateEntry {
    title: string;
    short: string;
    type: SpecialDateType;
}

// Sabit Ulusal Tatiller + Her Yıl Tekrarlanan Önemli Günler (MM-DD)
const FIXED_HOLIDAYS: Record<string, SpecialDateEntry> = {
    // ─── Resmi Tatiller ─────────────────────────────────────────────────────
    "01-01": { title: "Yılbaşı", short: "Yılbaşı", type: "tatil" },
    "04-23": { title: "Ulusal Egemenlik ve Çocuk Bayramı", short: "23 Nisan", type: "tatil" },
    "05-01": { title: "Emek ve Dayanışma Günü", short: "1 Mayıs", type: "tatil" },
    "05-19": { title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", short: "19 Mayıs", type: "tatil" },
    "07-15": { title: "Demokrasi ve Milli Birlik Günü", short: "15 Temmuz", type: "tatil" },
    "08-30": { title: "Zafer Bayramı", short: "30 Ağustos", type: "tatil" },
    "10-28": { title: "Cumhuriyet Bayramı (Yarım Gün)", short: "Cum.Bay.", type: "tatil" },
    "10-29": { title: "Cumhuriyet Bayramı", short: "29 Ekim", type: "tatil" },
    // ─── Denetim & Mesleki Günler ───────────────────────────────────────────
    "04-30": { title: "Denetim Haftası (Atatürk'ün 9. Ordu Müfettişliğine Atanması — 30 Nisan 1919)", short: "Denetim Haftası", type: "denetim" },
    // ─── Spor & Gençlik Günleri ─────────────────────────────────────────────
    "04-06": { title: "Beden Eğitimi ve Spor Günü", short: "Spor Günü", type: "ozel" },
    "06-23": { title: "Olimpiyat Günü", short: "Olimpiyat G.", type: "ozel" },
    // ─── Sosyal Farkındalık Günleri ─────────────────────────────────────────
    "03-08": { title: "Dünya Kadınlar Günü", short: "Kadınlar G.", type: "ozel" },
    "04-07": { title: "Dünya Sağlık Günü", short: "Sağlık G.", type: "ozel" },
    "05-10": { title: "Engelliler Haftası Başlangıcı (10–16 Mayıs)", short: "Engelliler H.", type: "ozel" },
    "11-10": { title: "Atatürk'ü Anma Günü", short: "10 Kasım", type: "ozel" },
    "11-24": { title: "Öğretmenler Günü", short: "Öğretmen G.", type: "ozel" },
    "12-03": { title: "Dünya Engelliler Günü", short: "Engelliler G.", type: "ozel" },
    "12-10": { title: "İnsan Hakları Günü", short: "İnsan Hak.G.", type: "ozel" },
};

// Yıla özel tarihler — yalnızca tarihi yıldan yıla değişen dini bayramlar (YYYY-MM-DD)
const VARIABLE_DATES: (SpecialDateEntry & { date: string })[] = [
    // ─── Ramazan Bayramı 2025 ───────────────────────────────────────────────
    { date: "2025-03-29", title: "Ramazan Bayramı Arifesi", short: "Ram.Arife", type: "bayram" },
    { date: "2025-03-30", title: "Ramazan Bayramı 1. Günü", short: "Ram.Byr.", type: "bayram" },
    { date: "2025-03-31", title: "Ramazan Bayramı 2. Günü", short: "Ram.Byr.", type: "bayram" },
    { date: "2025-04-01", title: "Ramazan Bayramı 3. Günü", short: "Ram.Byr.", type: "bayram" },
    // ─── Kurban Bayramı 2025 ────────────────────────────────────────────────
    { date: "2025-06-05", title: "Kurban Bayramı Arifesi", short: "Krb.Arife", type: "bayram" },
    { date: "2025-06-06", title: "Kurban Bayramı 1. Günü", short: "Kurban", type: "bayram" },
    { date: "2025-06-07", title: "Kurban Bayramı 2. Günü", short: "Kurban", type: "bayram" },
    { date: "2025-06-08", title: "Kurban Bayramı 3. Günü", short: "Kurban", type: "bayram" },
    { date: "2025-06-09", title: "Kurban Bayramı 4. Günü", short: "Kurban", type: "bayram" },
    // ─── Ramazan Bayramı 2026 ───────────────────────────────────────────────
    { date: "2026-03-19", title: "Ramazan Bayramı Arifesi", short: "Ram.Arife", type: "bayram" },
    { date: "2026-03-20", title: "Ramazan Bayramı 1. Günü", short: "Ram.Byr.", type: "bayram" },
    { date: "2026-03-21", title: "Ramazan Bayramı 2. Günü", short: "Ram.Byr.", type: "bayram" },
    { date: "2026-03-22", title: "Ramazan Bayramı 3. Günü", short: "Ram.Byr.", type: "bayram" },
    // ─── Kurban Bayramı 2026 ────────────────────────────────────────────────
    { date: "2026-05-26", title: "Kurban Bayramı Arifesi", short: "Krb.Arife", type: "bayram" },
    { date: "2026-05-27", title: "Kurban Bayramı 1. Günü", short: "Kurban", type: "bayram" },
    { date: "2026-05-28", title: "Kurban Bayramı 2. Günü", short: "Kurban", type: "bayram" },
    { date: "2026-05-29", title: "Kurban Bayramı 3. Günü", short: "Kurban", type: "bayram" },
    { date: "2026-05-30", title: "Kurban Bayramı 4. Günü", short: "Kurban", type: "bayram" },
];

const SPECIAL_DATE_COLORS: Record<SpecialDateType, { bg: string; text: string; badge: string }> = {
    tatil:   { bg: "bg-emerald-50 border border-emerald-200",  text: "text-emerald-700", badge: "bg-emerald-500 text-white" },
    bayram:  { bg: "bg-violet-50 border border-violet-200",    text: "text-violet-700",  badge: "bg-violet-500 text-white" },
    denetim: { bg: "bg-orange-50 border border-orange-200",    text: "text-orange-700",  badge: "bg-orange-500 text-white" },
    ozel:    { bg: "bg-sky-50 border border-sky-200",          text: "text-sky-700",     badge: "bg-sky-500 text-white" },
};

const TYPE_LABELS: Record<SpecialDateType, string> = {
    tatil: "Resmi Tatil",
    bayram: "Dini Bayram",
    denetim: "Denetim Haftası",
    ozel: "Özel Gün",
};

const TYPE_PRIORITY: Record<SpecialDateType, number> = { tatil: 0, bayram: 1, denetim: 2, ozel: 3 };

function getSpecialDatesForDay(y: number, m: number, day: number): SpecialDateEntry[] {
    const mmdd = `${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const fullDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const results: SpecialDateEntry[] = [];
    if (FIXED_HOLIDAYS[mmdd]) results.push(FIXED_HOLIDAYS[mmdd]);
    for (const v of VARIABLE_DATES) {
        if (v.date === fullDate) results.push(v);
    }
    const seen = new Set<string>();
    return results
        .filter(r => { if (seen.has(r.title)) return false; seen.add(r.title); return true; })
        .sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
}

export default function Calendar() {
    const { user, loading: authLoading } = useAuth();
    const confirm = useConfirm();

    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [noteText, setNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    // Firestore-backed notes: flat list, grouped on render
    const [allNotes, setAllNotes] = useState<CalendarNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);

    const [tasks, setTasks] = useState<Task[]>([]);

    // ── helpers ────────────────────────────────────────────────────────────────
    const effectiveUid = useCallback(() => {
        if (user?.uid) return user.uid;
        const raw = localStorage.getItem("demo_user");
        return raw ? JSON.parse(raw)?.uid : null;
    }, [user]);

    // ── load data ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (authLoading) return;
        const uid = effectiveUid();
        if (!uid) return;

        const loadTasks = async () => {
            try {
                const data = await fetchTasks(uid, user?.email ?? undefined);
                setTasks(data);
            } catch {
                console.error("Takvim görevleri yüklenemedi.");
            }
        };

        const loadNotes = async () => {
            setNotesLoading(true);
            try {
                const data = await fetchCalendarNotes(uid);
                setAllNotes(data);
            } catch {
                console.error("Takvim notları yüklenemedi.");
            } finally {
                setNotesLoading(false);
            }
        };

        loadTasks();
        loadNotes();
    }, [user, authLoading, effectiveUid]);

    // ── calendar math ──────────────────────────────────────────────────────────
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
    ];
    const monthName = monthNames[month];

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => {
        const d = new Date(y, m, 1).getDay();
        return d === 0 ? 6 : d - 1;
    };
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // ── note helpers ──────────────────────────────────────────────────────────
    const notesForDateKey = (key: string) => allNotes.filter(n => n.date_key === key);

    const isDateInTaskRange = (y: number, m: number, day: number, task: Task) => {
        if (!task.baslama_tarihi) return false;
        const targetDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const startDateObj = new Date(task.baslama_tarihi);
        const startDate = startDateObj.toISOString().split("T")[0];
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + (task.sure_gun || 1) - 1);
        const endDate = endDateObj.toISOString().split("T")[0];
        return targetDate === startDate || targetDate === endDate;
    };

    // ── handlers ──────────────────────────────────────────────────────────────
    const handleDayClick = (day: number) => {
        setSelectedDay(day);
        setSelectedDateKey(`${year}-${month}-${day}`);
        setIsNoteModalOpen(true);
    };

    const handleAddEventClick = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDay(today.getDate());
        setSelectedDateKey(`${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`);
        setIsNoteModalOpen(true);
    };

    const handleSaveNote = async () => {
        if (!noteText.trim() || !selectedDateKey) return;
        const uid = effectiveUid();
        if (!uid) { toast.error("Giriş yapmanız gerekiyor."); return; }

        setSavingNote(true);
        try {
            const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
            const newNote = await createCalendarNote(uid, selectedDateKey, noteText.trim(), time);
            setAllNotes(prev => [...prev, newNote]);
            setNoteText("");
            toast.success("Not kaydedildi.");
        } catch {
            toast.error("Not kaydedilemedi.");
        } finally {
            setSavingNote(false);
        }
    };

    const handleDeleteNote = async (note: CalendarNote) => {
        const uid = effectiveUid();
        if (!uid) return;
        const confirmed = await confirm({
            title: "Notu Sil",
            message: "Bu notu silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        try {
            await deleteCalendarNote(note.id, uid);
            setAllNotes(prev => prev.filter(n => n.id !== note.id));
            toast.success("Not silindi.");
        } catch {
            toast.error("Not silinemedi.");
        }
    };

    const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    // ── upcoming tasks (next 14 days) ──────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = tasks
        .filter(t => {
            if (!t.baslama_tarihi) return false;
            const d = new Date(t.baslama_tarihi);
            const diff = (d.getTime() - today.getTime()) / 86400000;
            return diff >= 0 && diff <= 14;
        })
        .sort((a, b) => new Date(a.baslama_tarihi).getTime() - new Date(b.baslama_tarihi).getTime())
        .slice(0, 6);

    const selectedNotes = selectedDateKey ? notesForDateKey(selectedDateKey) : [];

    // Bu aydaki önemli günler (sidebar için)
    const monthSpecialDates = useMemo(() => {
        const daysCount = getDaysInMonth(year, month);
        const seen = new Map<string, SpecialDateEntry & { day: number }>();
        for (let d = 1; d <= daysCount; d++) {
            for (const s of getSpecialDatesForDay(year, month, d)) {
                if (!seen.has(s.title)) seen.set(s.title, { day: d, ...s });
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.day - b.day);
    }, [year, month]);

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Takvim</span>
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Takvim</h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Denetim programınızı ve önemli tarihleri yönetin.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Calendar Grid */}
                <div className="xl:col-span-3 card p-6">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-bold text-primary font-outfit uppercase tracking-widest">
                            {monthName} {year}
                        </h3>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={goToPrevMonth}><ChevronLeft size={20} /></Button>
                            <Button variant="outline" size="sm" onClick={goToToday}>Bugün</Button>
                            <Button variant="ghost" size="icon" onClick={goToNextMonth}><ChevronRight size={20} /></Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden shadow-sm">
                        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(day => (
                            <div key={day} className="bg-muted p-2 text-center text-[10px] font-bold uppercase tracking-widest text-secondary">
                                {day}
                            </div>
                        ))}
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-muted min-h-[100px] border-t border-l border-border" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayNumber = i + 1;
                            const isToday =
                                new Date().getDate() === dayNumber &&
                                new Date().getMonth() === month &&
                                new Date().getFullYear() === year;
                            const dateKey = `${year}-${month}-${dayNumber}`;
                            const dayNotesList = notesForDateKey(dateKey);
                            const hasNotes = dayNotesList.length > 0;
                            const targetDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
                            const specialDates = getSpecialDatesForDay(year, month, dayNumber);
                            const primarySpecial = specialDates[0] ?? null;

                            return (
                                <div
                                    key={dayNumber}
                                    onClick={() => handleDayClick(dayNumber)}
                                    className={cn(
                                        "bg-card min-h-[100px] p-2 hover:bg-muted/30 transition-colors cursor-pointer border-t border-l border-border relative group",
                                        isToday ? "bg-primary/5 border-primary/20" : ""
                                    )}
                                >
                                    <span className={cn(
                                        "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1",
                                        isToday ? "bg-primary text-white" : "text-muted-foreground group-hover:text-primary transition-colors"
                                    )}>
                                        {dayNumber}
                                    </span>

                                    <div className="space-y-1 overflow-hidden">
                                        {primarySpecial && (
                                            <div
                                                className={`p-1 text-[8px] rounded font-bold truncate shadow-sm ${SPECIAL_DATE_COLORS[primarySpecial.type].badge}`}
                                                title={specialDates.map(s => s.title).join(' | ')}
                                            >
                                                {primarySpecial.short}{specialDates.length > 1 ? ` +${specialDates.length - 1}` : ''}
                                            </div>
                                        )}
                                        {tasks.filter(t => isDateInTaskRange(year, month, dayNumber, t)).slice(0, 2).map(t => {
                                            const isStart = new Date(t.baslama_tarihi).toISOString().split("T")[0] === targetDate;
                                            return (
                                                <div
                                                    key={t.id}
                                                    className={cn(
                                                        "p-1 text-[8px] rounded font-bold truncate shadow-sm text-white",
                                                        isStart ? "bg-primary" : "bg-red-500"
                                                    )}
                                                    title={`${t.rapor_kodu} ${isStart ? "(BAŞLANGIÇ)" : "(BİTİŞ)"}`}
                                                >
                                                    {t.rapor_kodu} {isStart ? "(BŞL)" : "(BİTİŞ)"}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {hasNotes && (
                                        <div className="mt-1 p-1 bg-amber-100 text-amber-700 text-[9px] rounded font-bold truncate shadow-sm">
                                            {dayNotesList.length} Not
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {Array.from({ length: 42 - firstDay - daysInMonth }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="bg-muted min-h-[100px] border-t border-l border-border" />
                        ))}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Yaklaşan Denetimler</h3>
                        <div className="space-y-3">
                            {upcoming.length > 0 ? upcoming.map(t => (
                                <div key={t.id} className="flex items-start gap-3 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-all">
                                    <div className="w-1.5 min-h-[40px] bg-primary rounded-full flex-shrink-0 mt-1" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate" title={t.rapor_kodu}>{t.rapor_kodu}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium truncate">{t.rapor_adi}</p>
                                        <p className="text-[10px] text-primary font-bold mt-1">
                                            {new Date(t.baslama_tarihi).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-8 text-center">
                                    <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Yakın zamanda<br />denetim yok</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Bu Aydaki Önemli Günler</h3>
                        <div className="space-y-2">
                            {monthSpecialDates.length > 0 ? monthSpecialDates.map((s, i) => (
                                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${SPECIAL_DATE_COLORS[s.type].bg}`}>
                                    <div className="shrink-0">
                                        <span className="text-lg">
                                            {s.type === 'tatil' ? '🏖' : s.type === 'bayram' ? '🌙' : s.type === 'denetim' ? '🔍' : '⭐'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${SPECIAL_DATE_COLORS[s.type].text}`}>{TYPE_LABELS[s.type]}</p>
                                        <p className="text-xs font-bold text-foreground truncate">{s.title}</p>
                                    </div>
                                    <span className={`shrink-0 text-[10px] font-black ${SPECIAL_DATE_COLORS[s.type].text}`}>{s.day}</span>
                                </div>
                            )) : (
                                <div className="py-6 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bu ayda özel gün yok</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6 bg-card border border-border">
                        <h4 className="font-bold mb-2 text-primary">Etkinlik Ekle</h4>
                        <p className="text-xs text-muted-foreground mb-4">Bugün için hızlıca bir not veya hatırlatıcı ekleyin.</p>
                        <Button className="w-full h-12 rounded-xl font-bold gap-2" onClick={handleAddEventClick}>
                            <Plus size={18} /> Yeni Not Ekle
                        </Button>
                    </Card>
                </div>
            </div>

            {/* Note Modal */}
            <Modal
                isOpen={isNoteModalOpen}
                onClose={() => { setIsNoteModalOpen(false); setNoteText(""); }}
                title={`${selectedDay} ${monthName} ${year} — Notlar`}
                size="large"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[350px]">
                    {/* Left: Create Note */}
                    <div className="flex flex-col h-full md:border-r border-border md:pr-8">
                        <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                            <Plus size={16} /> Yeni Not
                        </h4>
                        <textarea
                            className="w-full flex-1 p-4 bg-muted border border-border rounded-2xl text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none resize-none mb-4"
                            placeholder="Bu tarih için hatırlatıcı veya not..."
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                        />
                        <div className="flex gap-3 mt-auto">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsNoteModalOpen(false)}>Kapat</Button>
                            <Button
                                className="flex-1 h-12 rounded-xl"
                                onClick={handleSaveNote}
                                disabled={savingNote || !noteText.trim()}
                            >
                                {savingNote ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                                Kaydet
                            </Button>
                        </div>
                    </div>

                    {/* Right: Existing Notes + Tasks */}
                    <div className="flex flex-col h-full max-h-[350px]">
                        <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={16} /> Görevler & Notlar
                        </h4>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {/* Önemli Günler */}
                            {selectedDay && getSpecialDatesForDay(year, month, selectedDay).map((s, i) => (
                                <div key={i} className={`p-3 rounded-xl ${SPECIAL_DATE_COLORS[s.type].bg}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${SPECIAL_DATE_COLORS[s.type].text}`}>
                                        {s.type === 'tatil' ? '🏖 Resmi Tatil' : s.type === 'bayram' ? '🌙 Dini Bayram' : s.type === 'denetim' ? '🔍 Denetim Dönemi' : '⭐ Özel Gün'}
                                    </p>
                                    <p className={`font-bold text-sm mt-0.5 ${SPECIAL_DATE_COLORS[s.type].text}`}>{s.title}</p>
                                </div>
                            ))}
                            {/* Tasks on this day */}
                            {selectedDay && tasks.filter(t => isDateInTaskRange(year, month, selectedDay, t)).map(t => {
                                const isStart = new Date(t.baslama_tarihi).setHours(0, 0, 0, 0) === new Date(year, month, selectedDay).setHours(0, 0, 0, 0);
                                return (
                                    <div key={t.id} className={cn(
                                        "p-4 rounded-xl border relative border-l-4",
                                        isStart ? "bg-muted border-border border-l-primary" : "bg-red-50/50 border-red-100 border-l-red-500"
                                    )}>
                                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isStart ? "text-primary" : "text-red-600")}>
                                            {isStart ? "ÖN İNCELEME / BAŞLANGIÇ" : "SÜRE SONU / BİTİŞ"}
                                        </span>
                                        <p className="text-foreground font-bold text-sm leading-tight mb-1 mt-1">{t.rapor_kodu}</p>
                                        <p className="text-muted-foreground text-[10px] font-medium">{t.rapor_adi}</p>
                                    </div>
                                );
                            })}

                            {/* Firestore Notes */}
                            {notesLoading ? (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 size={20} className="animate-spin text-primary" />
                                </div>
                            ) : selectedNotes.length > 0 ? (
                                selectedNotes.map(n => (
                                    <div key={n.id} className="p-4 bg-primary/5 rounded-xl border border-primary/10 relative group">
                                        <p className="text-muted-foreground font-medium text-sm pr-6 leading-relaxed whitespace-pre-wrap break-words">{n.text}</p>
                                        <span className="text-[10px] text-primary/60 font-black mt-3 block uppercase tracking-widest">{n.time}</span>
                                        <button
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteNote(n)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                                        <FileText size={24} className="opacity-50" />
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-widest text-center">Bu tarihe ait<br />kayıtlı not yok</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
