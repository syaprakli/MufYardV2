import { API_URL } from "./config";
import { fetchWithTimeout } from "./api/utils";

export async function fetchStats() {
    try {
        const response = await fetchWithTimeout(`${API_URL}/dashboard/stats`);
        if (!response.ok) {
            return { stats: [] };
        }
        return await response.json();
    } catch (error) {
        console.warn("Backend connection failed for fetchStats:", error);
        return { stats: [] };
    }
}
