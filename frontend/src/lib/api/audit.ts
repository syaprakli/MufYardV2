import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface Audit {
    id: string;
    task_id?: string;
    title: string;
    location: string;
    date: string;
    status: string;
    inspector: string;
    description?: string;
    report_content?: string;
    created_at?: string;
    owner_id?: string;
    assigned_to?: string[];
    shared_with?: string[];
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
    is_public?: boolean;
    report_seq?: number;
}

export interface AuditVersion {
    id: string;
    version_name: string;
    report_content: string;
    created_at: string;
    user: string;
}

// Smart Cache
let auditCache: { [key: string]: { data: Audit[], timestamp: number } } = {};
const CACHE_DURATION = 60 * 1000;

export async function fetchAudits(userId?: string, userEmail?: string, forceRefresh: boolean = false): Promise<Audit[]> {
    const key = `${userId || 'anon'}_${userEmail || 'anon'}`;
    const now = Date.now();
    
    if (!forceRefresh && auditCache[key] && (now - auditCache[key].timestamp < CACHE_DURATION)) {
        return auditCache[key].data;
    }

    let url = `${API_BASE_URL}/audit/?`;
    if (userId) url += `user_id=${userId}&`;
    if (userEmail) url += `user_email=${userEmail}`;
    
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error("Denetimler yüklenemedi.");
    }
    const data = await response.json();
    auditCache[key] = { data, timestamp: now };
    return data;
}

export function invalidateAuditCache(): void {
    auditCache = {};
}

export async function fetchAuditById(id: string): Promise<Audit> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}`);
    if (!response.ok) {
        throw new Error("Denetim bulunamadı.");
    }
    return response.json();
}

export async function createAudit(audit: Partial<Audit>): Promise<Audit> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(audit),
    });
    if (!response.ok) {
        throw new Error("Denetim oluşturulamadı.");
    }
    auditCache = {}; // Invalidate all cache on change
    return response.json();
}

export async function updateAudit(id: string, update: Partial<Audit>): Promise<Audit> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        throw new Error("Güncelleme başarısız.");
    }
    auditCache = {}; // Invalidate cache
    return response.json();
}

export async function deleteAudit(id: string): Promise<{status: string, message: string}> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}`, {
        method: "DELETE"
    });
    if (!response.ok) {
        throw new Error("Silme işlemi başarısız.");
    }
    auditCache = {}; // Invalidate cache
    return response.json();
}

export async function exportAuditsToExcel(): Promise<void> {
    window.open(`${API_BASE_URL}/audit/export/excel`, "_self");
}

export async function exportAuditToWord(id: string): Promise<void> {
    window.open(`${API_BASE_URL}/audit/${id}/export/word`, "_self");
}

export async function fetchAuditVersions(id: string): Promise<AuditVersion[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/versions`);
    if (!response.ok) {
        throw new Error("Sürüm geçmişi yüklenemedi.");
    }
    return response.json();
}

export async function restoreAuditVersion(id: string, versionId: string): Promise<Audit> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/restore/${versionId}`, {
        method: "POST"
    });
    if (!response.ok) {
        throw new Error("Sürüm geri yüklenemedi.");
    }
    auditCache = {}; // Invalidate cache
    return response.json();
}

export async function acceptAudit(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.append("user_email", userEmail);
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/accept?${params.toString()}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Rapor kabul edilemedi.");
    auditCache = {};
    return response.json();
}

export async function rejectAudit(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.append("user_email", userEmail);
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/reject?${params.toString()}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Rapor reddedilemedi.");
    auditCache = {};
    return response.json();
}
