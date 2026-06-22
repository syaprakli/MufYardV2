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

export const fetchFileTree = async (path?: string): Promise<FileItem[]> => {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/tree?path=${path || ""}`, { headers });
    if (!response.ok) throw new Error("Dosya ağacı yüklenemedi");
    return response.json();
};

export const uploadFile = async (file: File, path?: string, uid?: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const url = new URL(`${CURRENT_FILES_API}/files/upload`);
    if (path) url.searchParams.append("path", path);
    if (uid) url.searchParams.append("uid", uid);
    
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: formData
    });
    
    if (!response.ok) throw new Error("Dosya yüklenemedi");
    return response.json();
};

export const createFolder = async (name: string, path: string, parentId?: string, uid?: string): Promise<any> => {
    const url = new URL(`${CURRENT_FILES_API}/files/create-folder`);
    if (uid) url.searchParams.append("uid", uid);
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });

    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ name, parentId: parentId || path })
    });
    
    if (!response.ok) throw new Error("Klasör oluşturulamadı");
    return response.json();
};

export const deleteItem = async (id: string): Promise<any> => {
    // Slah'ları koruyarak diğer özel karakterleri encode et
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = `${CURRENT_FILES_API}/files/delete-item/${safeId}`;
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(url, {
        method: "DELETE",
        headers
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Silme işlemi başarısız" }));
        throw new Error(errorData.detail || "Silme işlemi başarısız");
    }
    return response.json();
};

export const openFolder = async (id: string): Promise<any> => {
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/open-folder/${safeId}`, {
        method: "POST",
        headers
    });
    
    if (!response.ok) throw new Error("Klasör açılamadı");
    return response.json();
};

export const openFile = async (id: string): Promise<any> => {
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/open-file/${safeId}`, {
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

export const shareFileToUser = async (fileId: string, recipientId: string): Promise<any> => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/files/share-to-user`, {
        method: "POST",
        headers,
        body: JSON.stringify({ file_id: fileId, recipient_id: recipientId })
    });

    if (!response.ok) throw new Error("Paylasilan dosya hazirlanamadi");
    return response.json();
};
