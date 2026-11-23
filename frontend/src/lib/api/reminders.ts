import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";
import { addToQueue } from "./syncQueue";

export type ReminderType = 'zamanasimi' | 'genel';

export type ReminderCategory = 
    | 'disiplin_657' 
    | 'ceza_tck' 
    | 'mali_denetim' 
    | 'genel_gorev' 
    | 'ozel'
    | 'toplanti'
    | 'evrak_yazi'
    | 'durusma'
    | 'gorev'
    | 'diger';

export type ReminderStatus = 'active' | 'completed' | 'archived';
export type ReminderPriority = 'normal' | 'urgent' | 'critical';

export interface Reminder {
    id: string;
    owner_id: string;
    title: string;
    description?: string;
    reminder_type?: ReminderType | string;
    category: ReminderCategory | string;
    incident_date?: string;
    expiration_date: string;
    notify_before_months: number;
    notify_before_days?: number;
    status: ReminderStatus;
    priority: ReminderPriority;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
}

export interface ReminderCreate {
    title: string;
    description?: string;
    reminder_type?: ReminderType | string;
    category: ReminderCategory | string;
    incident_date?: string;
    expiration_date: string;
    notify_before_months?: number;
    notify_before_days?: number;
    status?: ReminderStatus;
    priority?: ReminderPriority;
    tags?: string[];
}

export interface ReminderUpdate {
    title?: string;
    description?: string;
    reminder_type?: ReminderType | string;
    category?: ReminderCategory | string;
    incident_date?: string;
    expiration_date?: string;
    notify_before_months?: number;
    notify_before_days?: number;
    status?: ReminderStatus;
    priority?: ReminderPriority;
    tags?: string[];
}

export const ZAMANASIMI_CATEGORIES: Record<string, { label: string; defaultYears: number; description: string }> = {
    disiplin_657: {
        label: "Disiplin Zamanaşımı (657 DMK)",
        defaultYears: 2,
        description: "Fiil tarihinden itibaren azami 2 yıl içinde ceza verilmezse ceza yetkisi zamanaşımına uğrar."
    },
    ceza_tck: {
        label: "Dava / Ceza Zamanaşımı (TCK)",
        defaultYears: 8,
        description: "TCK 66/1-e uyarınca genel dava zamanaşımı 8 yıldır."
    },
    mali_denetim: {
        label: "Mali / Sayıştay Denetimi (5018)",
        defaultYears: 5,
        description: "Mali işlemler ve kamu zararı iddialarında zamanaşımı süresi 5 yıldır."
    },
    genel_gorev: {
        label: "Teftiş / Görev Tamamlama Süresi",
        defaultYears: 1,
        description: "Görev emrinden itibaren hedeflenen teftiş ve raporlama süresi."
    },
    ozel: {
        label: "Özel Zamanaşımı / Süre",
        defaultYears: 0,
        description: "Kullanıcı tarafından belirlenen özel bir zamanaşımı veya kanuni süre."
    }
};

export const GENEL_CATEGORIES: Record<string, { label: string; description: string }> = {
    toplanti: {
        label: "Toplantı / Görüşme",
        description: "Bakanlık, kurul veya denetlenen birimle planlanan toplantı."
    },
    evrak_yazi: {
        label: "Evrak & Yazışma Takibi",
        description: "Cevabı beklenen resmi yazı, savunma veya bilgi istem yazısı."
    },
    durusma: {
        label: "Duruşma / İfade Alma",
        description: "Tanık dinleme, ifade alma veya adli süreç takvimi."
    },
    gorev: {
        label: "Genel Görev & Rapor",
        description: "Tamamlanması gereken ara inceleme veya çalışma görevi."
    },
    diger: {
        label: "Genel Hatırlatıcı / Not",
        description: "Kişisel veya mesleki serbest hatırlatıcı."
    }
};

export const ALL_CATEGORIES: Record<string, { label: string; description: string }> = {
    ...ZAMANASIMI_CATEGORIES,
    ...GENEL_CATEGORIES
};

/**
 * Fiil/Olay tarihine ve seçilen zamanaşımı kategorisine göre otomatik zamanaşımı tarihi hesaplar.
 */
export function calculateExpirationDate(incidentDateStr: string, category: string): string {
    if (!incidentDateStr) return "";
    const incidentDate = new Date(incidentDateStr);
    if (isNaN(incidentDate.getTime())) return "";

    const catInfo = ZAMANASIMI_CATEGORIES[category] || ZAMANASIMI_CATEGORIES.ozel;
    const yearsToAdd = catInfo.defaultYears || 1;

    const expiration = new Date(incidentDate);
    expiration.setFullYear(expiration.getFullYear() + yearsToAdd);
    
    return expiration.toISOString().split("T")[0];
}

/**
 * Hedef tarihe kalan gün sayısını hesaplar.
 */
export function getDaysRemaining(expirationDateStr: string): number {
    if (!expirationDateStr) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const exp = new Date(expirationDateStr);
    const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    
    const diffMs = expDay.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isExpired(expirationDateStr: string): boolean {
    return getDaysRemaining(expirationDateStr) < 0;
}

export async function fetchReminders(_uid?: string): Promise<Reminder[]> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/reminders/`, { headers });
        if (!response.ok) {
            throw new Error("Hatırlatıcılar yüklenemedi.");
        }
        return await response.json();
    } catch (error) {
        console.error("fetchReminders error:", error);
        const local = localStorage.getItem("mufyard_cached_reminders");
        if (local) {
            try { return JSON.parse(local); } catch { /* ignore */ }
        }
        throw error;
    }
}

export async function createReminder(reminder: ReminderCreate): Promise<Reminder> {
    try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        const response = await fetchWithTimeout(`${API_BASE_URL}/reminders/`, {
            method: "POST",
            headers,
            body: JSON.stringify(reminder),
        });

        if (!response.ok) {
            throw new Error("Hatırlatıcı oluşturulamadı.");
        }
        return await response.json();
    } catch (error) {
        if (!navigator.onLine || (error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout")))) {
            console.warn("Offline detected in createReminder, queueing action.");
            addToQueue('createReminder', [reminder]);
            return {
                id: `temp_${Date.now()}`,
                owner_id: "local",
                reminder_type: reminder.reminder_type || "zamanasimi",
                ...reminder,
                notify_before_months: reminder.notify_before_months || 2,
                status: reminder.status || "active",
                priority: reminder.priority || "urgent",
                created_at: new Date().toISOString()
            } as Reminder;
        }
        throw error;
    }
}

export async function updateReminder(id: string, updates: ReminderUpdate): Promise<Reminder> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/reminders/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw new Error("Hatırlatıcı güncellenemedi.");
    }
    return await response.json();
}

export async function deleteReminder(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/reminders/${id}`, {
        method: "DELETE",
        headers,
    });

    if (!response.ok) {
        throw new Error("Hatırlatıcı silinemedi.");
    }
}
