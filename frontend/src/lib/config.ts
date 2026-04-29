const PUBLIC_BACKEND_URL = "https://mufyardv2.up.railway.app"; 

// Tüm ortamlarda (Local, Web APK, Bulut) ortak veritabanını kullanmak için Railway adresini sabitliyoruz.
export const API_URL = `${PUBLIC_BACKEND_URL}/api`;
export const WS_URL = PUBLIC_BACKEND_URL.replace("http", "ws");
