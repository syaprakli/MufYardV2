import { API_URL, IS_ELECTRON } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

// Masaüstündeysen yerel backend'i (Belgelerim/MufYARD), Web'deysen Railway'i kullan
const CURRENT_FILES_API = API_URL;

function buildSafeLocalTaskFolderRelPath(metadata?: any): string {
    const clean = (v: unknown, fallback: string) => {
        const s = String(v || fallback).replace(/\//g, "-").replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ _.\-]/g, "_").trim();
        return s || fallback;
    };
    const dateStr = String(metadata?.baslama_tarihi || "");
    const yearMatch = dateStr.match(/\b(20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
    const typeLabels: Record<string, string> = {
        inceleme: "İnceleme",
        sorusturma: "Soruşturma",
        genel_denetim: "Genel_Denetim",
        ozel_yurt: "Özel_Yurt",
        kyk_yurt: "KYK_Yurt",
        il_mudurlugu: "İl_Müdürlüğü",
        federasyon: "Federasyon",
        kulup: "Kulüp"
    };
    const rawType = String(metadata?.rapor_turu || "Diger");
    const typeFolder = typeLabels[rawType] || clean(rawType, "Diger");
    const code = clean(metadata?.rapor_kodu, "Kodsuz");
    const title = clean(metadata?.rapor_adi, "Basliksiz");
    return `Raporlar/${year}/${typeFolder}/${code} - ${title}`;
}

export interface FileItem {
    id: string;
    name: string;
    type: 'file' | 'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text';
    parentId?: string;
    size?: string;
    date?: string;
    url?: string;
}

export const fetchFileTree = async (path?: string, scope?: string): Promise<FileItem[]> => {
    const headers = await getAuthHeaders();
    const url = new URL(`${CURRENT_FILES_API}/files/tree`);
    if (path) url.searchParams.append("path", path);
    if (scope) url.searchParams.append("scope", scope);
    const response = await fetchWithTimeout(url.toString(), { headers });
    if (!response.ok) throw new Error("Dosya ağacı yüklenemedi");
    return response.json();
};

export const uploadFile = async (file: File, path?: string, uid?: string, scope?: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const url = new URL(`${CURRENT_FILES_API}/files/upload`);
    if (path) url.searchParams.append("path", path);
    if (uid) url.searchParams.append("uid", uid);
    if (scope) url.searchParams.append("scope", scope);
    
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: formData
    });
    
    if (!response.ok) throw new Error("Dosya yüklenemedi");
    return response.json();
};

export const createFolder = async (name: string, path: string, parentId?: string, uid?: string, scope?: string): Promise<any> => {
    const url = new URL(`${CURRENT_FILES_API}/files/create-folder`);
    if (uid) url.searchParams.append("uid", uid);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });

    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ name, parentId: parentId || path })
    });
    
    if (!response.ok) throw new Error("Klasör oluşturulamadı");
    return response.json();
};

export const deleteItem = async (id: string, scope?: string): Promise<any> => {
    // Slah'ları koruyarak diğer özel karakterleri encode et
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = new URL(`${CURRENT_FILES_API}/files/delete-item/${safeId}`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(url.toString(), {
        method: "DELETE",
        headers
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Silme işlemi başarısız" }));
        throw new Error(errorData.detail || "Silme işlemi başarısız");
    }
    return response.json();
};

export const openFolder = async (id: string, scope?: string): Promise<any> => {
    if (IS_ELECTRON && typeof window !== "undefined" && (window as any).electronAPI?.openFolder) {
        const prefix = scope === "other" ? "Di?er ??lem ve Belgeler" : "Raporlar";
        const cleanId = id ? id.replace(/^[/\\]+/, "") : "";
        const relPath = cleanId ? `${prefix}/${cleanId}` : prefix;
        const res = await (window as any).electronAPI.openFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "Klas?r a??lamad?");
        return { status: "success", path: res.path };
    }
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = new URL(`${CURRENT_FILES_API}/files/open-folder/${safeId}`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers
    });

    if (!response.ok) throw new Error("Klas?r a??lamad?");
    return response.json();
};

export const openFile = async (id: string, scope?: string): Promise<any> => {
    if (IS_ELECTRON && typeof window !== "undefined" && (window as any).electronAPI?.showItemInFolder) {
        const prefix = scope === "other" ? "Di?er ??lem ve Belgeler" : "Raporlar";
        const cleanId = id ? id.replace(/^[/\\]+/, "") : "";
        const relPath = cleanId ? `${prefix}/${cleanId}` : prefix;
        const res = await (window as any).electronAPI.showItemInFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "Dosya a??lamad?");
        return { status: "success", path: res.path };
    }
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = new URL(`${CURRENT_FILES_API}/files/open-file/${safeId}`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers
    });

    if (!response.ok) throw new Error("Dosya a??lamad?");
    return response.json();
};

export const openTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    if (IS_ELECTRON && typeof window !== "undefined" && (window as any).electronAPI?.openFolder) {
        const relPath = buildSafeLocalTaskFolderRelPath(metadata);
        const res = await (window as any).electronAPI.openFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "G?rev klas?r? a??lamad?");
        return { status: "success", path: res.path };
    }
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/files/open-task-folder/${taskId}`, {
        method: "POST",
        headers,
        body: metadata ? JSON.stringify(metadata) : undefined
    });

    if (!response.ok) throw new Error("G?rev klas?r? a??lamad?");
    return response.json();
};

export const createTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/files/create-task-folder/${taskId}`, {
        method: "POST",
        headers,
        body: metadata ? JSON.stringify(metadata) : undefined
    });

    if (!response.ok) throw new Error("G?rev klas?r? olu?turulamad?");
    return response.json();
};

export const shareFileToUser = async (fileId: string, recipientId: string, scope?: string): Promise<any> => {
    const url = new URL(`${API_URL}/files/share-to-user`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ file_id: fileId, recipient_id: recipientId })
    });

    if (!response.ok) throw new Error("Paylasilan dosya hazirlanamadi");
    return response.json();
};


export const generateKapakDocx = async (data: any): Promise<any> => {
    const url = `${CURRENT_FILES_API}/files/generate-docx-kapak`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Kapak Word belgesi oluşturulamadı.");
    return response.json();
};

export const generateDiziDocx = async (data: any): Promise<any> => {
    const url = `${CURRENT_FILES_API}/files/generate-docx-dizi`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Dizi Pusulası Word belgesi oluşturulamadı.");
    return response.json();
};

export const generateEvrakTalebiDocx = async (data: any): Promise<any> => {
    const url = `${CURRENT_FILES_API}/files/generate-docx-hazirlik`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Evrak Talebi Word belgesi oluşturulamadı.");
    return response.json();
};

export const generateDegerlendirmeDocx = async (data: any): Promise<any> => {
    const url = `${CURRENT_FILES_API}/files/generate-docx-degerlendirme`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Değerlendirme Formu Word belgesi oluşturulamadı.");
    return response.json();
};

export const generateOzetTablolarDocx = async (data: any): Promise<any> => {
    const url = `${CURRENT_FILES_API}/files/generate-docx-ozet-tablolar`;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Özet Tablolar Word belgesi oluşturulamadı." }));
        throw new Error(err.detail || "Özet Tablolar Word belgesi oluşturulamadı.");
    }
    return response.json();
};

