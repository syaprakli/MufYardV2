// Masaüstü uygulaması ayarları (ana süreç): açılışta başlatma, kapatınca arka planda çalışma,
// genel kısayol. Ayarlar kullanıcının bilgisayarında saklanır: %LOCALAPPDATA%\MufYardV2\masaustu-ayarlar.json
const fs = require('fs');
const path = require('path');

const VARSAYILAN = Object.freeze({
    acilistaBaslat: true,        // Windows açılınca MufYARD da başlasın (eski davranış: hep açıktı)
    acilistaGizliBaslat: true,   // açılışta pencere açılmasın, simge olarak beklesin
    arkaPlandaCalis: true,       // X'e basınca kapanmasın, saatin yanındaki simgeye insin (eski davranış)
    genelKisayol: 'Ctrl+Shift+M', // her yerden MufYARD'ı göster/gizle ("" = kapalı)
});

const GIZLI_BASLATMA_ARGUMANI = '--gizli-baslat';

let dosyaYolu = null;
let ayarlar = { ...VARSAYILAN };

function yukle(userDataPath) {
    dosyaYolu = path.join(userDataPath, 'masaustu-ayarlar.json');
    try { fs.mkdirSync(userDataPath, { recursive: true }); } catch { /* yoksa yazarken hata verir */ }
    try {
        const ham = JSON.parse(fs.readFileSync(dosyaYolu, 'utf-8'));
        ayarlar = temizle({ ...VARSAYILAN, ...ham });
    } catch {
        ayarlar = { ...VARSAYILAN };
    }
    return ayarlar;
}

function al() {
    return { ...ayarlar };
}

/** Yalnızca bilinen alanlar ve doğru türler kabul edilir; geçersiz alan `taban`daki değerinde kalır. */
function temizle(a, taban = VARSAYILAN) {
    const out = { ...VARSAYILAN, ...taban };
    for (const k of ['acilistaBaslat', 'acilistaGizliBaslat', 'arkaPlandaCalis']) {
        if (typeof a[k] === 'boolean') out[k] = a[k];
    }
    if (typeof a.genelKisayol === 'string' && (a.genelKisayol === '' || kisayolGecerli(a.genelKisayol))) {
        out.genelKisayol = a.genelKisayol;
    }
    return out;
}

function kaydet(degisiklik) {
    ayarlar = temizle({ ...ayarlar, ...(degisiklik || {}) }, ayarlar);
    try {
        const gecici = dosyaYolu + '.tmp';
        fs.writeFileSync(gecici, JSON.stringify(ayarlar, null, 2), 'utf-8');
        fs.renameSync(gecici, dosyaYolu);
    } catch (e) {
        console.error('Masaüstü ayarları yazılamadı:', e.message);
    }
    return al();
}

const DEGISTIRICILER = ['Ctrl', 'Alt', 'Shift'];
/** "Ctrl+Shift+M" biçimi: en az bir Ctrl/Alt + tek tuş. */
function kisayolGecerli(k) {
    const p = String(k).split('+');
    if (p.length < 2) return false;
    const tus = p[p.length - 1];
    const deg = p.slice(0, -1);
    if (!deg.every(d => DEGISTIRICILER.includes(d))) return false;
    if (!deg.includes('Ctrl') && !deg.includes('Alt')) return false;
    return /^([A-Z0-9]|F([1-9]|1[0-2])|Space|Home|End|Insert|Delete|PageUp|PageDown|Up|Down|Left|Right)$/.test(tus);
}

/** Uygulamadaki biçimden Electron hızlandırıcısına: "Ctrl+Shift+M" → "Control+Shift+M" */
function hizlandirici(k) {
    return String(k).split('+').map(p => (p === 'Ctrl' ? 'Control' : p)).join('+');
}

module.exports = { VARSAYILAN, GIZLI_BASLATMA_ARGUMANI, yukle, al, kaydet, temizle, kisayolGecerli, hizlandirici };
