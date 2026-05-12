export const IS_PROD = import.meta.env.PROD;
export const IS_ELECTRON = typeof window !== 'undefined' && /Electron/.test(navigator.userAgent);
const VITE_API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_PUBLIC_API_URL) as string | undefined;
const API_URL_OVERRIDE = VITE_API_URL?.trim();

// Hostname tabanlı tespit (Web için daha güvenli)
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const RAILWAY_URL = "https://mufyardv2.up.railway.app";
const LOCAL_URL = "http://127.0.0.1:8000";

// URL seçim önceliği:
// 1) VITE_API_URL override (en yüksek öncelik - geliştirme için)
// 2) Electron → DAİMA Railway (tüm kullanıcılar aynı WS havuzunda olmalı)
// 3) Web non-localhost → Railway
// 4) Web localhost → Local backend (geliştirme)
// NOT: Electron'un daima Railway'e bağlanması KRİTİK. Aksi halde masaüstü ve
// web kullanıcıları farklı WS sunucularına düşer ve birbirlerini göremezler.
const PUBLIC_BACKEND_URL = API_URL_OVERRIDE || (IS_ELECTRON
    ? RAILWAY_URL
    : (!isLocalhost || IS_PROD ? RAILWAY_URL : LOCAL_URL));

// Ortama göre backend URL'si
export const BASE_URL = PUBLIC_BACKEND_URL;
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const LOCAL_API_URL = `${LOCAL_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("https", "wss").replace("http", "ws");
