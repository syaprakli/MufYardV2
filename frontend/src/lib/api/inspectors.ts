import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Inspector {
    id: string;
    name: string;
    email: string;
    title: string;
    extension?: string;
    phone?: string;
    room?: string;
    uid?: string;
    force_unlinked?: boolean;
    created_at: string;
}

export interface InspectorCreate {
    name: string;
    email: string;
    title: string;
    extension?: string;
    phone?: string;
    room?: string;
    uid?: string;
}

export async function fetchInspectors(): Promise<Inspector[]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const headers = await getAuthHeaders();
            const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/`, { timeout: 25000, headers });
            if (!response.ok) {
                throw new Error("Müfettişler yüklenemedi.");
            }
            return response.json();
        } catch (error) {
            lastError = error;
            if (attempt === 0) {
                await delay(1200);
                continue;
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Müfettişler yüklenemedi.");
}

export async function addInspector(inspector: InspectorCreate): Promise<Inspector> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/`, {
        method: "POST",
        headers,
        body: JSON.stringify(inspector),
    });
    if (!response.ok) throw new Error("Müfettiş eklenemedi.");
    return response.json();
}

export async function deleteInspector(id: string): Promise<{ status: string }> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/${id}`, {
        method: "DELETE",
        headers,
    });
    if (!response.ok) throw new Error("Müfettiş silinemedi.");
    return response.json();
}

export async function addInspectorsBulk(inspectors: InspectorCreate[]): Promise<{ count: number }> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/bulk`, {
        method: "POST",
        headers,
        body: JSON.stringify(inspectors),
    });
    if (!response.ok) throw new Error("Toplu müfettiş ekleme başarısız.");
    return response.json();
}

export async function updateInspector(id: string, inspector: InspectorCreate): Promise<Inspector> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(inspector),
    });
    if (!response.ok) throw new Error("Müfettiş güncellenemedi.");
    return response.json();
}

export async function uploadAndSyncInspectors(file: File): Promise<{ status: string, message: string, processed: number }> {
    const formData = new FormData();
    formData.append("file", file);
    
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/upload-and-sync`, {
        method: "POST",
        headers,
        body: formData,
        timeout: 60000 // 60s timeout for large excel files
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Müfettiş listesi senkronize edilemedi.");
    }
    
    return response.json();
}

export async function syncInspectorsFromContacts(): Promise<{ status: string, message: string, processed: number }> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/sync-from-contacts`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Rehberden müfettiş senkronizasyonu başarısız.");
    }

    return response.json();
}

export async function linkInspectorToProfile(inspectorId: string, profileUid: string): Promise<Inspector> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/${inspectorId}/link`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ profile_uid: profileUid }),
    });
    if (!response.ok) throw new Error("Eşleştirme başarısız.");
    return response.json();
}
