import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface CalendarNote {
    id: string;
    owner_id: string;
    date_key: string;   // "YYYY-M-D"
    text: string;
    time: string;
    created_at?: string;
}

export async function fetchCalendarNotes(_uid?: string): Promise<CalendarNote[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes`, { headers });
    if (!res.ok) throw new Error("Takvim notları yüklenemedi.");
    return res.json();
}

export async function createCalendarNote(
    _uid: string,
    date_key: string,
    text: string,
    time: string
): Promise<CalendarNote> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ date_key, text, time }),
    });
    if (!res.ok) throw new Error("Not kaydedilemedi.");
    return res.json();
}

export async function deleteCalendarNote(noteId: string, _uid?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes/${noteId}`, {
        method: "DELETE",
        headers,
    });
    if (!res.ok) throw new Error("Not silinemedi.");
}
