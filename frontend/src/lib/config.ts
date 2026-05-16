export const IS_PROD = import.meta.env.PROD;
export const IS_ELECTRON = typeof window !== 'undefined' && /Electron/.test(navigator.userAgent);
const VITE_API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_PUBLIC_API_URL) as string | undefined;
const API_URL_OVERRIDE = VITE_API_URL?.trim();

// Hostname tabanlı tespit (Web için daha güvenli)

const RAILWAY_URL = "https://mufyardv2.up.railway.app";
const LOCAL_URL = "http://127.0.0.1:8000";

// Geliştirme sırasında yerel backend kullanmak için burayı true yapabilirsiniz
const FORCE_LOCAL = false;

// URL seçim önceliği:
// 1) VITE_API_URL override (en yüksek öncelik)
// 2) FORCE_LOCAL true ise → Local backend
// 3) Diğer her durumda → Railway (Web ve Electron senkronize kalsın diye)
const PUBLIC_BACKEND_URL = API_URL_OVERRIDE || (
    FORCE_LOCAL 
        ? LOCAL_URL 
        : RAILWAY_URL
);


// Ortama göre backend URL'si
export const BASE_URL = PUBLIC_BACKEND_URL;
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const LOCAL_API_URL = `${LOCAL_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("https", "wss").replace("http", "ws");
