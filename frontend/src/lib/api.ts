import { API_URL } from "./config";
import { fetchWithTimeout } from "./api/utils";

export async function fetchStats(userId?: string) {
    try {
        const url = userId ? `${API_URL}/dashboard/stats?user_id=${userId}` : `${API_URL}/dashboard/stats`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            return { stats: [], news: [], forum_posts: [] };
        }
        return await response.json();
    } catch (error) {
        console.warn("Backend connection failed for fetchStats:", error);
        return { stats: [], news: [], forum_posts: [] };
    }
}
