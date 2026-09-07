import { API_URL as API_BASE_URL, LOCAL_API_URL, IS_ELECTRON } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

const CURRENT_LEGISLATION_API = IS_ELECTRON ? LOCAL_API_URL : API_BASE_URL;

export interface Legislation {
    id: string;
    title: string;
    category: string;
    doc_type: string;
    summary?: string;
    content?: string;
    tags?: string[];
    official_gazette_info?: string;
    document_url?: string;
    local_path?: string;
    is_approved: boolean;
    approved_by?: string;
    approved_at?: string;
    owner_id?: string;
    created_by_name?: string;
    last_updated_by_name?: string;
    is_public: boolean;
    is_pinned: boolean;
    is_archived: boolean;
    created_at: string;
}

export const promoteToPublic = async (id: string, userName: string): Promise<Legislation> => {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/promote?user_name=${encodeURIComponent(userName)}`, {
        method: "POST",
        headers
    });
    return res.json();
};

export interface LegislationCreate {
    owner_id?: string;
    is_public: boolean;
    title: string;
    category: string;
    summary?: string;
    content: string;
    tags: string[];
    document_url?: string;
    official_gazette_info?: string;
    is_pinned: boolean;
}

export async function fetchLegislations(uid?: string, category?: string, isAdmin: boolean = false): Promise<Legislation[]> {
    const params = new URLSearchParams();
    if (uid) params.append("uid", uid);
    if (category && category !== 'All' && category !== 'Tümü') {
        params.append("category", category);
    }
    if (isAdmin) params.append("is_admin", "true");
    
    const url = `${API_BASE_URL}/legislation/${params.toString() ? '?' + params.toString() : ''}`;
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
        throw new Error("Mevzuat yüklenemedi.");
    }
    return response.json();
}

export async function uploadLegislationFile(
    file: File, 
    category: string, 
    doc_type: string = "", 
    uid?: string, 
    is_public: boolean = true
): Promise<{file_url: string; local_path?: string}> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("doc_type", doc_type);
    if (uid) formData.append("uid", uid);
    formData.append("is_public", is_public ? "true" : "false");

    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/upload`, {
        method: "POST",
        headers,
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Dosya yüklenemedi.");
    }

    return response.json();
}

export async function createLegislation(legislation: Partial<Legislation>, isAdmin: boolean = false): Promise<Legislation> {
    const url = `${API_BASE_URL}/legislation/${isAdmin ? '?is_admin=true' : ''}`;
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(legislation),
    });
    if (!response.ok) {
        throw new Error("Mevzuat oluşturulamadı.");
    }
    return response.json();
}

export async function approveLegislation(id: string, adminName: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/approve?admin_name=${encodeURIComponent(adminName)}`, {
        method: "POST",
        headers
    });
    if (!response.ok) throw new Error("Onaylanamadı.");
}

export async function rejectLegislation(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/reject`, {
        method: "POST",
        headers
    });
    if (!response.ok) throw new Error("Reddedilemedi.");
}

export async function updateLegislation(id: string, update: Partial<Legislation>): Promise<Legislation> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Mevzuat güncellenemedi.");
    }
    return response.json();
}

export async function deleteLegislation(id: string): Promise<{status: string, message: string}> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}`, {
        method: "DELETE",
        headers
    });
    if (!response.ok) {
        throw new Error("Mevzuat silinemedi.");
    }
    return response.json();
}

export async function openLegislationFolder(category?: string, doc_type?: string): Promise<{status: string, path: string}> {
    console.log("[Mevzuat] openLegislationFolder called with category:", category, "doc_type:", doc_type);
    
    // 1. Local backend API (same as files.ts)
    try {
        const params = new URLSearchParams();
        if (category && category !== 'Tümü') {
            params.append("category", category);
        }
        if (doc_type) {
            params.append("doc_type", doc_type);
        }
        
        const url = `${CURRENT_LEGISLATION_API}/legislation/open-folder${params.toString() ? '?' + params.toString() : ''}`;
        console.log("[Mevzuat] Backend HTTP open-folder requested:", url);
        const headers = await getAuthHeaders();
        
        const response = await fetchWithTimeout(url, {
            method: "POST",
            headers
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("[Mevzuat] Backend HTTP open-folder success:", data);
            return data;
        } else {
            console.warn("[Mevzuat] Backend HTTP open-folder non-ok response, status:", response.status);
        }
    } catch (e) {
        console.warn("[Mevzuat] Backend HTTP open-folder failed, trying electronAPI fallback:", e);
    }

    // 2. Electron Native Shell fallback
    if (typeof window !== 'undefined') {
        const electronAPI = (window as any)?.electronAPI;
        if (electronAPI?.openFolder) {
            let rel = "Mevzuat";
            if (category && category !== 'Tümü') {
                rel = doc_type ? `Mevzuat/${category}/${doc_type}` : `Mevzuat/${category}`;
            }
            try {
                console.log("[Mevzuat] Electron IPC openFolder sending:", rel);
                const res = await electronAPI.openFolder(rel);
                console.log("[Mevzuat] Electron IPC openFolder response:", res);
                if (res?.ok) {
                    return { status: "success", path: res.path };
                }
            } catch (e) {
                console.error("[Mevzuat] Electron openFolder fallback failed:", e);
            }
        }
    }

    throw new Error("Klasör açılamadı.");
}

export async function openLegislationFileLocation(filePath?: string, category?: string, docType?: string): Promise<{status: string, type: 'file' | 'folder', path: string, message?: string}> {
    console.log("[Mevzuat] openLegislationFileLocation called with:", { filePath, category, docType });
    const isWebUrl = typeof filePath === 'string' && (filePath.startsWith('http://') || filePath.startsWith('https://'));
    const cleanFilePath = isWebUrl ? undefined : filePath;

    // 1. Local backend API (same as files.ts)
    try {
        const params = new URLSearchParams();
        if (cleanFilePath) params.append("file_path", cleanFilePath);
        if (category && category !== 'Tümü') params.append("category", category);
        if (docType) params.append("doc_type", docType);

        const url = `${CURRENT_LEGISLATION_API}/legislation/open-file-location?${params.toString()}`;
        console.log("[Mevzuat] Backend HTTP open-file-location requested:", url);
        const headers = await getAuthHeaders();

        const response = await fetchWithTimeout(url, {
            method: "POST",
            headers
        });

        if (response.ok) {
            const data = await response.json();
            console.log("[Mevzuat] Backend HTTP open-file-location success:", data);
            return data;
        } else {
            console.warn("[Mevzuat] Backend HTTP open-file-location non-ok status:", response.status);
        }
    } catch (e) {
        console.warn("[Mevzuat] Backend HTTP open-file-location failed, trying electronAPI fallback:", e);
    }

    // 2. Electron Native Shell fallback
    if (typeof window !== 'undefined') {
        const electronAPI = (window as any)?.electronAPI;
        if (electronAPI?.showItemInFolder) {
            let target = cleanFilePath || "";
            if (!target && category && category !== 'Tümü') {
                target = docType ? `Mevzuat/${category}/${docType}` : `Mevzuat/${category}`;
            }
            try {
                console.log("[Mevzuat] Electron IPC showItemInFolder sending:", target);
                const res = await electronAPI.showItemInFolder(target);
                console.log("[Mevzuat] Electron IPC showItemInFolder response:", res);
                if (res?.ok) {
                    return { 
                        status: "success", 
                        type: res.type || 'file', 
                        path: res.path, 
                        message: isWebUrl ? "Bu mevzuat web üzerinden eklenmiş; ilgili mevzuat klasörü açıldı." : res.message 
                    };
                }
            } catch (e) {
                console.error("[Mevzuat] Electron showItemInFolder fallback failed:", e);
            }
        }
    }

    throw new Error("Dosya konumu açılamadı.");
}

export async function syncLegislationFolder(): Promise<{status: string, imported_count: number, total_files: number, folder_path: string, message: string}> {
    const backendUrl = LOCAL_API_URL || API_BASE_URL;
    const url = `${backendUrl}/legislation/sync-folder`;
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Klasör senkronize edilemedi.");
    }
    
    return response.json();
}

export async function extractLegislationText(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/extract-text`, {
        method: "POST",
        headers,
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Metin çıkarılamadı.");
    }
    
    const data = await response.json();
    return data.text;
}

export async function fetchExternalLegislation(url: string): Promise<Partial<Legislation>> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json"
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/fetch-external`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
        timeout: 45000
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Dış kaynaktan veri çekilemedi.");
    }
    return response.json();
}
