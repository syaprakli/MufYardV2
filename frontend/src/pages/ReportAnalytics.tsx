import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { fetchTasks } from "../lib/api/tasks";
import { Card } from "../components/ui/Card";
import { BarChart3, CalendarClock, CheckCircle2, Clock3, Shield, ChevronRight, Sparkles, Search, X } from "lucide-react";

type StatusEntry = {
    status: string;
    changed_at: string;
    from?: string | null;
    to?: string | null;
};

function formatDate(value?: string) {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleString("tr-TR");
}

function dayDiff(fromIso: string, toIso?: string) {
    const from = new Date(fromIso).getTime();
    const to = toIso ? new Date(toIso).getTime() : Date.now();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return Math.max(0, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
}

function isCompleted(task: any) {
    return String(task?.rapor_durumu || "") === "Tamamlandı";
}

function getTimeline(task: any): StatusEntry[] {
    const list = Array.isArray(task.status_history) ? [...task.status_history] : [];
    if (list.length === 0) {
        list.push({
            status: task.rapor_durumu || "Başlanmadı",
            changed_at: task.created_at || new Date().toISOString(),
            from: null,
            to: task.rapor_durumu || "Başlanmadı"
        });
    }
    list.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

    // Clean timeline noise: ignore no-op transitions and collapse consecutive same-stage entries.
    const cleaned: StatusEntry[] = [];
    for (const item of list) {
        const toStatus = String(item?.to || item?.status || "Başlanmadı");
        const fromStatus = item?.from == null ? null : String(item.from);

        // Ignore transitions that do not change status.
        if (fromStatus && fromStatus === toStatus) continue;

        const prev = cleaned[cleaned.length - 1];
        const prevTo = prev ? String(prev?.to || prev?.status || "Başlanmadı") : null;

        // If consecutive entries resolve to the same stage, keep the earliest start only.
        if (prevTo && prevTo === toStatus) continue;

        cleaned.push(item);
    }

    return cleaned.length > 0 ? cleaned : list;
}

function getStatusTone(status: string) {
    switch (status) {
        case "Tamamlandı":
            return {
                pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40",
                dot: "bg-emerald-500",
                time: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40"
            };
        case "İncelemede":
            return {
                pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
                dot: "bg-amber-500",
                time: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40"
            };
        case "Evrak Bekleniyor":
            return {
                pill: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40",
                dot: "bg-violet-500",
                time: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800/40"
            };
        case "Devam Ediyor":
            return {
                pill: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40",
                dot: "bg-blue-500",
                time: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40"
            };
        default:
            return {
                pill: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                dot: "bg-slate-500",
                time: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            };
    }
}

function getPhaseDurations(task: any) {
    const timeline = getTimeline(task);
    const phaseMap = new Map<string, { label: string; days: number; startAt: string; visits: number }>();

    for (let i = 0; i < timeline.length; i++) {
        const current = timeline[i];
        const next = timeline[i + 1];
        const safeEnd = next?.changed_at || (isCompleted(task) ? task.completed_at : undefined);
        const days = dayDiff(current.changed_at, safeEnd);
        const label = String(current.to || current.status || "Başlanmadı");

        if (!phaseMap.has(label)) {
            phaseMap.set(label, {
                label,
                days: Math.max(0, days ?? 0),
                startAt: current.changed_at,
                visits: 1,
            });
            continue;
        }

        const prev = phaseMap.get(label)!;
        phaseMap.set(label, {
            ...prev,
            days: prev.days + Math.max(0, days ?? 0),
            visits: prev.visits + 1,
        });
    }

    return Array.from(phaseMap.values());
}

function getCurrentStageDays(task: any) {
    if (isCompleted(task)) return null;
    const timeline = getTimeline(task);
    const last = timeline[timeline.length - 1];
    return dayDiff(last.changed_at);
}

export default function ReportAnalytics() {
    const { user } = useAuth();
    const { data: cachedData, refreshAll } = useGlobalData();
    const [liveTasks, setLiveTasks] = useState<any[] | null>(null);
    const [desktopPage, setDesktopPage] = useState(1);
    const [desktopSearchQuery, setDesktopSearchQuery] = useState("");
    const [mobileSelectedTaskId, setMobileSelectedTaskId] = useState("");
    const [mobileSearchQuery, setMobileSearchQuery] = useState("");

    const effectiveUid = user?.uid;

    useEffect(() => {
        if (effectiveUid) {
            refreshAll(effectiveUid, user?.email || undefined, user?.displayName || undefined, true);
        }
    }, [effectiveUid, user?.email, user?.displayName, refreshAll]);

    useEffect(() => {
        let mounted = true;

        const loadLiveTasks = async () => {
            if (!effectiveUid) {
                if (mounted) setLiveTasks([]);
                return;
            }

            try {
                const direct = await fetchTasks(effectiveUid, user?.email || undefined);
                if (mounted) {
                    setLiveTasks(Array.isArray(direct) ? direct : []);
                }
            } catch {
                if (mounted) {
                    setLiveTasks(null);
                }
            }
        };

        loadLiveTasks();
        return () => {
            mounted = false;
        };
    }, [effectiveUid, user?.email]);

    const tasks = useMemo(() => {
        const fromLive = Array.isArray(liveTasks) ? liveTasks : [];
        const fromCache = Array.isArray(cachedData.tasks) ? cachedData.tasks : [];
        const merged = [...fromCache, ...fromLive];

        // Merge by id so one empty source cannot hide existing tasks.
        const uniqueMap = new Map<string, any>();
        for (const task of merged) {
            const key = String(task?.id || "");
            if (!key) continue;
            uniqueMap.set(key, task);
        }

        return Array.from(uniqueMap.values()).sort((a: any, b: any) => {
            const aTime = new Date(a?.created_at || 0).getTime();
            const bTime = new Date(b?.created_at || 0).getTime();
            return bTime - aTime;
        });
    }, [liveTasks, cachedData.tasks]);

    const summary = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((t: any) => t.rapor_durumu === "Tamamlandı");
        const completedDays = completed
            .map((t: any) => (typeof t.completed_in_days === "number" ? t.completed_in_days : null))
            .filter((v: number | null): v is number => v !== null);

        const avgCompletedDays = completedDays.length > 0
            ? Math.round(completedDays.reduce((a: number, b: number) => a + b, 0) / completedDays.length)
            : 0;

        const stalledCount = tasks.filter((t: any) => {
            const timeline = getTimeline(t);
            const last = timeline[timeline.length - 1];
            const idle = dayDiff(last.changed_at);
            return t.rapor_durumu !== "Tamamlandı" && (idle ?? 0) >= 14;
        }).length;

        const performanceScore = total > 0
            ? Math.min(100, Math.round((completed.length / total) * 100))
            : 0;

        return { total, completed: completed.length, avgCompletedDays, stalledCount, performanceScore };
    }, [tasks]);

    const DESKTOP_PER_PAGE = 4;

    const desktopFilteredTasks = useMemo(() => {
        const query = desktopSearchQuery.trim().toLocaleLowerCase("tr");
        if (!query) return tasks;

        return tasks.filter((task: any) => {
            const code = String(task?.rapor_kodu || "").toLocaleLowerCase("tr");
            const name = String(task?.rapor_adi || "").toLocaleLowerCase("tr");
            return code.includes(query) || name.includes(query);
        });
    }, [tasks, desktopSearchQuery]);

    const hasDesktopSearch = desktopSearchQuery.trim().length > 0;
    const desktopAutoFocusedTask = hasDesktopSearch && desktopFilteredTasks.length > 0
        ? desktopFilteredTasks[0]
        : null;

    const totalDesktopPages = Math.max(1, Math.ceil(tasks.length / DESKTOP_PER_PAGE));

    const desktopVisibleTasks = useMemo(() => {
        const start = (desktopPage - 1) * DESKTOP_PER_PAGE;
        return tasks.slice(start, start + DESKTOP_PER_PAGE);
    }, [tasks, desktopPage]);

    useEffect(() => {
        setDesktopPage(1);
    }, [desktopSearchQuery]);

    useEffect(() => {
        if (desktopPage > totalDesktopPages) {
            setDesktopPage(totalDesktopPages);
        }
    }, [desktopPage, totalDesktopPages]);

    useEffect(() => {
        if (!tasks.length) {
            setMobileSelectedTaskId("");
            return;
        }

        const exists = tasks.some((t: any) => String(t.id) === String(mobileSelectedTaskId));
        if (!exists) {
            setMobileSelectedTaskId(String(tasks[0].id));
        }
    }, [tasks, mobileSelectedTaskId]);

    const mobileSelectedTask = useMemo(() => {
        if (!mobileSelectedTaskId) return null;
        return tasks.find((t: any) => String(t.id) === String(mobileSelectedTaskId)) || null;
    }, [tasks, mobileSelectedTaskId]);

    const mobileFilteredTasks = useMemo(() => {
        const query = mobileSearchQuery.trim().toLocaleLowerCase("tr");
        if (!query) return tasks;

        return tasks.filter((task: any) => {
            const code = String(task?.rapor_kodu || "").toLocaleLowerCase("tr");
            const name = String(task?.rapor_adi || "").toLocaleLowerCase("tr");
            return code.includes(query) || name.includes(query);
        });
    }, [tasks, mobileSearchQuery]);

    useEffect(() => {
        if (!mobileFilteredTasks.length) {
            setMobileSelectedTaskId("");
            return;
        }

        const existsInFiltered = mobileFilteredTasks.some((t: any) => String(t.id) === String(mobileSelectedTaskId));
        if (!existsInFiltered) {
            setMobileSelectedTaskId(String(mobileFilteredTasks[0].id));
        }
    }, [mobileFilteredTasks, mobileSelectedTaskId]);

    const renderTaskCard = (task: any) => {
        const timeline = getTimeline(task);
        const last = timeline[timeline.length - 1];
        const idleDays = dayDiff(last.changed_at) ?? 0;
        const currentStageDays = getCurrentStageDays(task);
        const phases = getPhaseDurations(task);
        const completeText = task.rapor_durumu === "Tamamlandı"
            ? `${task.completed_in_days ?? "-"} gün`
            : "-";
        const currentTone = getStatusTone(task.rapor_durumu || "Başlanmadı");

        return (
            <div
                key={task.id}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/65 p-4 md:p-5 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)]"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black text-primary tracking-wider">{task.rapor_kodu}</p>
                        <p className="text-base font-black text-slate-800 dark:text-slate-100 mt-1 leading-snug">{task.rapor_adi}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black shrink-0 ${currentTone.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentTone.dot}`} />
                        {task.rapor_durumu}
                    </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Eklendi</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 inline-flex items-center gap-1"><CalendarClock size={13} /> {formatDate(task.created_at)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tamamlanma</p>
                        <p className="text-xs font-bold text-emerald-600 mt-1 inline-flex items-center gap-1"><CheckCircle2 size={13} /> {completeText}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Son İşlem</p>
                        <p className="text-xs font-bold text-amber-600 mt-1 inline-flex items-center gap-1"><Clock3 size={13} /> {formatDate(last.changed_at)}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{idleDays} gün önce</p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mevcut Süreç</p>
                        <p className="text-xs font-bold text-blue-600 mt-1 inline-flex items-center gap-1">
                            <BarChart3 size={13} />
                            {currentStageDays === null
                                ? "Tamamlandı"
                                : `${task.rapor_durumu} ${currentStageDays} gündür`}
                        </p>
                    </div>
                </div>

                <div className="mt-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Aşama Süreleri</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {phases.map((phase, idx) => {
                            const tone = getStatusTone(phase.label);
                            const dayText = phase.days === null ? "-" : String(phase.days);
                            return (
                                <div
                                    key={`${task.id}-${phase.label}-${idx}`}
                                    className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 px-3 py-2 bg-white dark:bg-slate-900/70"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black ${tone.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                                            {phase.label}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md border text-[10px] font-black ${tone.time}`}>
                                            {dayText} gün
                                        </span>
                                    </div>
                                    <p className="mt-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                        Başlangıç: {formatDate(phase.startAt)}
                                    </p>
                                    {phase.visits > 1 && (
                                        <p className="mt-1 text-[10px] font-bold text-blue-500 dark:text-blue-400">
                                            {phase.visits} kez ziyaret edildi
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                    <Shield size={10} className="text-primary/60" />
                    <span>MufYard</span>
                    <ChevronRight size={10} />
                    <span className="text-primary opacity-80 uppercase tracking-widest">Görev Analizleri</span>
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Görev Analizleri</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">Görevin ne zaman eklendiği, hangi aşamada ne kadar kaldığı ve son işlem süreleri.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <Card className="p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Toplam Görev</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{summary.total}</p>
                </Card>
                <Card className="p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamamlanan</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">{summary.completed}</p>
                </Card>
                <Card className="p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ort. Tamamlama</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">{summary.avgCompletedDays} gün</p>
                </Card>
                <Card className="p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">14+ Gün İşlemsiz</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{summary.stalledCount}</p>
                </Card>
                <Card className="p-4 border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Performans Skoru</p>
                    <p className="text-2xl font-black text-indigo-600 mt-1">%{summary.performanceScore}</p>
                </Card>
            </div>

            <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/80 to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.45)]">
                <div className="px-5 py-4 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-black text-sm uppercase tracking-widest text-slate-600 dark:text-slate-300">Görev Yaşam Döngüsü</h3>
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                            <Sparkles size={12} /> Premium
                        </span>
                    </div>
                </div>

                <div className="p-4 md:p-5">
                    {tasks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-sm font-bold text-slate-400">
                            Analiz için görev bulunamadı.
                        </div>
                    ) : (
                        <>
                            <div className="lg:hidden mb-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Görev Ara</label>
                                <input
                                    type="text"
                                    value={mobileSearchQuery}
                                    onChange={(e) => setMobileSearchQuery(e.target.value)}
                                    placeholder="Kod veya görev adı yaz..."
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"
                                />

                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Görev Seç</label>
                                <select
                                    value={mobileSelectedTaskId}
                                    onChange={(e) => setMobileSelectedTaskId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                >
                                    {mobileFilteredTasks.map((task: any) => (
                                        <option key={task.id} value={task.id}>
                                            {task.rapor_kodu} - {task.rapor_adi}
                                        </option>
                                    ))}
                                </select>
                                {mobileFilteredTasks.length === 0 && (
                                    <p className="text-xs font-bold text-slate-400 mt-2">Aramaya uygun görev bulunamadı.</p>
                                )}
                            </div>

                            <div className="lg:hidden">
                                {mobileSelectedTask ? renderTaskCard(mobileSelectedTask) : null}
                            </div>

                            <div className="hidden lg:block mb-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Görev Ara</label>
                                <div className="relative max-w-xl">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={desktopSearchQuery}
                                        onChange={(e) => setDesktopSearchQuery(e.target.value)}
                                        placeholder="Kod veya görev adı yaz..."
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-10 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                    />
                                    {desktopSearchQuery.trim().length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setDesktopSearchQuery("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                                            aria-label="Aramayı temizle"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="hidden lg:grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {desktopAutoFocusedTask
                                    ? renderTaskCard(desktopAutoFocusedTask)
                                    : desktopVisibleTasks.map((task: any) => renderTaskCard(task))}
                            </div>

                            {hasDesktopSearch && desktopFilteredTasks.length === 0 && (
                                <p className="hidden lg:block text-sm font-bold text-slate-400 mt-1">Aramaya uygun görev bulunamadı.</p>
                            )}

                            {!hasDesktopSearch && totalDesktopPages > 1 && (
                                <div className="hidden lg:flex items-center justify-between mt-4">
                                    <p className="text-xs font-bold text-slate-500">Sayfa {desktopPage} / {totalDesktopPages}</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDesktopPage((p) => Math.max(1, p - 1))}
                                            disabled={desktopPage === 1}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Önceki
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDesktopPage((p) => Math.min(totalDesktopPages, p + 1))}
                                            disabled={desktopPage === totalDesktopPages}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 disabled:opacity-50"
                                        >
                                            Sonraki
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
