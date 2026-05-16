import { API_URL } from "./config";
import { fetchWithTimeout } from "./api/utils";

export async function fetchStats(userId?: string) {
    const storageKey = `mufyard_stats_cache_${userId || 'guest'}`;
    
    try {
        const url = userId ? `${API_URL}/dashboard/stats?user_id=${userId}` : `${API_URL}/dashboard/stats`;
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error("Stats fetch failed");
        }
        
        const data = await response.json();
        
        // Cache stats
        localStorage.setItem(storageKey, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        
        return data;
    } catch (error) {
        console.warn("Backend connection failed for fetchStats, attempting local fallback:", error);
        
        const localData = localStorage.getItem(storageKey);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log("Loaded stats from local storage fallback.");
                return parsed.data;
            } catch (e) {
                console.error("Error parsing local stats cache:", e);
            }
        }
        
        return { stats: [], news: [], forum_posts: [] };
    }
}
