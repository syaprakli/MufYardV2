import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";
import { addToQueue } from "./syncQueue";

export interface Note {
    id: string;
    owner_id: string;
    title: string;
    text: string;
    is_pinned: boolean;
    is_done?: boolean;
    color: string;
    priority?: "normal" | "urgent" | "acil" | string;
    created_at: string;
    shared_with?: string[];
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
}

export interface NoteCreate {
    owner_id: string;
    title: string;
    text: string;
    is_pinned: boolean;
    is_done?: boolean;
    color: string;
    priority?: "normal" | "urgent" | "acil" | string;
    pending_collaborators?: string[];
    accepted_collaborators?: string[];
}

export async function fetchNotes(uid: string, email?: string): Promise<Note[]> {
    const params = new URLSearchParams({ uid });
    if (email) params.append("email", email);
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/?${params.toString()}`);
    if (!response.ok) {
        throw new Error("Notlar yüklenemedi.");
    }
    return response.json();
}

export async function createNote(note: NoteCreate): Promise<Note> {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/notes/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(note),
        });

        if (!response.ok) {
            throw new Error("Not oluşturulamadı.");
        }
        return response.json();
    } catch (error) {
        if (!navigator.onLine || error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
            console.warn("Offline detected in createNote, queueing action.");
            addToQueue('createNote', [note]);
            return { id: `temp_${Date.now()}`, ...note, created_at: new Date().toISOString() } as any;
        }
        throw error;
    }
}

export async function updateNote(id: string, update: Partial<NoteCreate>): Promise<Note> {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(update),
        });

        if (!response.ok && Object.prototype.hasOwnProperty.call(update, "is_done")) {
            const fallbackResponse = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ is_completed: (update as any).is_done }),
            });

            if (fallbackResponse.ok) {
                return fallbackResponse.json();
            }

            let fallbackDetail = "";
            try {
                const body = await fallbackResponse.json();
                fallbackDetail = body?.detail ? ` (${body.detail})` : "";
            } catch {
                fallbackDetail = "";
            }
            throw new Error(`Not güncellenemedi${fallbackDetail}`);
        }

        if (!response.ok) {
            let detail = "";
            try {
                const body = await response.json();
                detail = body?.detail ? ` (${body.detail})` : "";
            } catch {
                detail = "";
            }
            throw new Error(`Not güncellenemedi${detail}`);
        }

        return response.json();
    } catch (error) {
        if (!navigator.onLine || error instanceof Error && (error.message.includes("Failed to fetch") || error.message.includes("timeout"))) {
            console.warn("Offline detected in updateNote, queueing action.");
            addToQueue('updateNote', [id, update]);
            return { id, ...update } as any;
        }
        throw error;
    }
}

export async function deleteNote(id: string): Promise<{status: string, message: string}> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error("Not silinemedi.");
    }
    return response.json();
}

export async function acceptNote(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.append("user_email", userEmail);
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}/accept?${params.toString()}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Not kabul edilemedi.");
    return response.json();
}

export async function rejectNote(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    const params = new URLSearchParams({ user_id: userId });
    if (userEmail) params.append("user_email", userEmail);
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}/reject?${params.toString()}`, {
        method: "POST"
    });
    if (!response.ok) throw new Error("Not reddedilemedi.");
    return response.json();
}
