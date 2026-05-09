import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

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
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
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
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
}

// Smart Cache
let taskCache: { [key: string]: { data: Task[], timestamp: number } } = {};
const CACHE_DURATION = 60 * 1000;

export async function fetchTasks(userId?: string, userEmail?: string): Promise<Task[]> {
    const cacheKey = `${userId || ""}|${userEmail || ""}`;
    const cached = taskCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    let url = `${API_BASE_URL}/tasks/?`;
    if (userId) url += `user_id=${userId}&`;
    if (userEmail) url += `user_email=${userEmail}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error("Görevler yüklenemedi.");
    const data = await response.json();
    taskCache[cacheKey] = { data, timestamp: Date.now() };
    return data;
}

export async function createTask(task: TaskCreate): Promise<Task> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
    });
    if (!response.ok) throw new Error("Görev oluşturulamadı.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function updateTask(id: string, update: Partial<TaskCreate & { steps: TaskStep[], rapor_durumu: string, shared_with: string[] }>): Promise<Task> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
    });
    if (!response.ok) throw new Error("Görev güncellenemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function deleteTask(id: string): Promise<{ status: string; message: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) throw new Error("Görev silinemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function acceptTask(id: string, userId: string, userEmail?: string): Promise<{ status: string; message: string }> {
    const params = new URLSearchParams();
    if (userId) params.set("user_id", userId);
    if (userEmail) params.set("user_email", userEmail);
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/${id}/accept?${params.toString()}`, {
        method: "POST",
    });
    if (!response.ok) throw new Error("Görev kabul edilemedi.");
    taskCache = {}; // Invalidate
    return response.json();
}

export async function importTasksFromExcel(userId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/tasks/import?uid=${userId}`, {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "İçe aktarma başarısız oldu.");
    }
    
    taskCache = {}; // Invalidate
    return response.json();
}
