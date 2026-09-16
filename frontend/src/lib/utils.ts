import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BASE_URL, IS_ELECTRON } from "./config";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function getUserColor(id: string): string {
    const colors = [
        'bg-rose-600',
        'bg-blue-600',
        'bg-emerald-600',
        'bg-amber-600',
        'bg-indigo-600',
        'bg-violet-600',
        'bg-cyan-600',
        'bg-orange-600',
        'bg-fuchsia-600',
        'bg-teal-600',
        'bg-slate-700',
        'bg-pink-600'
    ];
    
    if (!id) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

export const REMOTE_STATIC_BASE = "https://mufyardv2.up.railway.app";
export const LOCAL_STATIC_BASE = "http://127.0.0.1:8000";

/**
 * Returns a robust image URL that works seamlessly across Web, Mobile APK, and Electron desktop.
 * - External / cloud storage URLs (Firebase, Google Storage, Cloudinary, AWS) are kept intact.
 * - Localhost URLs on Web/APK are safely redirected to the remote production backend.
 * - Relative paths are resolved to remote backend on Web/APK, or local backend in Electron.
 */
export const getSafeImageUrl = (url?: string): string => {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";

    // 1. Data URLs or Blobs -> return as-is
    if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
        return trimmed;
    }

    // 2. Full HTTP/HTTPS URLs
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        // If it points to localhost/127.0.0.1
        if (trimmed.includes("localhost:8000") || trimmed.includes("127.0.0.1:8000")) {
            // On Web or Mobile APK, device cannot reach local PC -> route to Railway
            if (!IS_ELECTRON) {
                const pathPart = trimmed.split(":8000")[1] || "";
                const clean = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
                return `${REMOTE_STATIC_BASE}${clean}`;
            }
            return trimmed;
        }

        // External / Cloud storage URL (Firebase Storage, Google Cloud Storage, Cloudinary, etc.)
        // or a remote Railway URL -> preserve it completely! DO NOT STRIP DOMAIN!
        return trimmed;
    }

    // 3. Relative URLs (e.g. /uploads/..., /Raporlar/..., denetim_tesisleri/...)
    const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

    // On Web or Mobile APK -> always use remote Railway backend
    if (!IS_ELECTRON) {
        return `${BASE_URL || REMOTE_STATIC_BASE}${cleanPath}`;
    }

    // In Electron:
    // Try local backend first (http://127.0.0.1:8000). If the photo was uploaded from Web/APK,
    // it won't exist locally; handleImageError will immediately fall back to Railway on 404!
    return `${LOCAL_STATIC_BASE}${cleanPath}`;
};

/**
 * Universal error handler for images.
 * If an image fails to load from the local backend (common when uploaded from Web or Mobile APK),
 * this immediately falls back to the remote server on Railway, and vice versa.
 */
export const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    fallbackRemote: string = REMOTE_STATIC_BASE,
    fallbackLocal: string = LOCAL_STATIC_BASE
) => {
    const target = e.currentTarget;
    if (target.dataset.failed === "true") return;

    const currentSrc = target.src;
    try {
        const urlObj = new URL(currentSrc);
        const pathAndQuery = urlObj.pathname + urlObj.search;

        // 1. If currently pointing to local backend and it failed -> try remote Railway
        if ((currentSrc.includes("127.0.0.1:8000") || currentSrc.includes("localhost:8000")) && !target.dataset.triedRemote) {
            target.dataset.triedRemote = "true";
            target.src = `${fallbackRemote}${pathAndQuery}`;
            return;
        }

        // 2. If currently pointing to Railway and it failed -> try local backend
        if (currentSrc.includes("railway.app") && !target.dataset.triedLocal) {
            target.dataset.triedLocal = "true";
            target.src = `${fallbackLocal}${pathAndQuery}`;
            return;
        }

        // 3. Both failed or remote cloud asset 404 -> stop retrying
        target.dataset.failed = "true";
    } catch {
        target.dataset.failed = "true";
    }
};
