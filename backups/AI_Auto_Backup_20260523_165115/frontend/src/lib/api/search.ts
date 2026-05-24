import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface SearchResult {
    id: string;
    title: string;
    snippet: string;
    type: string;
    [key: string]: any;
}

export async function searchReports(query: string): Promise<SearchResult[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/search/reports?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error("Arama başarısız oldu.");
    }
    return response.json();
}
