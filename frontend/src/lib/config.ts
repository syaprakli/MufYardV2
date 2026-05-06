const IS_PROD = import.meta.env.PROD;
const PUBLIC_BACKEND_URL = IS_PROD 
    ? "https://mufyardv2.up.railway.app" 
    : "http://127.0.0.1:8000";

// Ortama göre backend URL'si
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("http", "ws");
