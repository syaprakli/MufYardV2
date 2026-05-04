import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface FileItem {
    id: string;
    name: string;
    type: 'file' | 'folder' | 'image' | 'video' | 'audio' | 'pdf';
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
