import { isElectron } from "./firebase";

// Backend'i yayınladık: Railway adresi
const PUBLIC_BACKEND_URL = "https://mufyardv2.up.railway.app"; 

export const API_URL = isElectron 
    ? "http://127.0.0.1:8000/api" 
    : `${PUBLIC_BACKEND_URL}/api`;

export const WS_URL = isElectron 
    ? "ws://127.0.0.1:8000" 
    : PUBLIC_BACKEND_URL.replace("http", "ws");
