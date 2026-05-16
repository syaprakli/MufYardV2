import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export async function exportSystemData(): Promise<void> {
    const response = await fetchWithTimeout(`${API_URL}/backup/export`, {
        method: "POST"
    });
    
    if (!response.ok) {
        throw new Error("Veri dışa aktarma başarısız.");
    }
    
    // Process the file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MufYard_Backup_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

export async function backupToDrive(): Promise<{status: string, drive_id?: string, error?: string}> {
    // Drive yedeklemesi Google girişi bekleyebileceği için timeout süresini 60 saniyeye çıkarıyoruz
    const response = await fetchWithTimeout(`${API_URL}/backup/drive-backup`, {
        method: "POST",
        timeout: 60000 // Timeout artık options içinde
    });
    
    const data = await response.json();
    if (!response.ok || data.error) {
        throw new Error(data.error || "Drive yedeklemesi başarısız.");
    }
    
    return data;
}

export async function importSystemData(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetchWithTimeout(`${API_URL}/backup/import`, {
        method: "POST",
        body: formData,
        timeout: 120000 // 2 minute timeout for large imports
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Veri içe aktarma başarısız.");
    }
    
    return response.json();
}
