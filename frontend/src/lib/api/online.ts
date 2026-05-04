import { API_URL } from "../config";

// API_URL artık otomatik olarak /api ekliyor. Endpointler doğru şekilde çalışacak.

export async function setOnline(uid: string, name: string) {
  await fetch(`${API_URL}/online/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, name })
  });
}

export async function removeOnline(uid: string) {
  await fetch(`${API_URL}/online/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid })
  });
}

export async function fetchOnlineUsers() {
  const res = await fetch(`${API_URL}/online/list`);
  if (!res.ok) throw new Error("Online kullanıcılar alınamadı");
  return res.json();
}
