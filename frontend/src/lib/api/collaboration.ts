import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export type PendingRequest = {
    id: string;
    type: 'TASK' | 'NOTE' | 'CONTACT';
    title: string;
    sender_name: string;
    created_at: string;
};

export async function fetchPendingRequests(uid: string): Promise<PendingRequest[]> {
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests?uid=${uid}`);
    if (!res.ok) return [];
    return await res.json();
}

export async function acceptRequest(type: string, id: string, uid: string) {
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests/${type}/${id}/accept?uid=${uid}`, {
        method: 'POST'
    });
    return res.ok;
}

export async function rejectRequest(type: string, id: string, uid: string) {
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests/${type}/${id}/reject?uid=${uid}`, {
        method: 'POST'
    });
    return res.ok;
}
