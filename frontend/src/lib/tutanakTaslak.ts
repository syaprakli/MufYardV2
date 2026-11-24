/**
 * Tutanak taslakları (cihazda): internet yokken veya kayıt başarısızken değişiklikler burada tutulur,
 * bağlantı gelince sunucuya gönderilir. Henüz sunucuda olmayan tutanakların kimliği "yerel_" ile başlar.
 */
import type { Tutanak } from "./api/tutanaklar";

const ANAHTAR = "mufyard_tutanak_taslaklari";

export interface Taslak {
    veri: Tutanak;
    zaman: number;
}

export const yerelMi = (id: string) => id.startsWith("yerel_");
export const yerelId = () => `yerel_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function oku(): Record<string, Taslak> {
    try {
        return JSON.parse(localStorage.getItem(ANAHTAR) || "{}") || {};
    } catch {
        return {};
    }
}

function yaz(t: Record<string, Taslak>): boolean {
    try {
        if (Object.keys(t).length === 0) localStorage.removeItem(ANAHTAR);
        else localStorage.setItem(ANAHTAR, JSON.stringify(t));
        return true;
    } catch {
        return false; // depolama dolu
    }
}

export function taslaklar(taskId: string): Taslak[] {
    return Object.values(oku()).filter(t => t.veri.task_id === taskId).sort((a, b) => a.zaman - b.zaman);
}

export function taslakAl(id: string): Taslak | undefined {
    return oku()[id];
}

export function taslakKaydet(veri: Tutanak): boolean {
    const t = oku();
    t[veri.id] = { veri, zaman: Date.now() };
    return yaz(t);
}

/** Taslağı siler; `zaman` verilirse yalnızca o andan sonra değişmemişse siler (kayıt sırasında yazılanı korur). */
export function taslakSil(id: string, zaman?: number) {
    const t = oku();
    if (!t[id]) return;
    if (zaman !== undefined && t[id].zaman > zaman) return;
    delete t[id];
    yaz(t);
}

/** Yerel kimlik sunucu kimliğiyle değişince, kayıt sırasında yazılmış taslağı yeni kimliğe taşır. */
export function taslakTasi(eski: string, yeni: string, zaman: number) {
    const t = oku();
    const d = t[eski];
    delete t[eski];
    if (d && d.zaman > zaman) t[yeni] = { veri: { ...d.veri, id: yeni }, zaman: d.zaman };
    yaz(t);
}
