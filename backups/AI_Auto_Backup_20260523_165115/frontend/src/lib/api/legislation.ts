import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

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
    const res = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/promote?user_name=${encodeURIComponent(userName)}`, {
        method: "POST"
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
    
    const response = await fetchWithTimeout(url);
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
): Promise<{file_url: string}> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("doc_type", doc_type);
    if (uid) formData.append("uid", uid);
    formData.append("is_public", is_public ? "true" : "false");

    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/upload`, {
        method: "POST",
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
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(legislation),
    });
    if (!response.ok) {
        throw new Error("Mevzuat oluşturulamadı.");
    }
    return response.json();
}

export async function approveLegislation(id: string, adminName: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/approve?admin_name=${encodeURIComponent(adminName)}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Onaylanamadı.");
}

export async function rejectLegislation(id: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}/reject`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Reddedilemedi.");
}

export async function updateLegislation(id: string, update: Partial<LegislationCreate>): Promise<Legislation> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
    });
    if (!pop_response_ok(response)) {
        throw new Error("Mevzuat güncellenemedi.");
    }
    return response.json();
}

function pop_response_ok(response: Response) {
    return response.ok;
}

export async function deleteLegislation(id: string): Promise<{status: string, message: string}> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error("Mevzuat silinemedi.");
    }
    return response.json();
}

export async function openLegislationFolder(category?: string, doc_type?: string): Promise<{status: string, path: string}> {
    const params = new URLSearchParams();
    if (category && category !== 'Tümü') {
        params.append("category", category);
    }
    if (doc_type) {
        params.append("doc_type", doc_type);
    }
    
    const url = `${API_BASE_URL}/legislation/open-folder${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetchWithTimeout(url, {
        method: "POST"
    });
    
    if (!response.ok) {
        throw new Error("Klasör açılamadı.");
    }
    
    return response.json();
}

export async function extractLegislationText(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/extract-text`, {
        method: "POST",
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/legislation/fetch-external`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ url }),
        timeout: 45000
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Dış kaynaktan veri çekilemedi.");
    }
    return response.json();
}
