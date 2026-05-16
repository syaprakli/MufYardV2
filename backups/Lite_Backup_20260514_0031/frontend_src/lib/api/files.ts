import { API_URL, LOCAL_API_URL, IS_ELECTRON } from "../config";
import { fetchWithTimeout } from "./utils";

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
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/tree?path=${path || ""}`);
    if (!response.ok) throw new Error("Dosya ağacı yüklenemedi");
    return response.json();
};

export const uploadFile = async (file: File, path?: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const url = new URL(`${CURRENT_FILES_API}/files/upload`);
    if (path) url.searchParams.append("path", path);
    
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) throw new Error("Dosya yüklenemedi");
    return response.json();
};

export const createFolder = async (name: string, path: string, parentId?: string): Promise<any> => {
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/folder?path=${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId })
    });
    
    if (!response.ok) throw new Error("Klasör oluşturulamadı");
    return response.json();
};

export const deleteItem = async (id: string, uid?: string): Promise<any> => {
    // Slah'ları koruyarak diğer özel karakterleri encode et
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = uid ? `${CURRENT_FILES_API}/files/delete-item/${safeId}?uid=${uid}` : `${CURRENT_FILES_API}/files/delete-item/${safeId}`;
    
    const response = await fetchWithTimeout(url, {
        method: "DELETE"
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Silme işlemi başarısız" }));
        throw new Error(errorData.detail || "Silme işlemi başarısız");
    }
    return response.json();
};

export const openFolder = async (id: string): Promise<any> => {
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/open-folder/${safeId}`, {
        method: "POST"
    });
    
    if (!response.ok) throw new Error("Klasör açılamadı");
    return response.json();
};

export const openFile = async (id: string): Promise<any> => {
    const safeId = id.split('/').map(part => encodeURIComponent(part)).join('/');
    const response = await fetchWithTimeout(`${CURRENT_FILES_API}/files/open-file/${safeId}`, {
        method: "POST"
    });
    
    if (!response.ok) throw new Error("Dosya açılamadı");
    return response.json();
};

export const openTaskFolder = async (taskId: string): Promise<any> => {
    const baseUrl = IS_ELECTRON ? LOCAL_API_URL : API_URL;
    const response = await fetchWithTimeout(`${baseUrl}/files/open-task-folder/${taskId}`, {
        method: "POST"
    });
    
    if (!response.ok) throw new Error("Görev klasörü açılamadı");
    return response.json();
};

export const shareFileToUser = async (fileId: string, recipientId: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/files/share-to-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, recipient_id: recipientId })
    });

    if (!response.ok) throw new Error("Paylasilan dosya hazirlanamadi");
    return response.json();
};
