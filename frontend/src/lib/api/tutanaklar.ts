import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export type TutanakTuru = "ifade" | "tespit" | "gorusme";
export type KisiRolu = "ifade_veren" | "mufettis" | "katilan" | "tanik" | "yazman";

export interface TutanakKisi {
    ad: string;
    unvan?: string | null;
    rol: KisiRolu;
    tckn?: string | null;
    adres?: string | null;
}

export interface SoruCevap {
    soru: string;
    cevap: string;
}

export interface Tutanak {
    id: string;
    /** İnceleme / soruşturma / ön inceleme / araştırma görevi */
    task_id: string;
    audit_id?: string | null;
    tur: TutanakTuru;
    baslik?: string | null;
    tarih?: string | null;
    saat?: string | null;
    yer?: string | null;
    konu?: string | null;
    kisiler?: TutanakKisi[];
    sorular?: SoruCevap[];
    metin?: string | null;
    kapanis?: string | null;
    tamamlandi?: boolean;
    created_at?: string;
    updated_at?: string;
}

export const TUR_ADI: Record<TutanakTuru, string> = {
    ifade: "İfade Tutanağı",
    tespit: "Tespit Tutanağı",
    gorusme: "Görüşme Tutanağı",
};

export const ROL_ADI: Record<KisiRolu, string> = {
    ifade_veren: "İfade veren",
    mufettis: "Müfettiş",
    katilan: "Katılan",
    tanik: "Tanık",
    yazman: "Yazman",
};

/** Sunucuya gönderilen alanlar (kimlik ve zaman damgaları hariç). */
export const ALANLAR = ["baslik", "tarih", "saat", "yer", "konu", "kisiler", "sorular", "metin", "kapanis", "tamamlandi"] as const;
export const alanlariAl = (t: Partial<Tutanak>) =>
    Object.fromEntries(ALANLAR.filter(k => k in t).map(k => [k, (t as any)[k]])) as Partial<Tutanak>;

async function hata(res: Response, varsayilan: string): Promise<never> {
    const e = await res.json().catch(() => ({}));
    // 422'de detail bir liste gelir: hangi alanın kabul edilmediğini göster
    const ayrinti = Array.isArray(e?.detail)
        ? `${varsayilan} Kabul edilmeyen alan: ${e.detail.slice(0, 3).map((d: any) => `${(d?.loc || []).slice(1).join(" › ")} (${d?.msg || "geçersiz"})`).join("; ")}`
        : typeof e?.detail === "string" ? e.detail : varsayilan;
    const err: any = new Error(ayrinti);
    err.status = res.status;
    throw err;
}

export async function fetchTutanaklar(taskId: string): Promise<Tutanak[]> {
    const res = await fetchWithTimeout(`${API_URL}/tutanaklar/?task_id=${encodeURIComponent(taskId)}`, { headers: await getAuthHeaders() });
    if (!res.ok) return hata(res, "Tutanaklar alınamadı.");
    return res.json();
}

export async function createTutanak(taskId: string, tur: TutanakTuru, alanlar: Partial<Tutanak>): Promise<Tutanak> {
    const res = await fetchWithTimeout(`${API_URL}/tutanaklar/`, {
        method: "POST",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ...alanlariAl(alanlar), task_id: taskId, tur }),
    });
    if (!res.ok) return hata(res, "Tutanak oluşturulamadı.");
    return res.json();
}

export async function updateTutanak(id: string, alanlar: Partial<Tutanak>): Promise<Tutanak> {
    const res = await fetchWithTimeout(`${API_URL}/tutanaklar/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(alanlariAl(alanlar)),
    });
    if (!res.ok) return hata(res, "Tutanak kaydedilemedi.");
    return res.json();
}

export async function deleteTutanak(id: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/tutanaklar/${encodeURIComponent(id)}`, { method: "DELETE", headers: await getAuthHeaders() });
    if (!res.ok) return hata(res, "Tutanak silinemedi.");
}

/** Ses kaydını mevcut deşifre servisine gönderir (Gemini; kullanıcının AI ayarları geçerli). */
export async function sesiMetneCevir(ses: Blob): Promise<string> {
    const form = new FormData();
    const uzanti = ses.type.includes("mp4") ? "m4a" : ses.type.includes("ogg") ? "ogg" : "webm";
    form.append("file", ses, `ifade.${uzanti}`);
    const res = await fetchWithTimeout(`${API_URL}/ai/transcribe`, {
        method: "POST", headers: await getAuthHeaders(), body: form, timeout: 120000,
    });
    if (!res.ok) return hata(res, "Ses metne çevrilemedi.");
    const d = await res.json();
    return (d?.text || "").trim();
}
