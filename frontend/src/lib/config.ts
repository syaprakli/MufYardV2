const PUBLIC_BACKEND_URL = import.meta.env.VITE_API_URL || "https://mufyardv2.up.railway.app";

// Ortama göre backend URL'si
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("http", "ws");
