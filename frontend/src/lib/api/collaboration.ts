import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export type PendingRequest = {
    id: string;
    type: 'TASK' | 'NOTE' | 'CONTACT';
    title: string;
    sender_name: string;
    created_at: string;
};

export async function fetchPendingRequests(_uid: string, _email?: string): Promise<PendingRequest[]> {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests`, { headers });
    if (!res.ok) return [];
    return await res.json();
}

export async function acceptRequest(type: string, id: string, _uid: string) {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests/${type}/${id}/accept`, {
        method: 'POST',
        headers,
    });
    return res.ok;
}

export async function rejectRequest(type: string, id: string, _uid: string) {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/collaboration/pending-requests/${type}/${id}/reject`, {
        method: 'POST',
        headers,
    });
    return res.ok;
}

export async function sendDirectMessage(recipientId: string, content: string, attachment: any, _senderUid: string, _senderName: string) {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const url = `${API_URL}/collaboration/dm/send`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            recipient_id: recipientId,
            content: content,
            attachment: attachment
        })
    });
    return res.ok;
}

export async function fetchGlobalMessages(limit: number = 50) {
    const headers = await getAuthHeaders();
    const res = await fetchWithTimeout(`${API_URL}/collaboration/messages?limit=${limit}`, { headers });
    if (!res.ok) return [];
    return await res.json();
}

export async function sendGlobalMessage(content: string, authorName: string, authorId: string, authorRole: string = "Müfettiş") {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetchWithTimeout(`${API_URL}/collaboration/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            text: content,
            author_id: authorId,
            author_name: authorName,
            author_role: authorRole
        })
    });
    return res.ok;
}

