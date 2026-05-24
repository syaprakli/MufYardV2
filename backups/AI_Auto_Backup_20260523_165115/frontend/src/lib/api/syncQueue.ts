
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
    const newAction: QueuedAction = {
        id: Math.random().toString(36).substr(2, 9),
        action,
        args,
        timestamp: Date.now(),
        meta
    };
    
    queue.push(newAction);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("mufyard-queue-updated"));
    }
    
    toast.success("Çevrimdışı kaydedildi. İnternet gelince senkronize edilecek.", {
        icon: '💾',
        duration: 4000
    });
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

    if (remainingQueue.length === 0) {
        clearQueue();
    } else {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remainingQueue));
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
        remainingCount: remainingQueue.length
    };
}
