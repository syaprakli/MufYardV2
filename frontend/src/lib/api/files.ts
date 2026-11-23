import { API_URL, IS_ELECTRON, IS_PACKAGED_DESKTOP, FILES_API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

// Kurulu masaüstünde yerel dosya servisi (Belgeler/MufYARD), web ve geliştirme modunda API_URL
const CURRENT_FILES_API = FILES_API_URL;

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
        const prefix = scope === "other" ? "Diğer İşlem ve Belgeler" : "Raporlar";
        const cleanId = id ? id.replace(/^[/\\]+/, "") : "";
        const relPath = cleanId ? `${prefix}/${cleanId}` : prefix;
        const res = await (window as any).electronAPI.openFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "Klasör açılamadı");
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

    if (!response.ok) throw new Error("Klasör açılamadı");
    return response.json();
};

export const openFile = async (id: string, scope?: string): Promise<any> => {
    if (IS_ELECTRON && typeof window !== "undefined" && (window as any).electronAPI?.showItemInFolder) {
        const prefix = scope === "other" ? "Diğer İşlem ve Belgeler" : "Raporlar";
        const cleanId = id ? id.replace(/^[/\\]+/, "") : "";
        const relPath = cleanId ? `${prefix}/${cleanId}` : prefix;
        const res = await (window as any).electronAPI.showItemInFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "Dosya açılamadı");
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

    if (!response.ok) throw new Error("Dosya açılamadı");
    return response.json();
};


export interface TaskFolderInfo {
    rapor_turu?: string;
    rapor_kodu?: string;
    rapor_adi?: string;
    baslama_tarihi?: string;
}

/**
 * Kurulu masaüstü: görev klasörünü bilgisayarda (Belgeler/MufYARD/Raporlar) oluşturur; görevin kodu, adı,
 * türü veya tarihi değiştiyse eski klasörü yeni adına taşır. Yol yerel servis tarafından hesaplanır.
 */
export const syncLocalTaskFolder = async (taskId: string, info: TaskFolderInfo): Promise<{ rel_path: string; path: string; renamed: boolean }> => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${FILES_API_URL}/files/sync-task-folder/${encodeURIComponent(taskId)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            rapor_turu: info.rapor_turu,
            rapor_kodu: info.rapor_kodu,
            rapor_adi: info.rapor_adi,
            baslama_tarihi: info.baslama_tarihi
        })
    });
    if (!response.ok) throw new Error("Görev klasörü hazırlanamadı");
    return response.json();
};

/** Görev oluşturma/güncelleme sonrası: yalnızca kurulu masaüstünde, hatayı kullanıcıya yansıtmadan eşitler. */
export const syncLocalTaskFolderQuietly = (task: any): void => {
    if (!IS_PACKAGED_DESKTOP || !task?.id) return;
    if (!task.rapor_adi && !task.rapor_kodu) return;
    syncLocalTaskFolder(task.id, task).catch(err => console.warn("Yerel görev klasörü eşitlenemedi:", err));
};

export const openTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    if (IS_PACKAGED_DESKTOP && (window as any).electronAPI?.openFolder && metadata) {
        // Yolu yerel servis hesaplar (klasör yoksa oluşturur, adı değiştiyse taşır)
        const { rel_path } = await syncLocalTaskFolder(taskId, metadata);
        const res = await (window as any).electronAPI.openFolder(rel_path);
        if (!res?.ok) throw new Error(res?.error || "Görev klasörü açılamadı");
        return { status: "success", path: res.path };
    }
    if (IS_ELECTRON && typeof window !== "undefined" && (window as any).electronAPI?.openFolder) {
        const relPath = buildSafeLocalTaskFolderRelPath(metadata);
        const res = await (window as any).electronAPI.openFolder(relPath);
        if (!res?.ok) throw new Error(res?.error || "Görev klasörü açılamadı");
        return { status: "success", path: res.path };
    }
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/files/open-task-folder/${taskId}`, {
        method: "POST",
        headers,
        body: metadata ? JSON.stringify(metadata) : undefined
    });

    if (!response.ok) throw new Error("Görev klasörü açılamadı");
    return response.json();
};

export const createTaskFolder = async (taskId: string, metadata?: any): Promise<any> => {
    if (IS_PACKAGED_DESKTOP && metadata) {
        return syncLocalTaskFolder(taskId, metadata);
    }
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/files/create-task-folder/${taskId}`, {
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

