import { isElectron } from "./firebase";

// Backend'i yayınladığınızda bu adresi güncelleyeceğiz.
// Şimdilik VITE_PUBLIC_API_URL varsa onu kullan, yoksa yereli dene (Web'de çalışmayabilir).
const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_API_URL || "http://127.0.0.1:8000"; 

export const API_URL = isElectron 
    ? "http://127.0.0.1:8000/api" 
    : `${PUBLIC_BACKEND_URL}/api`;

export const WS_URL = isElectron 
    ? "ws://127.0.0.1:8000" 
    : PUBLIC_BACKEND_URL.replace("http", "ws");
