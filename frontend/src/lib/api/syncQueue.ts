
import { toast } from "react-hot-toast";
import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface QueuedAction {
    id: string;
    action: string; // 'updateTask', 'createNote', etc.
    args: any[];
    timestamp: number;
    meta?: Record<string, any>;
}

export interface SyncConflict {
    queueId: string;
    action: string;
    auditId?: string;
    timestamp: number;
    reason: string;
}

const QUEUE_STORAGE_KEY = 'mufyard_offline_queue';
const SYNC_CONFLICTS_STORAGE_KEY = 'mufyard_sync_conflicts';

export function addToQueue(action: string, args: any[], meta?: Record<string, any>) {
    const queue: QueuedAction[] = getQueue();

    // Aynı denetimin bekleyen güncellemesi varsa yenisi onunla birleştirilir: çevrimdışıyken her
    // kayıt tam denetim verisini taşıdığı için ayrı ayrı biriktirmek depolamayı hızla doldurur.
    const auditId = action === 'updateAudit' ? String(meta?.auditId || args?.[0] || '') : '';
    const existing = auditId
        ? queue.find(q => q.action === 'updateAudit' && String(q.meta?.auditId || q.args?.[0] || '') === auditId)
        : undefined;
    if (existing) {
        existing.args = [args[0], { ...(existing.args?.[1] || {}), ...(args[1] || {}) }, args[2] ?? existing.args?.[2], args[3] ?? existing.args?.[3]];
        existing.meta = {
            ...(existing.meta || {}),
            ...(meta || {}),
            hasReportContent: Boolean(existing.meta?.hasReportContent || meta?.hasReportContent),
            // İçerik aynı olsa bile (senkron sırasında yeniden kuyruğa alınma) değişiklik fark edilsin
            updatedAt: Date.now(),
        };
    } else {
        queue.push({
            id: Math.random().toString(36).substr(2, 9),
            action,
            args,
            timestamp: Date.now(),
            meta
        });
    }
    try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error("Offline queue could not be stored:", e);
        toast.error("Cihaz depolaması dolu: çevrimdışı değişiklik saklanamadı.", { id: 'offline-save-failed' });
        return;
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("mufyard-queue-updated"));
    }

    toast.success("Çevrimdışı kaydedildi. İnternet gelince senkronize edilecek.", {
        id: 'offline-save',
        icon: '💾',
        duration: 4000
    });
}

/** Denetim için henüz sunucuya gitmemiş (birleştirilmiş) güncelleme; yoksa null. */
export function getPendingAuditUpdate(auditId: string): Record<string, any> | null {
    const merged = getQueue()
        .filter(q => q.action === 'updateAudit' && String(q.meta?.auditId || q.args?.[0] || '') === auditId)
        .reduce((acc, q) => ({ ...acc, ...(q.args?.[1] || {}) }), {} as Record<string, any>);
    return Object.keys(merged).length ? merged : null;
}

export function getQueue(): QueuedAction[] {
    const data = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Queue parsing error:", e);
        return [];
    }
}

export function clearQueue() {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
}

export function getSyncConflicts(): SyncConflict[] {
    const data = localStorage.getItem(SYNC_CONFLICTS_STORAGE_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Sync conflict parsing error:", e);
        return [];
    }
}

export function clearSyncConflictsForAudit(auditId: string) {
    const next = getSyncConflicts().filter((item) => item.auditId !== auditId);
    localStorage.setItem(SYNC_CONFLICTS_STORAGE_KEY, JSON.stringify(next));
}

const setSyncConflicts = (conflicts: SyncConflict[]) => {
    if (conflicts.length === 0) {
        localStorage.removeItem(SYNC_CONFLICTS_STORAGE_KEY);
        return;
    }
    localStorage.setItem(SYNC_CONFLICTS_STORAGE_KEY, JSON.stringify(conflicts));
};

const hasNewerAuditVersion = async (auditId: string, queuedAt: number): Promise<boolean> => {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${auditId}/versions`);
        if (!response.ok) return false;
        const versions = await response.json();
        if (!Array.isArray(versions) || versions.length === 0) return false;
        const latest = versions[0];
        const latestAt = new Date(latest?.created_at || 0).getTime();
        if (!Number.isFinite(latestAt) || latestAt <= 0) return false;
        return latestAt > queuedAt;
    } catch {
        return false;
    }
};

export async function processQueue(apiMap: Record<string, Function>) {
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} queued actions...`);
    toast.loading(`${queue.length} işlem senkronize ediliyor...`, { id: 'syncing' });

    let successCount = 0;
    let failCount = 0;
    let conflictCount = 0;
    const remainingQueue: QueuedAction[] = [];
    const conflicts: SyncConflict[] = [];

    for (const item of queue) {
        if (item.action === 'updateAudit') {
            const auditId = item.meta?.auditId || item.args?.[0];
            if (auditId) {
                const newerVersionDetected = await hasNewerAuditVersion(String(auditId), item.timestamp);
                if (newerVersionDetected) {
                    conflictCount++;
                    remainingQueue.push(item);
                    conflicts.push({
                        queueId: item.id,
                        action: item.action,
                        auditId: String(auditId),
                        timestamp: item.timestamp,
                        reason: 'Sunucuda daha yeni bir sürüm bulundu. Manuel inceleme gerekli.'
                    });
                    continue;
                }
            }
        }

        const func = apiMap[item.action];
        if (func) {
            try {
                await func(...item.args);
                successCount++;
            } catch (error) {
                console.error(`Failed to sync action ${item.action}:`, error);
                failCount++;
                remainingQueue.push(item);
            }
        } else {
            failCount++;
            remainingQueue.push(item);
        }
    }

    // Senkronizasyon sırasında kuyruğa eklenenler (ör. yeniden kesilen bağlantıda tekrar kuyruğa
    // alınan işlem) silinmesin; işlenmiş bir öğe bu arada güncellendiyse yeni hali saklanır.
    const processedIds = new Set(queue.map(q => q.id));
    const snapshot = new Map(queue.map(q => [q.id, JSON.stringify(q)]));
    const current = getQueue();
    const changedDuringSync = current.filter(q => processedIds.has(q.id) && snapshot.get(q.id) !== JSON.stringify(q));
    const addedDuringSync = current.filter(q => !processedIds.has(q.id));
    const changedIds = new Set(changedDuringSync.map(q => q.id));
    const finalQueue = [
        ...remainingQueue.filter(q => !changedIds.has(q.id)),
        ...changedDuringSync,
        ...addedDuringSync,
    ];
    if (finalQueue.length === 0) {
        clearQueue();
    } else {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(finalQueue));
    }
    setSyncConflicts(conflicts);

    if (failCount === 0 && conflictCount === 0) {
        toast.success(`${successCount} işlem başarıyla senkronize edildi.`, { id: 'syncing' });
    } else if (conflictCount > 0) {
        toast.error(`${successCount} işlem senkronize edildi, ${conflictCount} işlemde çakışma tespit edildi.`, { id: 'syncing' });
    } else {
        toast.error(`${successCount} işlem senkronize edildi, ${failCount} işlem başarısız oldu.`, { id: 'syncing' });
    }

    return {
        successCount,
        failCount,
        conflictCount,
        remainingCount: finalQueue.length
    };
}
