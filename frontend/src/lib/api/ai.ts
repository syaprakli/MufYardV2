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

export interface ReportExample {
    id: string;
    title: string;
    report_type: string;
    content: string;
    extracted_rules?: string;
    owner_id: string;
    created_at: string;
}

export interface GenerateWizardReportPayload {
    auditId: string;
    exampleId?: string;
    reportType: string;
    selectedFindings: string[];
    instructions?: string;
}

export async function fetchReportExamples(reportType?: string): Promise<ReportExample[]> {
    const headers = await getAuthHeaders();
    const url = `${API_URL}/ai/report-examples${reportType ? `?report_type=${encodeURIComponent(reportType)}` : ""}`;
    const response = await fetchWithTimeout(url, { headers });
    if (!response.ok) throw new Error("Örnek raporlar yüklenemedi.");
    return response.json();
}

export async function createReportExampleFromText(title: string, reportType: string, content: string): Promise<ReportExample> {
    const headers = await getAuthHeaders();
    const formData = new FormData();
    formData.append("title", title);
    formData.append("report_type", reportType);
    formData.append("content", content);

    const response = await fetchWithTimeout(`${API_URL}/ai/report-examples`, {
        method: "POST",
        headers,
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Örnek rapor kaydedilemedi.");
    }
    return response.json();
}

export async function uploadReportExample(title: string, reportType: string, file: File): Promise<ReportExample> {
    const headers = await getAuthHeaders();
    const formData = new FormData();
    formData.append("title", title);
    formData.append("report_type", reportType);
    formData.append("file", file);

    const response = await fetchWithTimeout(`${API_URL}/ai/report-examples`, {
        method: "POST",
        headers,
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Örnek rapor dosyası yüklenemedi.");
    }
    return response.json();
}

export async function deleteReportExample(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${API_URL}/ai/report-examples/${id}`, {
        method: "DELETE",
        headers
    });
    if (!response.ok) throw new Error("Örnek rapor silinemedi.");
}

export async function generateWizardReport(payload: GenerateWizardReportPayload): Promise<{ html: string }> {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const response = await fetchWithTimeout(`${API_URL}/ai/generate-wizard-report`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            audit_id: payload.auditId,
            example_id: payload.exampleId,
            report_type: payload.reportType,
            selected_findings: payload.selectedFindings,
            instructions: payload.instructions || ""
        }),
        timeout: 180000
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Sihirbaz rapor taslağı oluşturamadı.");
    }

    return response.json();
}

