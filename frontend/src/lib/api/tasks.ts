import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";
import { addToQueue } from "./syncQueue";

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

export async function fetchTasks(userId?: string, userEmail?: string): Promise<Task[]> {
    const cacheKey = `${userId || ""}|${userEmail || ""}`;
    const storageKey = `mufyard_tasks_cache_${userId || 'guest'}`;
    
    // 1. Memory Cache Check
    const cached = taskCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/`, { headers });
        if (!response.ok) throw new Error("Görevler yüklenemedi.");
        
        const data = await response.json();
        
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
                return parsed.data;
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
    return response.json();
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
        return response.json();
    } catch (error) {
        // Check if it's a network error
        if (!navigator.onLine || error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
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
