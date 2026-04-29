import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface Profile {
    uid: string;
    full_name: string;
    title: string;
    institution: string;
    email: string;
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
}

export async function fetchProfile(uid: string, email?: string): Promise<Profile> {
    const url = email 
        ? `${API_BASE_URL}/profiles/${uid}?email=${encodeURIComponent(email)}` 
        : `${API_BASE_URL}/profiles/${uid}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error("Profil yüklenemedi.");
    }
    return response.json();
}

export async function fetchAllProfiles(): Promise<Profile[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/`);
    if (!response.ok) {
        throw new Error("Profiller yüklenemedi.");
    }
    return response.json();
}

export async function updateProfile(uid: string, update: Partial<Profile>): Promise<Profile> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/${uid}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        throw new Error("Profil güncellenemedi.");
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
    const response = await fetchWithTimeout(`${API_BASE_URL}/profiles/${uid}`, {
        method: "DELETE",
    });
    return response.ok;
}
