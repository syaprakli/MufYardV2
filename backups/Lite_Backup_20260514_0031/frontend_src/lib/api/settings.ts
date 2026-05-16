import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface RolesSettings {
    moderator_permissions: string[];
}

export async function fetchRolesSettings(): Promise<RolesSettings> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/settings/roles`, {
        headers,
    });
    if (!response.ok) {
        throw new Error("Rol ayarları yüklenemedi.");
    }
    return response.json();
}

export async function updateRolesSettings(update: RolesSettings): Promise<void> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });

    const response = await fetchWithTimeout(`${API_BASE_URL}/settings/roles`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(update),
    });
    
    if (!response.ok) {
        throw new Error("Rol ayarları güncellenemedi.");
    }
}
