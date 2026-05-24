import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface CalendarNote {
    id: string;
    owner_id: string;
    date_key: string;   // "YYYY-M-D"
    text: string;
    time: string;
    created_at?: string;
}

export async function fetchCalendarNotes(uid: string): Promise<CalendarNote[]> {
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes?uid=${uid}`);
    if (!res.ok) throw new Error("Takvim notları yüklenemedi.");
    return res.json();
}

export async function createCalendarNote(
    uid: string,
    date_key: string,
    text: string,
    time: string
): Promise<CalendarNote> {
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, date_key, text, time }),
    });
    if (!res.ok) throw new Error("Not kaydedilemedi.");
    return res.json();
}

export async function deleteCalendarNote(noteId: string, uid: string): Promise<void> {
    const res = await fetchWithTimeout(`${API_URL}/calendar/notes/${noteId}?uid=${uid}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Not silinemedi.");
}
