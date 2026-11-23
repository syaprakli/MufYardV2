import type { Reminder } from "../lib/api/reminders";
import { getDaysRemaining } from "../lib/api/reminders";
import { toast } from "react-hot-toast";

interface NotificationLog {
    [reminderId: string]: number; // timestamp of last sent desktop notification
}

const STORAGE_KEY = "mufyard_reminder_notification_log";

function getNotificationLog(): NotificationLog {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveNotificationLog(log: NotificationLog) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {
        // ignore
    }
}

/**
 * Sends a native Windows (Electron) notification or browser notification
 */
export function sendDesktopNotification(title: string, body: string) {
    try {
        if ((window as any).electronAPI && typeof (window as any).electronAPI.showNotification === "function") {
            (window as any).electronAPI.showNotification(title, body);
            return;
        }

        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification(title, { body, icon: "/favicon.ico" });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        new Notification(title, { body, icon: "/favicon.ico" });
                    }
                });
            }
        }
    } catch (err) {
        console.warn("Desktop notification could not be sent:", err);
    }
}

/**
 * Checks all active reminders and triggers notifications based on type & frequency rules
 */
export function checkAndNotifyExpiringReminders(reminders: Reminder[], isStartup: boolean = false) {
    if (!Array.isArray(reminders) || reminders.length === 0) return;

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
    const notifLog = getNotificationLog();
    let updatedLog = false;

    const criticalExpiring: { reminder: Reminder; days: number }[] = [];

    reminders.forEach((r) => {
        if (r.status !== "active") return;

        const days = getDaysRemaining(r.expiration_date);
        const isZamanasimi = (r.reminder_type || "zamanasimi") === "zamanasimi";

        if (isZamanasimi) {
            // Zamanaşımı kuralı: 2 ay (60 gün) ve daha az
            const warningMonths = r.notify_before_months || 2;
            const warningDaysThreshold = warningMonths * 30;

            if (days <= warningDaysThreshold && days >= 0) {
                criticalExpiring.push({ reminder: r, days });

                const lastNotified = notifLog[r.id] || 0;
                let shouldNotify = false;

                if (isStartup && now - lastNotified > 12 * 60 * 60 * 1000) {
                    shouldNotify = true;
                } else if (days <= 30 && now - lastNotified > ONE_DAY_MS) {
                    shouldNotify = true;
                } else if (days > 30 && now - lastNotified > SEVEN_DAYS_MS) {
                    shouldNotify = true;
                }

                if (shouldNotify) {
                    const title = `⚠️ Zamanaşımı Uyarısı: ${r.title}`;
                    const body = days === 0 
                        ? "DİKKAT: Bu dosyanın zamanaşımı süresi BUGÜN doluyor!" 
                        : `Zamanaşımına ${days} gün kaldı! Lütfen gerekli işlemleri tamamlayınız.`;

                    sendDesktopNotification(title, body);
                    notifLog[r.id] = now;
                    updatedLog = true;
                }
            } else if (days < 0) {
                const lastNotified = notifLog[r.id] || 0;
                if (now - lastNotified > SEVEN_DAYS_MS) {
                    sendDesktopNotification(
                        `🛑 Zamanaşımı Doldu: ${r.title}`,
                        `Bu dosyanın zamanaşımı süresi ${Math.abs(days)} gün önce doldu.`
                    );
                    notifLog[r.id] = now;
                    updatedLog = true;
                }
            }
        } else {
            // Genel Hatırlatıcı kuralı (gün bazlı: örn 3 gün, 1 gün veya günü gelince)
            const warningDaysThreshold = typeof r.notify_before_days === "number" ? r.notify_before_days : 3;

            if (days <= warningDaysThreshold && days >= 0) {
                const lastNotified = notifLog[r.id] || 0;
                let shouldNotify = false;

                if (isStartup && now - lastNotified > 12 * 60 * 60 * 1000) {
                    shouldNotify = true;
                } else if (now - lastNotified > ONE_DAY_MS) {
                    shouldNotify = true;
                }

                if (shouldNotify) {
                    const title = `📌 Hatırlatıcı: ${r.title}`;
                    const body = days === 0 
                        ? "Bugün planlanan bir hatırlatıcınız var!" 
                        : `${days} gün sonra planlanan hatırlatıcınız var.`;

                    sendDesktopNotification(title, body);
                    notifLog[r.id] = now;
                    updatedLog = true;
                }
            }
        }
    });

    if (updatedLog) {
        saveNotificationLog(notifLog);
    }

    if (isStartup && criticalExpiring.length > 0) {
        const nearest = [...criticalExpiring].sort((a, b) => a.days - b.days)[0];
        toast(
            `⏰ 2 ay ve daha az süresi kalan ${criticalExpiring.length} zamanaşımı dosyası var! En yakın: "${nearest.reminder.title}" (${nearest.days} gün)`,
            {
                icon: "⚠️",
                duration: 7000,
                style: {
                    border: "1px solid #f59e0b",
                    padding: "12px 16px",
                    color: "#b45309",
                    fontWeight: 700
                }
            }
        );
    }
}
