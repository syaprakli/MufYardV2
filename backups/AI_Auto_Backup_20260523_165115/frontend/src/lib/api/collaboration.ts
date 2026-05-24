import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export type PendingRequest = {
    id: string;
    type: 'TASK' | 'NOTE' | 'CONTACT';
    title: string;
    sender_name: string;
    created_at: string;
};

export async function fetchPendingRequests(uid: string, email?: string): Promise<PendingRequest[]> {
    let url = `${API_URL}/collaboration/pending-requests?uid=${uid}`;
    if (email) url += `&email=${encodeURIComponent(email)}`;
    const res = await fetchWithTimeout(url);
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

export async function sendDirectMessage(recipientId: string, content: string, attachment: any, senderUid: string, senderName: string) {
    const url = `${API_URL}/collaboration/dm/send?uid=${senderUid}&name=${encodeURIComponent(senderName)}`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient_id: recipientId,
            content: content,
            attachment: attachment
        })
    });
    return res.ok;
}

export async function fetchGlobalMessages(limit: number = 50) {
    const res = await fetchWithTimeout(`${API_URL}/collaboration/messages?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
}

