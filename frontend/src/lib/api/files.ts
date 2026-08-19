import { API_URL, LOCAL_API_URL, IS_ELECTRON } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

// Masaüstündeysen yerel backend'i (Belgelerim/MufYARD), Web'deysen Railway'i kullan
const CURRENT_FILES_API = IS_ELECTRON ? LOCAL_API_URL : API_URL;

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
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = new URL(`${CURRENT_FILES_API}/files/open-folder/${safeId}`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers
    });
    
    if (!response.ok) throw new Error("Klasör açılamadı");
    return response.json();
};

export const openFile = async (id: string, scope?: string): Promise<any> => {
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = new URL(`${CURRENT_FILES_API}/files/open-file/${safeId}`);
    if (scope) url.searchParams.append("scope", scope);
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers
    });
    
    if (!response.ok) throw new Error("Dosya açılamadı");
    return response.json();
};

export const openTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    const baseUrl = IS_ELECTRON ? LOCAL_API_URL : API_URL;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${baseUrl}/files/open-task-folder/${taskId}`, {
        method: "POST",
        headers,
        body: metadata ? JSON.stringify(metadata) : undefined
    });
    
    if (!response.ok) throw new Error("Görev klasörü açılamadı");
    return response.json();
};

export const createTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    const baseUrl = IS_ELECTRON ? LOCAL_API_URL : API_URL;
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${baseUrl}/files/create-task-folder/${taskId}`, {
        method: "POST",
        headers,
        body: metadata ? JSON.stringify(metadata) : undefined
    });
    
    if (!response.ok) throw new Error("Görev klasörü oluşturulamadı");
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
