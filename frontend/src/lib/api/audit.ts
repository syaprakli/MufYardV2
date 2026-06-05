import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";
import { addToQueue } from "./syncQueue";

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
    shared_roles?: Record<string, "view" | "comment" | "edit">;
    pending_collaborators?: string[];
    is_public?: boolean;
    report_seq?: number;
    doc_header?: string;
    doc_footer?: string;
    show_page_numbers?: boolean;
    version_name?: string;
    audit_data?: any;
    report_created?: boolean;
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
    const storageKey = `mufyard_audits_cache_${userId || 'guest'}`;
    const now = Date.now();
    
    if (!forceRefresh && auditCache[key] && (now - auditCache[key].timestamp < CACHE_DURATION)) {
        return auditCache[key].data;
    }

    try {
        const url = `${API_BASE_URL}/audit/`;
        const headers = await getAuthHeaders();
        
        const response = await fetchWithTimeout(url, { headers });
        if (!response.ok) {
            throw new Error("Denetimler yüklenemedi.");
        }
        const data = await response.json();
        
        // Update both memory and persistent cache
        auditCache[key] = { data, timestamp: now };
        localStorage.setItem(storageKey, JSON.stringify({
            data,
            timestamp: now
        }));
        
        return data;
    } catch (error) {
        console.warn("Network error fetching audits, attempting local fallback:", error);
        
        const localData = localStorage.getItem(storageKey);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log("Loaded audits from local storage fallback.");
                return parsed.data;
            } catch (e) {
                console.error("Error parsing local audits cache:", e);
            }
        }
        
        throw error;
    }
}

export function invalidateAuditCache(): void {
    auditCache = {};
}

export async function fetchAuditById(id: string): Promise<Audit> {
    const storageKey = `mufyard_audit_detail_${id}`;
    
    try {
        const headers = await getAuthHeaders();
        const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}`, { headers });
        if (!response.ok) {
            throw new Error("Denetim bulunamadı.");
        }
        const data = await response.json();
        
        // Cache the individual audit report
        localStorage.setItem(storageKey, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        
        return data;
    } catch (error) {
        console.warn(`Network error fetching audit ${id}, attempting local fallback:`, error);
        
        const localData = localStorage.getItem(storageKey);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log(`Loaded audit ${id} from local storage fallback.`);
                return parsed.data;
            } catch (e) {
                console.error("Error parsing local audit detail cache:", e);
            }
        }
        
        throw error;
    }
}

export async function createAudit(audit: Partial<Audit>): Promise<Audit> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/`, {
        method: "POST",
        headers,
        body: JSON.stringify(audit),
    });
    if (!response.ok) {
        throw new Error("Denetim oluşturulamadı.");
    }
    auditCache = {}; // Invalidate all cache on change
    return response.json();
}

export async function updateAudit(
    id: string,
    update: Partial<Audit>,
    forceVersion?: boolean,
    userIdentity?: { userId?: string; userEmail?: string }
): Promise<Audit> {
    try {
        let url = `${API_BASE_URL}/audit/${id}`;
        const query = new URLSearchParams();
        if (forceVersion) query.set("force_version", "true");
        void userIdentity;
        if (query.toString()) {
            url += `?${query.toString()}`;
        }
        const headers = await getAuthHeaders({
            "Content-Type": "application/json",
        });
        const response = await fetchWithTimeout(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(update),
        });
        if (!response.ok) {
            throw new Error("Güncelleme başarısız.");
        }
        auditCache = {}; // Invalidate cache
        return response.json();
    } catch (error) {
        if (!navigator.onLine || error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
            console.warn("Offline detected in updateAudit, queueing action.");
            addToQueue('updateAudit', [id, update, forceVersion, userIdentity], {
                auditId: id,
                hasReportContent: Object.prototype.hasOwnProperty.call(update, "report_content")
            });
            return { id, ...update } as any;
        }
        throw error;
    }
}

export async function deleteAudit(id: string): Promise<{status: string, message: string}> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}`, {
        method: "DELETE",
        headers,
    });
    if (!response.ok) {
        throw new Error("Silme işlemi başarısız.");
    }
    auditCache = {}; // Invalidate cache
    return response.json();
}

export async function exportAuditsToExcel(): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/export/excel`, { headers });
    if (!response.ok) throw new Error("Excel raporu oluşturulamadı");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Tum_Denetimler.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function exportAuditToWord(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/export/word`, { headers });
    if (!response.ok) throw new Error("Word raporu oluşturulamadı");
    const blob = await response.blob();
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `Denetim_Raporu.docx`;
    if (contentDisposition) {
        const match = contentDisposition.match(/filename=([^;]+)/);
        if (match) filename = match[1].trim();
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function fetchAuditVersions(id: string): Promise<AuditVersion[]> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/versions`, { headers });
    if (!response.ok) {
        throw new Error("Sürüm geçmişi yüklenemedi.");
    }
    return response.json();
}

export async function restoreAuditVersion(id: string, versionId: string, userIdentity?: { userId?: string; userEmail?: string }): Promise<Audit> {
    let url = `${API_BASE_URL}/audit/${id}/restore/${versionId}`;
    void userIdentity;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
    });
    if (!response.ok) {
        throw new Error("Sürüm geri yüklenemedi.");
    }
    auditCache = {}; // Invalidate cache
    return response.json();
}

export async function deleteAuditVersion(id: string, versionId: string): Promise<{status: string, message: string}> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/versions/${versionId}`, {
        method: "DELETE",
        headers,
    });
    if (!response.ok) {
        throw new Error("Sürüm silinemedi.");
    }
    return response.json();
}

export async function acceptAudit(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    void userId;
    void userEmail;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/accept`, {
        headers,
        method: "POST"
    });
    if (!response.ok) throw new Error("Rapor kabul edilemedi.");
    auditCache = {};
    return response.json();
}

export async function rejectAudit(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    void userId;
    void userEmail;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit/${id}/reject`, {
        headers,
        method: "POST"
    });
    if (!response.ok) throw new Error("Rapor reddedilemedi.");
    auditCache = {};
    return response.json();
}
