import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface SearchResult {
    id: string;
    title: string;
    snippet: string;
    type: string;
    [key: string]: any;
}

export async function searchReports(query: string): Promise<SearchResult[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/search/reports?q=${encodeURIComponent(query)}`, {
        headers: await getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error("Arama başarısız oldu.");
    }
    return response.json();
}

export interface EmsalRapor {
    audit_id: string;
    task_id?: string | null;
    baslik: string;
    tarih?: string;
    rapor_turu?: string;
    birim?: string;
    ozet: string;
    puan: number;
}

export interface EmsalTenkit {
    id: string;
    audit_id: string;
    task_id?: string | null;
    baslik: string;
    durum?: string;
    onem?: string;
    dayanak?: string | null;
    birim_adi?: string;
    rapor_turu?: string;
    denetim_basligi?: string;
    denetim_tarihi?: string;
    ozet: string;
    birim_cevabi?: string;
    puan: number;
}

export interface EmsalSonucu {
    terimler: string[];
    raporlar: EmsalRapor[];
    tenkitler: EmsalTenkit[];
    toplam?: { rapor: number; tenkit: number };
}

/** Eski raporlar ve tenkitlerde arama (yalnızca erişebildiğiniz denetimler). */
export async function emsalAra(q: string, raporTuru?: string, yenile = false): Promise<EmsalSonucu> {
    const p = new URLSearchParams({ q });
    if (raporTuru) p.set("rapor_turu", raporTuru);
    if (yenile) p.set("yenile", "true");
    const res = await fetchWithTimeout(`${API_BASE_URL}/search/emsal?${p.toString()}`, {
        headers: await getAuthHeaders(),
        timeout: 45000,
    });
    if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(typeof e?.detail === "string" ? e.detail : "Arama yapılamadı.");
    }
    return res.json();
}
