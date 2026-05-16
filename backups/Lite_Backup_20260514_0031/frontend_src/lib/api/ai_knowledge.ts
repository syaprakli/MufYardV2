import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface AIKnowledgeItem {
    id: string;
    category: string;
    topic: string;
    description: string;
    standard_remark: string;
    tags?: string[];
    created_at: string;
    updated_at?: string;
}

export async function fetchAIKnowledge(category?: string): Promise<AIKnowledgeItem[]> {
    let url = `${API_URL}/ai-knowledge/`;
    if (category) {
        url += `?category=${encodeURIComponent(category)}`;
    }
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) {
        throw new Error("Bilgi bankası yüklenemedi.");
    }
    return response.json();
}

export async function createAIKnowledge(item: Partial<AIKnowledgeItem>): Promise<AIKnowledgeItem> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/ai-knowledge/`, {
        method: "POST",
        headers,
        body: JSON.stringify(item)
    });
    if (!response.ok) {
        throw new Error("Yeni tenkit maddesi eklenemedi.");
    }
    return response.json();
}

export async function deleteAIKnowledge(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_URL}/ai-knowledge/${id}`, {
        method: "DELETE",
        headers,
    });
    if (!response.ok) {
        throw new Error("Madde silinemedi.");
    }
}

export async function updateAIKnowledge(id: string, update: Partial<AIKnowledgeItem>): Promise<AIKnowledgeItem> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/ai-knowledge/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(update)
    });
    if (!response.ok) {
        throw new Error("Madde güncellenemedi.");
    }
    return response.json();
}
