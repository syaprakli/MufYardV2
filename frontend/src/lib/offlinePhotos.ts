/**
 * İnternet yokken çekilen denetim fotoğrafları için cihaz içi kuyruk (IndexedDB).
 * Fotoğraf dosyası cihazda tutulur; bağlantı gelince sunucuya yüklenip denetime eklenir.
 * (localStorage'a base64 yazmak hem 5 MB sınırını hem denetim belgesinin 1 MiB sınırını aşıyordu.)
 */
import type { FotoMeta } from "./fotoDamga";

export interface BekleyenFoto {
    id: string;
    auditId: string;
    ad: string;
    blob: Blob;
    meta?: FotoMeta;
    eklenme: number;
}

const DB_ADI = "mufyard_cevrimdisi";
const DEPO = "bekleyen_fotograflar";

function ac(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB yok"));
        const req = indexedDB.open(DB_ADI, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(DEPO)) {
                db.createObjectStore(DEPO, { keyPath: "id" }).createIndex("auditId", "auditId", { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function islem<T>(mod: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await ac();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(DEPO, mod);
            const req = fn(tx.objectStore(DEPO));
            tx.oncomplete = () => resolve(req.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

export async function bekleyenFotoEkle(f: Omit<BekleyenFoto, "id" | "eklenme">): Promise<BekleyenFoto> {
    const kayit: BekleyenFoto = { ...f, id: `bf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, eklenme: Date.now() };
    await islem("readwrite", s => s.put(kayit));
    return kayit;
}

export async function bekleyenFotolar(auditId: string): Promise<BekleyenFoto[]> {
    try {
        const liste = await islem<BekleyenFoto[]>("readonly", s => s.index("auditId").getAll(auditId));
        return (liste || []).sort((a, b) => a.eklenme - b.eklenme);
    } catch {
        return [];
    }
}

export async function bekleyenFotoSil(id: string): Promise<void> {
    await islem("readwrite", s => s.delete(id));
}
