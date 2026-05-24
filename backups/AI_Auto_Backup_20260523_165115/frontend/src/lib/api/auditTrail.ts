import { API_URL as API_BASE_URL } from "../config";
import { fetchWithTimeout } from "./utils";

export interface AuditTrailEntry {
    id: string;
    audit_id: string;
    user: string;
    action: string;
    timestamp: string;
    details?: string;
}

export async function fetchAuditTrail(auditId: string): Promise<AuditTrailEntry[]> {
    const response = await fetchWithTimeout(`${API_BASE_URL}/audit-trail/${auditId}`);
    if (!response.ok) {
        throw new Error("Değişiklik geçmişi yüklenemedi.");
    }
    return response.json();
}
