import { auth } from "../firebase";

/**
 * A fetch wrapper that includes a timeout.
 */
export async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 15000 } = options; // Default 15s timeout
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
  
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        
        // Handle Timeout specially
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            const err = new Error('İstek zaman aşımına uğradı. Sunucu çok meşgul olabilir veya bağlantınız yavaş.');
            err.name = 'TimeoutError';
            throw err;
        }
        
        // General error handling (Network errors, etc.)
        if (error.message === 'Failed to fetch') {
            throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin veya servislerin çalıştığından emin olun.');
        }
        
        throw error;
    }
}

/**
 * Builds authenticated headers for backend API requests.
 */
export async function getAuthHeaders(baseHeaders: HeadersInit = {}): Promise<Record<string, string>> {
    const headers = new Headers(baseHeaders);
    const currentUser = auth.currentUser as any;

    if (currentUser?.getIdToken) {
        try {
            const token = await currentUser.getIdToken();
            if (token) {
                headers.set("Authorization", `Bearer ${token}`);
            }
        } catch {
            // Fall through to dev identity headers.
        }
    }

    const ensureIdentityHeaders = (uid?: string, email?: string) => {
        if (uid && !headers.has("X-User-Id")) {
            headers.set("X-User-Id", uid);
        }
        if (email && !headers.has("X-User-Email")) {
            headers.set("X-User-Email", email);
        }
    };

    if (currentUser?.uid || currentUser?.email) {
        ensureIdentityHeaders(currentUser?.uid, currentUser?.email);
    } else {
        try {
            const raw = localStorage.getItem("demo_user");
            if (raw) {
                const demoUser = JSON.parse(raw);
                ensureIdentityHeaders(demoUser?.uid, demoUser?.email);
            }
        } catch {
            // Ignore malformed local demo payload.
        }
    }

    return Object.fromEntries(headers.entries());
}
