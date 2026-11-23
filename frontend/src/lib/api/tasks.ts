import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders, isNetworkError } from "./utils";
import { addToQueue } from "./syncQueue";
import { syncLocalTaskFolderQuietly } from "./files";

export interface TaskStep {
    text: string;
    done: boolean;
}

export interface Task {
    id: string;
    rapor_kodu: string;
    rapor_adi: string;
    rapor_turu: string;
    baslama_tarihi: string;
    olur_tarihi?: string;
    sure_gun: number;
    rapor_durumu: string;
    steps: TaskStep[];
    inspector: string;
    is_public?: boolean;
    owner_id?: string;
    assigned_to?: string[];
    shared_with?: string[];
    shared_roles?: Record<string, "view" | "comment" | "edit">;
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
    created_at?: string;
    completed_at?: string;
    completed_in_days?: number;
    parent_task_id?: string;
    status_history?: Array<{
        status: string;
        changed_at: string;
        from?: string;
        to?: string;
    }>;
}

export interface TaskCreate {
    rapor_kodu?: string;
    rapor_adi: string;
    rapor_turu: string;
    baslama_tarihi: string;
    olur_tarihi?: string;
    sure_gun: number;
    rapor_durumu?: string;
    steps?: TaskStep[];
    inspector?: string;
    is_public?: boolean;
    owner_id?: string;
    assigned_to?: string[];
    shared_with?: string[];
    shared_roles?: Record<string, "view" | "comment" | "edit">;
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
    completed_at?: string;
    completed_in_days?: number;
    parent_task_id?: string;
    status_history?: Array<{
        status: string;
        changed_at: string;
        from?: string;
        to?: string;
    }>;
}

// Smart Cache
let taskCache: { [key: string]: { data: Task[], timestamp: number } } = {};
const CACHE_DURATION = 60 * 1000;
const TEST_UID = "tolEIwlWrHfWCQduDuXcnqBvWdo2";
const TEST_EMAIL = "test@mufyard.com";

function filterTestTasks(tasks: Task[], userId?: string, userEmail?: string): Task[] {
    const isTest = userId === TEST_UID || (userEmail || "").toLowerCase().trim() === TEST_EMAIL;
    if (isTest || !Array.isArray(tasks)) return tasks;
    return tasks.filter(t => {
        const owner = (t.owner_id || "").toLowerCase();
        const assigned = (t.assigned_to || []).map(a => String(a).toLowerCase());
        const shared = (t.shared_with || []).map(s => String(s).toLowerCase());
        const accepted = (t.accepted_collaborators || []).map(s => String(s).toLowerCase());
        const testIds = [TEST_UID.toLowerCase(), TEST_EMAIL];
        if (testIds.includes(owner)) return false;
        if (assigned.some(a => testIds.includes(a))) return false;
        if (shared.some(s => testIds.includes(s))) return false;
        if (accepted.some(s => testIds.includes(s))) return false;
        return true;
    });
}

export function clearTaskCache() {
    taskCache = {};
}

export async function fetchTasks(userId?: string, userEmail?: string, forceRefresh: boolean = false): Promise<Task[]> {
    const cacheKey = `${userId || ""}|${userEmail || ""}`;
    const storageKey = `mufyard_tasks_cache_${userId || 'guest'}`;

    // 1. Memory Cache Check
    const cached = taskCache[cacheKey];
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return filterTestTasks(cached.data, userId, userEmail);
    }

    try {
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/`, { headers });
        if (!response.ok) throw new Error("Görevler yüklenemedi.");

        const rawData = await response.json();
        const data = filterTestTasks(rawData, userId, userEmail);

        // Update both memory and persistent cache
        taskCache[cacheKey] = { data, timestamp: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify({
            data,
            timestamp: Date.now()
        }));

        return data;
    } catch (error) {
        console.warn("Network error fetching tasks, attempting to load from local storage:", error);

        // 2. Persistent Cache Fallback (Offline Mode)
        const localData = localStorage.getItem(storageKey);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log("Loaded tasks from local storage fallback.");
                return filterTestTasks(parsed.data, userId, userEmail);
            } catch (e) {
                console.error("Error parsing local tasks cache:", e);
            }
        }

        throw error;
    }
}

export async function createTask(task: TaskCreate): Promise<Task> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/`, {
        method: "POST",
        headers,
        body: JSON.stringify(task),
    });
    if (!response.ok) throw new Error("Görev oluşturulamadı.");
    taskCache = {}; // Invalidate
    const created = await response.json();
    syncLocalTaskFolderQuietly(created); // kurulu masaüstü: klasör bilgisayarda açılır
    return created;
}

export async function updateTask(id: string, update: Partial<TaskCreate & { steps: TaskStep[], rapor_durumu: string, shared_with: string[] }>): Promise<Task> {
    try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(update),
        });
        if (!response.ok) throw new Error("Görev güncellenemedi.");
        taskCache = {}; // Invalidate
        const updated = await response.json();
        // Kurulu masaüstü: kod/ad/tür/tarih değiştiyse (sunucunun ürettiği kalıcı rapor kodu dahil) yerel klasörü taşı
        syncLocalTaskFolderQuietly(updated);
        return updated;
    } catch (error) {
        // Check if it's a network error
        if (isNetworkError(error)) {
            console.warn("Offline detected in updateTask, queueing action.");
            addToQueue('updateTask', [id, update]);

            // Return a partial object so UI can update immediately (Optimistic UI)
            return { id, ...update } as any;
        }
        throw error;
    }
}

export async function deleteTask(id: string): Promise<{ status: string; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}`, {
        method: "DELETE",
        headers,
    });
    if (!response.ok) throw new Error("Görev silinemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function acceptTask(id: string, _userId: string, _userEmail?: string): Promise<{ status: string; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}/accept`, {
        method: "POST",
        headers,
    });
    if (!response.ok) throw new Error("Görev kabul edilemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function rejectTask(id: string, _userId: string, _userEmail?: string): Promise<{ status: string; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}/reject`, {
        method: "POST",
        headers,
    });
    if (!response.ok) throw new Error("Görev reddedilemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function importTasksFromExcel(_userId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/import`, {
        method: "POST",
        headers,
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "İçe aktarma başarısız oldu.");
    }

    taskCache = {}; // Invalidate
    return response.json();
}
