import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface Note {
    id: string;
    owner_id: string;
    title: string;
    text: string;
    is_pinned: boolean;
    color: string;
    created_at: string;
}

export interface NoteCreate {
    owner_id: string;
    title: string;
    text: string;
    is_pinned: boolean;
    color: string;
}

export async function fetchNotes(uid: string): Promise<Note[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/?uid=${uid}`);
    if (!response.ok) {
        throw new Error("Notlar yüklenemedi.");
    }
    return response.json();
}

export async function createNote(note: NoteCreate): Promise<Note> {
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
}

export async function updateNote(id: string, update: Partial<NoteCreate>): Promise<Note> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/notes/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
    });
    if (!response.ok) {
        throw new Error("Not güncellenemedi.");
    }
    return response.json();
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
