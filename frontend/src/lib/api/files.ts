import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface FileItem {
    id: string;
    name: string;
    type: 'file' | 'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text';
    parentId?: string;
    size?: string;
    date?: string;
    url?: string;
}

export const fetchFileTree = async (): Promise<FileItem[]> => {
    const response = await fetchWithTimeout(`${API_URL}/files/tree`);
    if (!response.ok) throw new Error("Dosya ağacı yüklenemedi");
    return response.json();
};

export const uploadFile = async (file: File, path?: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const url = new URL(`${API_URL}/files/upload`);
    if (path) url.searchParams.append("path", path);
    
    const response = await fetchWithTimeout(url.toString(), {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) throw new Error("Dosya yüklenemedi");
    return response.json();
};

export const createFolder = async (name: string, parentId?: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/files/create-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId })
    });
    
    if (!response.ok) throw new Error("Klasör oluşturulamadı");
    return response.json();
};

export const deleteItem = async (id: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/files/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
    
    if (!response.ok) throw new Error("Silme işlemi başarısız");
    return response.json();
};

export const openFolder = async (id: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/files/open-folder/${encodeURIComponent(id)}`, {
        method: "POST"
    });
    
    if (!response.ok) throw new Error("Klasör açılamadı");
    return response.json();
};

export const openFile = async (id: string): Promise<any> => {
    const response = await fetchWithTimeout(`${API_URL}/files/open-file/${encodeURIComponent(id)}`, {
        method: "POST"
    });
    
    if (!response.ok) throw new Error("Dosya açılamadı");
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
