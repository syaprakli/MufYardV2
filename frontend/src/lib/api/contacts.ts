import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface Contact {
    id: string;
    uid?: string;
    name: string;
    title: string;
    unit: string;
    phone: string;
    email: string;
    tags: string[];
    category?: string;
    sort_order?: number;
    is_shared: boolean;
    owner_id: string;
    created_at?: string;
}

export interface ContactCreate {
    name: string;
    title: string;
    unit: string;
    phone: string;
    email: string;
    tags: string[];
    category?: string;
    sort_order?: number;
    is_shared: boolean;
    owner_id: string;
}

export async function fetchContacts(category: 'corporate' | 'personal', userId?: string, userEmail?: string): Promise<Contact[]> {
    let url = `${API_BASE_URL}/contacts/?category=${category}`;
    void userId;
    void userEmail;
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
        throw new Error("Rehber verileri yüklenemedi.");
    }
    return response.json();
}

export async function acceptContact(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    void userId;
    void userEmail;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${id}/accept`, {
        headers,
        method: "POST"
    });
    if (!response.ok) throw new Error("Kişi kabul edilemedi.");
    return response.json();
}

export async function rejectContact(id: string, userId: string, userEmail?: string): Promise<{status: string, message: string}> {
    void userId;
    void userEmail;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${id}/reject`, {
        headers,
        method: "POST"
    });
    if (!response.ok) throw new Error("Kişi reddedilemedi.");
    return response.json();
}

export async function createContact(contact: ContactCreate): Promise<Contact> {
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/`, {
        method: "POST",
        headers,
        body: JSON.stringify(contact),
    });
    if (!response.ok) {
        throw new Error("Kişi oluşturulamadı.");
    }
    return response.json();
}

export async function shareContact(contactId: string, userId: string): Promise<{status: string, message: string}> {
    void userId;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${contactId}/share`, {
        headers,
        method: "PATCH",
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Kişi paylaşılamadı.");
    }
    return response.json();
}

export async function deleteContact(contactId: string, userId: string): Promise<{status: string, message: string}> {
    void userId;
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${contactId}`, {
        headers,
        method: "DELETE",
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Kişi silinemedi.");
    }
    return response.json();
}

export async function uploadAndSyncContacts(file: File): Promise<{status: string, message: string, processed: number}> {
    const formData = new FormData();
    formData.append("file", file);
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/upload-and-sync`, {
        method: "POST",
        headers,
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Rehber senkronize edilemedi.");
    }
    
    return response.json();
}

export async function updateContact(contactId: string, userId: string, contact: Partial<ContactCreate>): Promise<Contact> {
    void userId;
    const headers = await getAuthHeaders({
        "Content-Type": "application/json",
    });
    const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${contactId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(contact),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Kişi güncellenemedi.");
    }
    return response.json();
}
