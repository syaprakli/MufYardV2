const IS_PROD = import.meta.env.PROD;
const IS_ELECTRON = typeof window !== 'undefined' && /Electron/.test(navigator.userAgent);
const VITE_API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_PUBLIC_API_URL) as string | undefined;
const API_URL_OVERRIDE = VITE_API_URL?.trim();

// Hostname tabanlı tespit (Web için daha güvenli)
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// URL seçim önceliği:
// 1) VITE_API_URL override
// 2) Electron ortamında daima local backend
// 3) Localhost dışındaki web ortamlarında Railway (Prod)
// 4) Diğer durumlarda local backend
const PUBLIC_BACKEND_URL = API_URL_OVERRIDE || (IS_ELECTRON
    ? "http://127.0.0.1:8000"
    : (!isLocalhost || IS_PROD ? "https://mufyardv2.up.railway.app" : "http://127.0.0.1:8000"));

// Ortama göre backend URL'si
export const BASE_URL = PUBLIC_BACKEND_URL;
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("https", "wss").replace("http", "ws");
