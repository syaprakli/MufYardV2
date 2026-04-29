import { isElectron } from "./firebase";

const PUBLIC_BACKEND_URL = "https://mufyardv2.up.railway.app"; 

// Eğer Electron içindeysek ve yerel test yapmıyorsak bulut adresini kullanmalıyız
// Kullanıcı "Web APK" (Paketlenmiş uygulama) kullandığında herkesin aynı veriyi görmesi için cloud'a bağlanmalı.
export const API_URL = (isElectron && import.meta.env.DEV)
    ? "http://127.0.0.1:8000/api" 
    : `${PUBLIC_BACKEND_URL}/api`;

export const WS_URL = (isElectron && import.meta.env.DEV)
    ? "ws://127.0.0.1:8000" 
    : PUBLIC_BACKEND_URL.replace("http", "ws");
