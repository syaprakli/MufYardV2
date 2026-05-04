import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface Inspector {
    id: string;
    name: string;
    email: string;
    title: string;
    extension?: string;
    phone?: string;
    room?: string;
    uid?: string;
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/`);
    if (!response.ok) throw new Error("Müfettişler yüklenemedi.");
    return response.json();
}

export async function addInspector(inspector: InspectorCreate): Promise<Inspector> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspector),
    });
    if (!response.ok) throw new Error("Müfettiş eklenemedi.");
    return response.json();
}

export async function deleteInspector(id: string): Promise<{ status: string }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) throw new Error("Müfettiş silinemedi.");
    return response.json();
}

export async function addInspectorsBulk(inspectors: InspectorCreate[]): Promise<{ count: number }> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspectors),
    });
    if (!response.ok) throw new Error("Toplu müfettiş ekleme başarısız.");
    return response.json();
}

export async function updateInspector(id: string, inspector: InspectorCreate): Promise<Inspector> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspector),
    });
    if (!response.ok) throw new Error("Müfettiş güncellenemedi.");
    return response.json();
}

export async function uploadAndSyncInspectors(file: File): Promise<{ status: string, message: string, processed: number }> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/upload-and-sync`, {
        method: "POST",
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/inspectors/sync-from-contacts`, {
        method: "POST",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Rehberden müfettiş senkronizasyonu başarısız.");
    }

    return response.json();
}
