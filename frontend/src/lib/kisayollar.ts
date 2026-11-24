/**
 * Uygulama içi klavye kısayolları (Ayarlar > Kısayollar'dan değiştirilebilir).
 * Atamalar bu cihazda saklanır (localStorage); web'de ve masaüstünde çalışır.
 */

export interface KisayolIslemi {
    id: string;
    ad: string;
    varsayilan: string; // "" = atanmamış
    yol?: string;       // gidilecek sayfa
}

export const ISLEMLER: KisayolIslemi[] = [
    { id: "genel_bakis", ad: "Genel Bakış", varsayilan: "Ctrl+Shift+1", yol: "/" },
    { id: "gorevler", ad: "Görevler", varsayilan: "Ctrl+Shift+2", yol: "/tasks" },
    { id: "denetim", ad: "Denetim Formları", varsayilan: "Ctrl+Shift+3", yol: "/denetim" },
    { id: "raporlar", ad: "Raporlar", varsayilan: "Ctrl+Shift+4", yol: "/audit" },
    { id: "emsal", ad: "Emsal Arama", varsayilan: "Ctrl+Shift+5", yol: "/emsal" },
    { id: "notlar", ad: "Hızlı Notlar", varsayilan: "Ctrl+Shift+6", yol: "/notes" },
    { id: "dosyalar", ad: "Dosyalar", varsayilan: "Ctrl+Shift+7", yol: "/files" },
    { id: "mevzuat", ad: "Mevzuat", varsayilan: "Ctrl+Shift+8", yol: "/legislation" },
    { id: "takvim", ad: "Takvim", varsayilan: "Ctrl+Shift+9", yol: "/calendar" },
    { id: "ayarlar", ad: "Ayarlar", varsayilan: "Ctrl+Shift+0", yol: "/settings" },
    { id: "rehber", ad: "Rehber", varsayilan: "", yol: "/contacts" },
    { id: "mesajlar", ad: "Mesajlar", varsayilan: "", yol: "/messages" },
    { id: "hatirlaticilar", ad: "Hatırlatıcılar", varsayilan: "", yol: "/reminders" },
    { id: "yardim", ad: "Kısayol listesini göster", varsayilan: "F1" },
];

const ANAHTAR = "mufyard_kisayollar";
export const DEGISTI_OLAYI = "mufyard-kisayollar-degisti";

/** Ayarlar ekranında tuş kaydedilirken genel dinleyici çalışmasın */
let kayitModu = false;
export const kayitModunu = (acik: boolean) => { kayitModu = acik; };
export const kayitModundaMi = () => kayitModu;

function ozelAtamalar(): Record<string, string> {
    try {
        const v = JSON.parse(localStorage.getItem(ANAHTAR) || "{}");
        return v && typeof v === "object" ? v : {};
    } catch {
        return {};
    }
}

/** Geçerli atamalar: işlem kimliği → kısayol ("" = kapalı) */
export function atamalar(): Record<string, string> {
    const o = ozelAtamalar();
    return Object.fromEntries(ISLEMLER.map(i => [i.id, typeof o[i.id] === "string" ? o[i.id] : i.varsayilan]));
}

function yaz(o: Record<string, string>) {
    try {
        localStorage.setItem(ANAHTAR, JSON.stringify(o));
    } catch { /* depolama kapalı */ }
    window.dispatchEvent(new Event(DEGISTI_OLAYI));
}

export function ata(id: string, kisayol: string) {
    const o = ozelAtamalar();
    const islem = ISLEMLER.find(i => i.id === id);
    if (!islem) return;
    if (kisayol === islem.varsayilan) delete o[id];
    else o[id] = kisayol;
    yaz(o);
}

export function varsayilanaDon(id?: string) {
    if (!id) return yaz({});
    const o = ozelAtamalar();
    delete o[id];
    yaz(o);
}

// ---------------------------------------------------------------- tuş adları

const OZEL_TUSLAR: Record<string, string> = {
    Space: "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert", Delete: "Delete",
    Slash: "/", Comma: ",", Period: ".", Minus: "-", Equal: "=", Backquote: "`",
};

/** Fiziksel tuş konumuna göre ad (klavye düzeninden bağımsız). Yalnızca değiştirici tuşsa null. */
export function tusAdi(code: string): string | null {
    let m = code.match(/^Key([A-Z])$/);
    if (m) return m[1];
    m = code.match(/^(?:Digit|Numpad)(\d)$/);
    if (m) return m[1];
    m = code.match(/^F(\d{1,2})$/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `F${m[1]}`;
    return OZEL_TUSLAR[code] || null;
}

export function olaydanKisayol(e: Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
    const tus = tusAdi(e.code);
    if (!tus) return null;
    const p: string[] = [];
    if (e.ctrlKey || e.metaKey) p.push("Ctrl");
    if (e.altKey) p.push("Alt");
    if (e.shiftKey) p.push("Shift");
    p.push(tus);
    return p.join("+");
}

// Tarayıcının/Windows'un/editörlerin kendi kısayolları: atanamaz
const AYRILMIS = new Set([
    ...["A", "B", "C", "F", "I", "N", "P", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"].map(h => `Ctrl+${h}`),
    "Ctrl+Shift+I", "Ctrl+Shift+J", "Ctrl+Shift+N", "Ctrl+Shift+T", "Ctrl+Shift+W", "Ctrl+Shift+R", "Ctrl+Shift+Delete",
    "Alt+F4", "F5", "F11", "F12", "Ctrl+F5", "Alt+Left", "Alt+Right",
]);

/** Atanabilir mi? Değilse sebebini döner. */
export function kisayolSorunu(k: string): string | null {
    const p = k.split("+");
    const tus = p[p.length - 1];
    const ctrl = p.includes("Ctrl"), alt = p.includes("Alt");
    if (ctrl && alt) return "Ctrl+Alt (AltGr) Türkçe klavyede @, € gibi karakterleri yazar; kullanılamaz.";
    if (!ctrl && !alt && !/^F\d{1,2}$/.test(tus)) return "Ctrl veya Alt ile birlikte basın (F1–F12 tek başına da olur).";
    if (AYRILMIS.has(k)) return `${k} kopyala/yapıştır/kaydet/yenile gibi standart bir kısayol; değiştirilemez.`;
    return null;
}

/** Bu kısayol başka bir işleme atanmış mı? */
export function cakisan(k: string, haric: string): KisayolIslemi | undefined {
    const a = atamalar();
    return ISLEMLER.find(i => i.id !== haric && a[i.id] === k);
}

/** Ekranda gösterim: "Ctrl+Shift+2" → ["Ctrl", "Shift", "2"] */
export const tuslar = (k: string) => (k ? k.split("+") : []);

export function duzenlenebilirAlanda(hedef: EventTarget | null): boolean {
    const el = hedef as HTMLElement | null;
    if (!el) return false;
    const etiket = el.tagName;
    return etiket === "INPUT" || etiket === "TEXTAREA" || etiket === "SELECT" || el.isContentEditable;
}
