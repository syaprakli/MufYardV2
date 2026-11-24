/**
 * Rapor kodu ön eki (ör. "S.Y.64"). Asıl kaynak sunucudaki profildir; bilgisayardaki kayıt (localStorage)
 * yalnızca profil yokken (internetsiz) kullanılır ve profil geldiğinde onunla eşitlenir.
 */
export const VARSAYILAN_ONEK = "S.Y.64";
const ANAHTAR = "raporKoduOnek";

function yerelOnek(): string {
    try {
        return (localStorage.getItem(ANAHTAR) || "").trim();
    } catch {
        return "";
    }
}

/** Profilde ön ek varsa bilgisayardaki kaydı onunla eşitler (eski kayıt yanıltmasın). */
export function onekiEsitle(profil?: { report_prefix?: string | null } | null) {
    const p = (profil?.report_prefix || "").trim();
    if (!p) return;
    try {
        if (localStorage.getItem(ANAHTAR) !== p) localStorage.setItem(ANAHTAR, p);
    } catch { /* depolama kapalı */ }
}

/**
 * "Rapor Kodu Ayarı Gerekli" uyarısı gösterilsin mi?
 * Profil sunucudan gelmeden karar verilmez: aksi halde eski kayıt yüzünden uyarı bir an görünüp kaybolur.
 */
export function onekUyarisiGerekli(tazeProfil?: { report_prefix?: string | null } | null, email?: string | null): boolean {
    if (!tazeProfil) return false;
    if ((email || "").toLowerCase() === "sefa.yaprakli@gsb.gov.tr") return false; // varsayılan ön ek bu hesabın kendi ön eki
    const onek = (tazeProfil.report_prefix || "").trim() || yerelOnek();
    return onek === VARSAYILAN_ONEK;
}
