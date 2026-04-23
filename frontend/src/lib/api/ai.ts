import { API_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface AISearchResult {
    id: string;
    name: string;
    type: string;
    score: number;
}

export const aiSearch = async (query: string): Promise<AISearchResult[]> => {
    const response = await fetchWithTimeout(`${API_URL}/ai/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
    });
    if (!response.ok) throw new Error("AI arama başarısız");
    return response.json();
};
