import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export type TenkitDurumu = "acik" | "cevap_bekleniyor" | "giderildi" | "kismen_giderildi" | "giderilmedi";
export type TenkitOnemi = "kritik" | "uyari" | "bilgi";

export interface Tenkit {
    id: string;
    audit_id: string;
    baslik: string;
    aciklama?: string | null;
    dayanak?: string | null;
    alan?: string | null;
    onem: TenkitOnemi;
    kaynak: "kontrol_listesi" | "tenkit_havuzu" | "manuel";
    kaynak_ref?: string | null;
    durum: TenkitDurumu;
    birim_cevabi?: string | null;
    cevap_tarihi?: string | null;
    takip_notu?: string | null;
    birim_adi?: string;
    created_at?: string;
    updated_at?: string;
    gecmis?: { durum: TenkitDurumu; tarih: string; kullanici?: string }[];
    denetim_basligi?: string;
    denetim_tarihi?: string;
}

export const DURUM_ETIKETLERI: Record<TenkitDurumu, string> = {
    acik: "Açık",
    cevap_bekleniyor: "Cevap Bekleniyor",
    giderildi: "Giderildi",
    kismen_giderildi: "Kısmen Giderildi",
    giderilmedi: "Giderilmedi",
};

export const ONEM_ETIKETLERI: Record<TenkitOnemi, string> = {
    kritik: "Kritik",
    uyari: "Uyarı",
    bilgi: "Bilgi",
};

async function hataMesaji(response: Response, varsayilan: string): Promise<never> {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.detail && typeof err.detail === "string" ? err.detail : varsayilan);
}

export async function fetchTenkitler(auditId: string): Promise<Tenkit[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/?audit_id=${encodeURIComponent(auditId)}`, { headers });
    if (!res.ok) return hataMesaji(res, "Tenkitler alınamadı.");
    return res.json();
}

export async function fetchOncekiTenkitler(auditId: string): Promise<{ birim_adi: string; rapor_turu: string; tenkitler: Tenkit[] }> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/onceki?audit_id=${encodeURIComponent(auditId)}`, { headers });
    if (!res.ok) return hataMesaji(res, "Önceki denetim tenkitleri alınamadı.");
    return res.json();
}

export async function createTenkit(data: Partial<Tenkit> & { audit_id: string; baslik: string }): Promise<Tenkit> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/`, { method: "POST", headers, body: JSON.stringify(data) });
    if (!res.ok) return hataMesaji(res, "Tenkit eklenemedi.");
    return res.json();
}

export async function aktarTenkitler(auditId: string, items: Partial<Tenkit>[]): Promise<{ eklenen: number; atlanan: number }> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/aktar`, {
        method: "POST", headers, body: JSON.stringify({ audit_id: auditId, items }),
    });
    if (!res.ok) return hataMesaji(res, "Tenkitler aktarılamadı.");
    return res.json();
}

export async function updateTenkit(id: string, changes: Partial<Tenkit>): Promise<Tenkit> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/${encodeURIComponent(id)}`, {
        method: "PATCH", headers, body: JSON.stringify(changes),
    });
    if (!res.ok) return hataMesaji(res, "Tenkit güncellenemedi.");
    return res.json();
}

export async function deleteTenkit(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/tenkitler/${encodeURIComponent(id)}`, { method: "DELETE", headers });
    if (!res.ok) return hataMesaji(res, "Tenkit silinemedi.");
}
