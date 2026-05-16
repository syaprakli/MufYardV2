
import { toast } from "react-hot-toast";

export interface QueuedAction {
    id: string;
    action: string; // 'updateTask', 'createNote', etc.
    args: any[];
    timestamp: number;
}

const QUEUE_STORAGE_KEY = 'mufyard_offline_queue';

export function addToQueue(action: string, args: any[]) {
    const queue: QueuedAction[] = getQueue();
    const newAction: QueuedAction = {
        id: Math.random().toString(36).substr(2, 9),
        action,
        args,
        timestamp: Date.now()
    };
    
    queue.push(newAction);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    
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

export async function processQueue(apiMap: Record<string, Function>) {
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} queued actions...`);
    toast.loading(`${queue.length} işlem senkronize ediliyor...`, { id: 'syncing' });

    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
        const func = apiMap[item.action];
        if (func) {
            try {
                await func(...item.args);
                successCount++;
            } catch (error) {
                console.error(`Failed to sync action ${item.action}:`, error);
                failCount++;
                // Keep it in queue? For now, we'll just log failure to avoid infinite retry loops if it's a 400 error.
            }
        }
    }

    clearQueue();
    
    if (failCount === 0) {
        toast.success(`${successCount} işlem başarıyla senkronize edildi.`, { id: 'syncing' });
    } else {
        toast.error(`${successCount} işlem senkronize edildi, ${failCount} işlem başarısız oldu.`, { id: 'syncing' });
    }
}
