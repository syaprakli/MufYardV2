import { API_URL } from "../config";
import { getAuthHeaders, fetchWithTimeout } from "./utils";

// API_URL artık otomatik olarak /api ekliyor. Endpointler doğru şekilde çalışacak.

export async function setOnline(uid: string, name: string) {
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    await fetchWithTimeout(`${API_URL}/online/set`, {
      method: "POST",
      headers,
      body: JSON.stringify({ uid, name })
    });
  } catch (error) {
    console.error("Error setting online status:", error);
  }
}

export async function removeOnline(uid: string) {
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    await fetchWithTimeout(`${API_URL}/online/remove`, {
      method: "POST",
      headers,
      body: JSON.stringify({ uid })
    });
  } catch (error) {
    console.error("Error removing online status:", error);
  }
}

export async function removeOnlineBeacon(uid: string) {
  try {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    await fetch(`${API_URL}/online/remove`, {
      method: "POST",
      headers,
      body: JSON.stringify({ uid }),
      keepalive: true
    });
  } catch (error) {
    console.error("Error sending removeOnline beacon:", error);
  }
}

export async function fetchOnlineUsers() {
  const headers = await getAuthHeaders();
  const res = await fetchWithTimeout(`${API_URL}/online/list`, { headers });
  if (!res.ok) throw new Error("Online kullanıcılar alınamadı");
  return res.json();
}
