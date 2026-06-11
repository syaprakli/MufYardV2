import { API_URL } from "../config";
import { fetchWithTimeout, getAuthHeaders } from "./utils";

export interface AISearchResult {
    id: string;
    name: string;
    type: string;
    score: number;
}

export const aiSearch = async (query: string): Promise<AISearchResult[]> => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/ai/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query })
    });
    if (!response.ok) throw new Error("AI arama başarısız");
    return response.json();
};

export interface GenerateReportSuggestionPayload {
    auditId: string;
    instructions?: string;
    section?: string;
}

export async function generateReportSuggestion(payload: GenerateReportSuggestionPayload): Promise<{ html: string }> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/ai/generate-report`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            audit_id: payload.auditId,
            instructions: payload.instructions || "",
            section: payload.section || "tamamini"
        }),
        timeout: 120000
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "AI önerisi alınamadı");
    }

    return response.json();
}
