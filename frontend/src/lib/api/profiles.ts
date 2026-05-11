import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Profile {
    uid: string;
    full_name: string;
    title: string;
    institution: string;
    email: string;
    emails?: string[];
    avatar_url: string | null;
    theme: string;
    ai_enabled: boolean;
    has_premium_ai: boolean;
    notifications_enabled: boolean;
    ai_model?: string;
    ai_temperature?: number;
    ai_system_prompt?: string;
    role?: 'admin' | 'moderator' | 'user';
    fcm_token?: string | null;
    two_factor_enabled?: boolean;
    two_factor_secret?: string | null;
    verified?: boolean;
    phone?: string;
    birthday?: string;
    birthday_full?: string;
}

export async function fetchProfile(uid: string, email?: string, fullName?: string): Promise<Profile> {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (fullName) params.set("full_name", fullName);
    const query = params.toString();
    const url = `${API_BASE_URL}/profiles/${uid}${query ? `?${query}` : ""}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error("Profil yüklenemedi.");
    }
    return response.json();
}

export async function fetchAllProfiles(): Promise<Profile[]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/`, { timeout: 25000 });
            if (!response.ok) {
                throw new Error("Profiller yüklenemedi.");
            }
            return response.json();
        } catch (error) {
            lastError = error;
            if (attempt === 0) {
                await delay(1200);
                continue;
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Profiller yüklenemedi.");
}

export async function updateProfile(uid: string, update: Partial<Profile>): Promise<Profile> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });

    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/${uid}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        let message = "Profil güncellenemedi.";
        try {
            const data = await response.json();
            if (data?.detail && typeof data.detail === "string") {
                message = data.detail;
            }
        } catch {
            // Keep default message when response body is not JSON.
        }
        throw new Error(message);
    }
    return response.json();
}

export async function uploadAvatar(uid: string, file: File): Promise<{avatar_url: string}> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/${uid}/avatar`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Avatar yüklenemedi.");
    }

    return response.json();
}

export async function deleteProfile(uid: string): Promise<boolean> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/${uid}`, {
        method: "DELETE",
        headers,
    });
    return response.ok;
}
