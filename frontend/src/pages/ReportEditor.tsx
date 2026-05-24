import { Suspense, lazy, useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Save, Download, ArrowLeft, Loader2, FileText, CheckCircle, History, X, Sparkles, Pin, ChevronUp, ChevronDown, LayoutGrid, MessageSquare, BookOpen, Users } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchAuditById, updateAudit, exportAuditToWord, type Audit, type AuditVersion } from "../lib/api/audit";
import ReportEditorAuditTrailPanel from "../components/report/ReportEditorAuditTrailPanel";
import ReportEditorSnippetBankPanel from "../components/report/ReportEditorSnippetBankPanel";
import VoiceToTextInput from "../components/report/VoiceToTextInput";
import ReportEditorVersionLabelModal from "../components/report/ReportEditorVersionLabelModal";
import ReportEditorProofreadPanel from "../components/report/ReportEditorProofreadPanel";
import ReportEditorLegislationPanel from "../components/report/ReportEditorLegislationPanel";

import { generateReportSuggestion } from "../lib/api/ai";
import { getSyncConflicts, clearSyncConflictsForAudit } from "../lib/api/syncQueue";
import { WS_URL } from "../lib/config";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { useChat } from "../lib/context/ChatContext";
import { logPerfSample } from "../lib/performance";
import { REPORT_TEMPLATES, type ReportTemplate } from "../lib/reportTemplates";

const ShareModalLazy = lazy(() => import("../components/ShareModal"));
const ReportEditorTinyMCELazy = lazy(() => import("../components/report/ReportEditorTinyMCE"));
const ReportEditorHistoryPanelLazy = lazy(() => import("../components/report/ReportEditorHistoryPanel"));
const ReportEditorChecklistPanelLazy = lazy(() => import("../components/report/ReportEditorChecklistPanel"));
const ReportEditorAiSuggestionPanelLazy = lazy(() => import("../components/report/ReportEditorAiSuggestionPanel"));

const AI_PROMPT_PRESETS = [
    {
        label: "Daha Resmi",
        section: "tamamini",
        instructions: "Metni daha resmi, kısa ve müfettişlik raporu diline uygun hale getir. Gereksiz tekrarları temizle."
    },
    {
        label: "Mali Risk",
        section: "tespitler",
        instructions: "Mali riskleri, kontrol zafiyetlerini ve doğabilecek kamu zararını açık biçimde vurgula."
    },
    {
        label: "Tenkit Güçlendir",
        section: "tenkit",
        instructions: "Tenkit maddelerini daha net, mevzuat dayanaklı ve yaptırım dili güçlü olacak şekilde yaz."
    },
    {
        label: "Sonuç Kısalt",
        section: "sonuc",
        instructions: "Sonuç ve öneriler bölümünü daha kısa, maddeli ve yönetici özeti gibi okunur hale getir."
    },
    {
        label: "Yönetici Özeti",
        section: "tamamini",
        instructions: "Raporun tamamını oku ve üst makamlara (Bakan/Başkanlık) sunulmak üzere, 1 sayfalık net ve aksiyon odaklı bir Yönetici Özeti (Executive Brief) oluştur."
    },
    {
        label: "Bakanlık Sunumu",
        section: "tamamini",
        instructions: "Rapor içeriğinden yola çıkarak üst makamlara yapılacak sunum için 5-6 slaytlık başlıklar, ana bulgular ve önerileri içeren şık bir Sunum Slayt Taslağı (Slide Outline) üret. Lütfen slaytları '[Slayt 1]', '[Slayt 2]' şeklinde etiketle ve her slayt için başlık ve kısa 3-4 maddeli açıklama yaz."
    }
] as const;

type SavedAiPromptPreset = {
    id: string;
    label: string;
    section: string;
    instructions: string;
};

export default function ReportEditor() {
    // Sesli Not Panel State
    const [isVoiceInputOpen, setIsVoiceInputOpen] = useState(false);
    // Snippet Bankası Panel State
    const [isSnippetBankOpen, setIsSnippetBankOpen] = useState(false);
    // Audit Trail (Değişiklik Geçmişi) Panel State
    const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
    // Otomatik sürümleme aralığı: 30 dakika
    const VERSION_INTERVAL_MS = 30 * 60 * 1000;
    const VERSION_CHAR_THRESHOLD = 1000;
    const AUTOSAVE_INTERVAL_MS = 60 * 1000;

    const confirm = useConfirm();
    const { user } = useAuth();
    const { openChat } = useChat();
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isProofreadOpen, setIsProofreadOpen] = useState(false);
    const [isLegislationOpen, setIsLegislationOpen] = useState(false);
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { refreshAudits } = useGlobalData();
    const editorLoadStartRef = useRef<number>(performance.now());
    const editorInitLoggedRef = useRef(false);
    
    const [audit, setAudit] = useState<Audit | null>(null);
    const editorRef = useRef<any>(null);
    const [content, setContent] = useState("");
    const contentRef = useRef("");
    const databaseContentRef = useRef("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "error">("saved");
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [versions, setVersions] = useState<AuditVersion[]>([]);
    const [isDiffOpen, setIsDiffOpen] = useState(false);
    const [selectedDiffVersion, setSelectedDiffVersion] = useState<AuditVersion | null>(null);
    const [showChangedOnly, setShowChangedOnly] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [showRuler, setShowRuler] = useState(true);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [tableRows, setTableRows] = useState("3");
    const [tableCols, setTableCols] = useState("3");
    const [docHeader, setDocHeader] = useState("T.C. GENÇLIK VE SPOR BAKANLIĞI");
    const [docFooter, setDocFooter] = useState("Müfettişlik Raporu");
    const [showPageNumbers, setShowPageNumbers] = useState(true);

    // Sürüm Etiketleme
    const [isVersionLabelModalOpen, setIsVersionLabelModalOpen] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);
    const [isToolbarPinned, setIsToolbarPinned] = useState(true);
    const showToolbarActual = isToolbarPinned || showToolbar;

    const [syncConflictWarning, setSyncConflictWarning] = useState<string | null>(null);
    const [isChecklistOpen, setIsChecklistOpen] = useState(false);
    const [isAiSuggestionOpen, setIsAiSuggestionOpen] = useState(false);
    // Dil kontrol paneli kaldırıldı
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiInstructions, setAiInstructions] = useState("");
    const [aiSection, setAiSection] = useState("tamamini");
    const [aiSuggestedHtml, setAiSuggestedHtml] = useState("");
    const [aiApplyMode, setAiApplyMode] = useState<"replace" | "append" | "selection">("append");
    const [aiShowChangedOnly, setAiShowChangedOnly] = useState(false);
    const [aiSelectedText, setAiSelectedText] = useState("");
    const [aiPresetName, setAiPresetName] = useState("");
    const [savedAiPresets, setSavedAiPresets] = useState<SavedAiPromptPreset[]>([]);

    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [providerStatus, setProviderStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
    const lastVersionAtRef = useRef<number>(Date.now());
    const lastAutosaveSnapshotRef = useRef<string>("");
    const changedCharsSinceVersionRef = useRef<number>(0);
    
    const onlineUsers = useMemo(() => {
        const seen = new Set<string>();
        const unique: any[] = [];
        activeUsers.forEach((u) => {
            const key = (u?.uid || u?.name || '').toString().trim().toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(u);
        });
        return unique;
    }, [activeUsers]);

    const userIdentity = useMemo(() => ({
        userId: user?.uid,
        userEmail: user?.email || undefined
    }), [user?.uid, user?.email]);

    const auditRole = useMemo<"owner" | "edit" | "comment" | "view" | "none">(() => {
        if (!audit) return "none";
        const identities = [user?.uid, user?.email].filter(Boolean) as string[];
        if (!identities.length) return "none";
        if (identities.some((identity) => identity === audit.owner_id)) return "owner";

        const roleMap = audit.shared_roles || {};
        for (const identity of identities) {
            const role = roleMap[identity];
            if (role === "edit" || role === "comment" || role === "view") return role;
        }

        if (identities.some((identity) => (audit.shared_with || []).includes(identity))) return "edit";
        return "none";
    }, [audit, user?.uid, user?.email]);

    const canEditContent = auditRole === "owner" || auditRole === "edit";
    const canManageSharing = auditRole === "owner" || auditRole === "edit";
    const isReadOnlyEditor = !canEditContent;

    const plainText = useMemo(() => {
        return content.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    }, [content]);

    const wordCount = useMemo(() => (plainText ? plainText.split(" ").length : 0), [plainText]);
    const charCount = plainText.length;
    const estimatedPages = useMemo(() => Math.max(1, Math.ceil(wordCount / 450)), [wordCount]);

    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    const htmlToPlainLines = (html: string) => {
        return html
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/h[1-6]>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\r/g, "")
            .split("\n")
            .map((line) => line.trimEnd());
    };

    const estimateChangedChars = (left: string, right: string) => {
        let diff = 0;
        const minLen = Math.min(left.length, right.length);
        for (let i = 0; i < minLen; i++) {
            if (left.charAt(i) !== right.charAt(i)) {
                diff++;
            }
        }
        diff += Math.abs(left.length - right.length);
        return diff;
    };

    const toTurkishUpperCase = (str: string) => {
        return str
            .replace(/i/g, "İ")
            .replace(/ı/g, "I")
            .replace(/ğ/g, "Ğ")
            .replace(/ü/g, "Ü")
            .replace(/ş/g, "Ş")
            .replace(/ö/g, "Ö")
            .replace(/ç/g, "Ç")
            .toUpperCase();
    };

    const toTurkishLowerCase = (str: string) => {
        return str
            .replace(/İ/g, "i")
            .replace(/I/g, "ı")
            .replace(/Ğ/g, "ğ")
            .replace(/Ü/g, "ü")
            .replace(/Ş/g, "ş")
            .replace(/Ö/g, "ö")
            .replace(/Ç/g, "ç")
            .toLowerCase();
    };

    const toTurkishTitleCase = (str: string) => {
        return str.split(/(\s+)/).map(word => {
            if (word.trim().length === 0) return word;
            const first = word.charAt(0);
            const rest = word.slice(1);
            return toTurkishUpperCase(first) + toTurkishLowerCase(rest);
        }).join("");
    };

    const applyCaseTransform = (editor: any, mode: "upper" | "lower" | "title") => {
        const text = editor.selection.getContent({ format: 'text' }) || "";
        if (!text) {
            toast.error("Önce metin seçin.");
            return;
        }
        let converted = text;
        if (mode === "upper") {
            converted = toTurkishUpperCase(text);
        } else if (mode === "lower") {
            converted = toTurkishLowerCase(text);
        } else if (mode === "title") {
            converted = toTurkishTitleCase(text);
        }
        editor.selection.setContent(converted);
    };

    const splitTokens = (line: string) => line.split(/(\s+)/).filter((t) => t.length > 0);

    const getWordDiffSegments = (leftLine: string, rightLine: string) => {
        const leftTokens = splitTokens(leftLine);
        const rightTokens = splitTokens(rightLine);

        let prefix = 0;
        while (
            prefix < leftTokens.length &&
            prefix < rightTokens.length &&
            leftTokens[prefix] === rightTokens[prefix]
        ) {
            prefix += 1;
        }

        let leftSuffix = leftTokens.length - 1;
        let rightSuffix = rightTokens.length - 1;
        while (
            leftSuffix >= prefix &&
            rightSuffix >= prefix &&
            leftTokens[leftSuffix] === rightTokens[rightSuffix]
        ) {
            leftSuffix -= 1;
            rightSuffix -= 1;
        }

        const leftSegments = [
            ...leftTokens.slice(0, prefix).map((text) => ({ text, changed: false })),
            ...leftTokens.slice(prefix, leftSuffix + 1).map((text) => ({ text, changed: true })),
            ...leftTokens.slice(leftSuffix + 1).map((text) => ({ text, changed: false })),
        ];

        const rightSegments = [
            ...rightTokens.slice(0, prefix).map((text) => ({ text, changed: false })),
            ...rightTokens.slice(prefix, rightSuffix + 1).map((text) => ({ text, changed: true })),
            ...rightTokens.slice(rightSuffix + 1).map((text) => ({ text, changed: false })),
        ];

        return { leftSegments, rightSegments };
    };

    const diffRows = useMemo(() => {
        if (!isDiffOpen || !selectedDiffVersion) return [] as Array<{ lineNumber: number; left: string; right: string; changed: boolean }>;
        const leftLines = htmlToPlainLines(selectedDiffVersion.report_content || "");
        const rightLines = htmlToPlainLines(content || "");
        const maxLen = Math.max(leftLines.length, rightLines.length);

        return Array.from({ length: maxLen }, (_v, idx) => {
            const left = leftLines[idx] || "";
            const right = rightLines[idx] || "";
            return { lineNumber: idx + 1, left, right, changed: left !== right };
        });
    }, [isDiffOpen, selectedDiffVersion, content]);

    const changedLineCount = useMemo(() => diffRows.filter((row) => row.changed).length, [diffRows]);
    const visibleDiffRows = useMemo(() => {
        if (!showChangedOnly) return diffRows;
        return diffRows.filter((row) => row.changed);
    }, [diffRows, showChangedOnly]);

    const versionChangeStats = useMemo(() => {
        if (!isHistoryOpen) return {} as Record<string, { changedChars: number; changedLines: number }>;
        const stats: Record<string, { changedChars: number; changedLines: number }> = {};
        versions.forEach((version, idx) => {
            const previous = versions[idx + 1];
            if (!previous) {
                stats[version.id] = { changedChars: 0, changedLines: 0 };
                return;
            }

            const changedChars = estimateChangedChars(previous.report_content || "", version.report_content || "");
            const leftLines = htmlToPlainLines(previous.report_content || "");
            const rightLines = htmlToPlainLines(version.report_content || "");
            const maxLen = Math.max(leftLines.length, rightLines.length);
            let changedLines = 0;
            for (let i = 0; i < maxLen; i += 1) {
                if ((leftLines[i] || "") !== (rightLines[i] || "")) changedLines += 1;
            }
            stats[version.id] = { changedChars, changedLines };
        });
        return stats;
    }, [versions, isHistoryOpen]);

    const qualityChecks = useMemo(() => {
        const latestContent = editorRef.current?.getContent?.() || content || "";
        const normalizedText = latestContent.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        const hasPlaceholderTableText = /Başlık\s+\d|>Veri<|\bVeri\b/.test(latestContent);
        const hasDoubleSpaces = /\s{2,}/.test(normalizedText);
        const hasSentenceEnding = /[.!?…]$/.test(normalizedText);

        return [
            {
                id: "title",
                label: "Rapor başlığı mevcut",
                ok: Boolean(audit?.title?.trim()),
                critical: true,
                detail: audit?.title?.trim() ? audit.title : "Rapor başlığı boş."
            },
            {
                id: "date",
                label: "Rapor tarihi girilmiş",
                ok: Boolean(audit?.date?.trim()),
                critical: true,
                detail: audit?.date?.trim() ? audit.date : "Rapor tarihi eksik."
            },
            {
                id: "task",
                label: "İlişkili görev bağlı",
                ok: Boolean(audit?.task_id?.trim()),
                critical: true,
                detail: audit?.task_id?.trim() ? `Görev: ${audit.task_id}` : "Bu rapor henüz bir göreve bağlı değil."
            },
            {
                id: "content-length",
                label: "Rapor içeriği yeterli uzunlukta",
                ok: wordCount >= 120,
                critical: true,
                detail: `${wordCount.toLocaleString("tr-TR")} kelime bulundu. Minimum öneri: 120 kelime.`
            },
            {
                id: "header",
                label: "Üst bilgi tanımlı",
                ok: Boolean(docHeader.trim()),
                critical: false,
                detail: docHeader.trim() || "Üst bilgi boş."
            },
            {
                id: "footer",
                label: "Alt bilgi tanımlı",
                ok: Boolean(docFooter.trim()),
                critical: false,
                detail: docFooter.trim() || "Alt bilgi boş."
            },
            {
                id: "page-numbers",
                label: "Sayfa numarası açık",
                ok: showPageNumbers,
                critical: false,
                detail: showPageNumbers ? "Sayfa numaraları açık." : "Sayfa numaraları kapalı."
            },
            {
                id: "placeholders",
                label: "Şablon/örnek tablo verisi temizlenmiş",
                ok: !hasPlaceholderTableText,
                critical: false,
                detail: hasPlaceholderTableText ? "İçerikte örnek tablo metni veya placeholder veri var." : "Placeholder içerik bulunmadı."
            },
            {
                id: "spacing",
                label: "Metinde belirgin boşluk sorunu yok",
                ok: !hasDoubleSpaces && hasSentenceEnding,
                critical: false,
                detail: !hasDoubleSpaces && hasSentenceEnding
                    ? "Boşluk ve cümle sonu yapısı genel olarak uygun."
                    : "Çift boşluklar veya eksik cümle sonu işaretleri gözden geçirilmeli."
            }
        ];
    }, [audit?.title, audit?.date, audit?.task_id, content, wordCount, docHeader, docFooter, showPageNumbers]);

    const criticalChecklistFailures = useMemo(
        () => qualityChecks.filter((item) => item.critical && !item.ok),
        [qualityChecks]
    );

    const checklistSummary = useMemo(() => {
        const passed = qualityChecks.filter((item) => item.ok).length;
        return {
            passed,
            total: qualityChecks.length,
            criticalFailures: criticalChecklistFailures.length
        };
    }, [qualityChecks, criticalChecklistFailures.length]);

    const aiSuggestionPlainText = useMemo(() => {
        return aiSuggestedHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    }, [aiSuggestedHtml]);

    const aiSuggestionWordCount = useMemo(
        () => aiSuggestionPlainText.split(" ").filter(Boolean).length,
        [aiSuggestionPlainText]
    );

    const aiPresetStorageKey = useMemo(() => `mufyard_ai_prompt_presets_${user?.uid || user?.email || "guest"}`, [user?.uid, user?.email]);

    const aiDiffRows = useMemo(() => {
        if (!isAiSuggestionOpen) return [] as Array<{ lineNumber: number; left: string; right: string; changed: boolean }>;
        const leftLines = htmlToPlainLines(content || "");
        const rightLines = htmlToPlainLines(aiSuggestedHtml || "");
        const maxLen = Math.max(leftLines.length, rightLines.length);

        return Array.from({ length: maxLen }, (_v, idx) => {
            const left = leftLines[idx] || "";
            const right = rightLines[idx] || "";
            return { lineNumber: idx + 1, left, right, changed: left !== right };
        });
    }, [content, aiSuggestedHtml, isAiSuggestionOpen]);

    const aiVisibleDiffRows = useMemo(() => {
        if (!aiShowChangedOnly) return aiDiffRows;
        return aiDiffRows.filter((row) => row.changed);
    }, [aiDiffRows, aiShowChangedOnly]);

    const aiChangedLineCount = useMemo(() => aiDiffRows.filter((row) => row.changed).length, [aiDiffRows]);

    const refreshAiSelectionPreview = () => {
        const editor = editorRef.current;
        if (!editor) {
            setAiSelectedText("");
            return;
        }
        const nextSelectedText = String(editor.selection?.getContent?.({ format: "text" }) || "").trim();
        setAiSelectedText(nextSelectedText);
    };


    const handleConfirmInsertTable = () => {
        const rows = parseInt(tableRows);
        const cols = parseInt(tableCols);
        
        if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
            toast.error("Geçersiz satır veya sütun sayısı!");
            return;
        }
        
        if (!editorRef.current) return;

        let tableHTML = `<table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; margin:15px 0;"><tbody>`;
        tableHTML += `<tr style="background-color:#f8fafc;">`;
        for (let c = 1; c <= cols; c++) {
            tableHTML += `<td style="border:1px solid #cbd5e1; padding:12px; font-weight:bold;">Başlık ${c}</td>`;
        }
        tableHTML += `</tr>`;
        
        for (let r = 1; r < rows; r++) {
            tableHTML += `<tr>`;
            for (let c = 1; c <= cols; c++) {
                tableHTML += `<td style="border:1px solid #cbd5e1; padding:12px;">Veri</td>`;
            }
            tableHTML += `</tr>`;
        }
        tableHTML += `</tbody></table>`;
        
        editorRef.current.insertContent(tableHTML);
        setIsTableModalOpen(false);
        toast.success("Tablo başarıyla eklendi!");
    };

    const handlePrintPreview = () => {
        if (!editorRef.current) return;
        const printContent = editorRef.current.getContent();
        const printWindow = window.open("", "", "height=600,width=800");
        if (!printWindow) return;
        printWindow.document.write(`<html><head><title>Rapor Baskı Önizlemesi</title><style>body { font-family: Times New Roman, serif; margin: 20px; line-height: 1.6; } .header { text-align: center; font-weight: bold; margin-bottom: 20px; } .footer { text-align: center; margin-top: 30px; font-size: 12px; }</style></head><body><div class="header">${docHeader}</div>${printContent}<div class="footer">${docFooter}</div></body></html>`);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
    };

    const handleGenerateAiSuggestion = async () => {
        if (!id) return;
        try {
            setAiGenerating(true);
            const result = await generateReportSuggestion({
                auditId: id,
                instructions: aiInstructions,
                section: aiSection
            });
            setAiSuggestedHtml(result.html || "");
            toast.success("AI önerisi hazır.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "AI önerisi üretilemedi.";
            toast.error(message);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleApplyAiSuggestion = () => {
        void (async () => {
            if (!editorRef.current || !aiSuggestedHtml.trim() || !id) return;
            const editor = editorRef.current;
            const currentHtml = editor.getContent() || content;

            try {
                setSaving(true);

                if (aiApplyMode === "selection") {
                    const selectedHtml = String(editor.selection?.getContent?.({ format: "html" }) || "").trim();
                    if (!selectedHtml) {
                        toast.error("Seçili paragraf bulunamadı. Önce editörde bir paragraf veya metin seçin.");
                        return;
                    }
                    editor.selection.setContent(aiSuggestedHtml);
                    const updatedHtml = editor.getContent();
                    setContent(updatedHtml);
                    lastAutosaveSnapshotRef.current = updatedHtml;
                    await updateAudit(id, {
                        report_content: updatedHtml,
                        doc_header: docHeader,
                        doc_footer: docFooter,
                        show_page_numbers: showPageNumbers
                    }, true, userIdentity);
                    lastVersionAtRef.current = Date.now();
                    changedCharsSinceVersionRef.current = 0;
                    await loadVersions(id);
                    setLastSaved(new Date());
                    setIsAiSuggestionOpen(false);
                    toast.success("AI önerisi seçili alana uygulandı ve yeni sürüm kaydedildi.");
                    return;
                }

                const nextHtml = aiApplyMode === "replace"
                    ? aiSuggestedHtml
                    : `${currentHtml}${currentHtml.trim() ? "<p><br></p>" : ""}${aiSuggestedHtml}`;

                editor.setContent(nextHtml);
                setContent(nextHtml);
                lastAutosaveSnapshotRef.current = nextHtml;
                await updateAudit(id, {
                    report_content: nextHtml,
                    doc_header: docHeader,
                    doc_footer: docFooter,
                    show_page_numbers: showPageNumbers
                }, true, userIdentity);
                lastVersionAtRef.current = Date.now();
                changedCharsSinceVersionRef.current = 0;
                await loadVersions(id);
                setLastSaved(new Date());
                setIsAiSuggestionOpen(false);
                toast.success(
                    aiApplyMode === "replace"
                        ? "AI önerisi mevcut taslağın yerine uygulandı ve yeni sürüm kaydedildi."
                        : "AI önerisi taslağın sonuna eklendi ve yeni sürüm kaydedildi."
                );
            } catch (error) {
                toast.error("AI önerisi uygulanırken bir hata oluştu.");
            } finally {
                setSaving(false);
            }
        })();
    };

    const handleSaveAiPreset = () => {
        const label = aiPresetName.trim();
        const instructions = aiInstructions.trim();
        if (!label || !instructions) {
            toast.error("Preset kaydetmek için isim ve talimat gerekli.");
            return;
        }

        const nextPreset: SavedAiPromptPreset = {
            id: `${Date.now()}`,
            label,
            section: aiSection,
            instructions
        };
        const nextPresets = [nextPreset, ...savedAiPresets].slice(0, 12);
        setSavedAiPresets(nextPresets);
        localStorage.setItem(aiPresetStorageKey, JSON.stringify(nextPresets));
        setAiPresetName("");
        toast.success("AI preset kaydedildi.");
    };

    const handleDeleteAiPreset = (presetId: string) => {
        const nextPresets = savedAiPresets.filter((preset) => preset.id !== presetId);
        setSavedAiPresets(nextPresets);
        localStorage.setItem(aiPresetStorageKey, JSON.stringify(nextPresets));
        toast.success("Preset kaldırıldı.");
    };

    const handleExportWord = async () => {
        if (!id) return;
        if (criticalChecklistFailures.length > 0) {
            setIsChecklistOpen(true);
            toast.error("Teslim öncesi kalite kontrolünde kritik eksikler var.", { id: "export-word" });
            return;
        }
        try {
            toast.loading("Word dosyası oluşturuluyor...", { id: "export-word" });
            if (editorRef.current) {
                const latestContent = editorRef.current.getContent();
                await updateAudit(id, {
                    report_content: latestContent,
                    doc_header: docHeader,
                    doc_footer: docFooter,
                    show_page_numbers: showPageNumbers
                }, false, userIdentity);
                setContent(latestContent);
                lastAutosaveSnapshotRef.current = latestContent;
            }
            await exportAuditToWord(id);
            toast.success("Word dosyası indirildi!", { id: "export-word" });
        } catch (error) {
            toast.error("Word dosyası oluşturulamadı", { id: "export-word" });
        }
    };

    const handleSave = async () => {
        if (!id) return;
        if (!canEditContent) {
            toast.error("Bu raporu düzenleme yetkiniz yok.");
            return;
        }
        try {
            setSaving(true);
            const latestContent = editorRef.current?.getContent() || content;
            await updateAudit(id, { 
                report_content: latestContent,
                doc_header: docHeader,
                doc_footer: docFooter,
                show_page_numbers: showPageNumbers
            }, false, userIdentity);
            
            setContent(latestContent);
            lastAutosaveSnapshotRef.current = latestContent;
            setAutoSaveStatus("saved");
            if (user?.uid) {
                refreshAudits(user.uid, user?.email || undefined);
            }
            setLastSaved(new Date());
            toast.success("Rapor başarıyla kaydedildi!");
        } catch (error) {
            toast.error("Kaydedilirken hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveVersion = async () => {
        if (!id) return;
        if (!canEditContent) {
            toast.error("Bu raporu düzenleme yetkiniz yok.");
            return;
        }

        setIsVersionLabelModalOpen(true);
    };

    // Gerçek kaydetme işlemi (etiket seçildikten sonra)
    const handleConfirmSaveVersion = async (label: string) => {
        if (!id) return;
        setIsVersionLabelModalOpen(false);
        try {
            setSaving(true);
            const latestContent = editorRef.current?.getContent() || content;
            await updateAudit(id, {
                report_content: latestContent,
                doc_header: docHeader,
                doc_footer: docFooter,
                show_page_numbers: showPageNumbers,
                version_name: label
            }, true, userIdentity);

            setContent(latestContent);
            lastAutosaveSnapshotRef.current = latestContent;
            lastVersionAtRef.current = Date.now();
            changedCharsSinceVersionRef.current = 0;
            await loadVersions(id);
            setAutoSaveStatus("saved");
            if (user?.uid) {
                refreshAudits(user.uid, user?.email || undefined);
            }
            setLastSaved(new Date());
            toast.success(`Yeni sürüm kaydedildi! [${label}]`);
        } catch (error) {
            toast.error("Sürüm kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleShareUpdate = async (
        newSharedWith: string[],
        newSharedRoles?: Record<string, "view" | "comment" | "edit">
    ) => {
        if (!id) return;
        if (!canManageSharing) {
            toast.error("Bu raporda paylaşım ayarlarını değiştirme yetkiniz yok.");
            return;
        }
        try {
            const updated = await updateAudit(id, {
                shared_with: newSharedWith,
                ...(newSharedRoles ? { shared_roles: newSharedRoles } : {})
            }, false, userIdentity);
            setAudit(updated);
            toast.success("Paylaşım ayarları güncellendi.");
        } catch (error) {
            toast.error("Paylaşım güncellenemedi.");
        }
    };

    const loadVersions = async (auditId: string) => {
        try {
            const { fetchAuditVersions } = await import("../lib/api/audit");
            const data = await fetchAuditVersions(auditId);
            setVersions(data);
            if (data.length > 0) {
                const latestVersionAt = new Date(data[0].created_at).getTime();
                if (!Number.isNaN(latestVersionAt)) {
                    lastVersionAtRef.current = latestVersionAt;
                }
                changedCharsSinceVersionRef.current = 0;
            }
        } catch (error) {
            console.error(error);
            toast.error("Sürümler yüklenemedi");
        }
    };

    const handleSelectTemplate = async (template: ReportTemplate) => {
        const confirmed = await confirm({
            title: "Şablon Yüklensin mi?",
            message: `"${template.name}" şablonu yüklendiğinde editördeki tüm içeriğiniz temizlenecek ve şablon içeriği yazılacaktır. Devam etmek istiyor musunuz?`,
            confirmText: "Evet, Şablonu Yükle",
            cancelText: "İptal"
        });
        if (confirmed) {
            if (editorRef.current) {
                editorRef.current.setContent(template.html);
                setContent(template.html);
            }
            setIsTemplateModalOpen(false);
            toast.success(`"${template.name}" şablonu başarıyla yüklendi!`);
        }
    };

    // Sürüm geri alırken mevcut değişiklik kaybolacaksa uyarı
    const handleRestoreVersion = async (versionId: string) => {
        if (!id) return;
        const confirmed = await confirm({
            title: "Sürüme Geri Dön",
            message: `Bu sürüme geri dönmek istediğinize emin misiniz? Mevcut değişiklikleriniz kaybolabilir.\nFark önizlemesi için sürüm karşılaştırma ekranını kullanabilirsiniz.`,
            confirmText: "Geri Dön",
            variant: "warning"
        });
        if (!confirmed) return;

        try {
            setLoading(true);
            const { restoreAuditVersion } = await import("../lib/api/audit");
            await restoreAuditVersion(id, versionId, userIdentity);
            toast.success("Rapor başarıyla geri yüklendi.");
            await loadAudit(id);
            await loadVersions(id);
        } catch (error) {
            console.error(error);
            toast.error("Yükleme başarısız");
        } finally {
            setLoading(false);
        }
    };

    // Sürüm karşılaştırma ekranında fark vurgusu ve önizleme
    const handleOpenDiff = (version: AuditVersion) => {
        setSelectedDiffVersion(version);
        setShowChangedOnly(true);
        setIsDiffOpen(true);
    };

    const loadAudit = async (auditId: string) => {
        try {
            setLoading(true);
            editorLoadStartRef.current = performance.now();
            editorInitLoggedRef.current = false;
            const data = await fetchAuditById(auditId);
            setAudit(data);
            if (data.doc_header !== undefined) setDocHeader(data.doc_header || "T.C. GENÇLIK VE SPOR BAKANLIĞI");
            if (data.doc_footer !== undefined) setDocFooter(data.doc_footer || "Müfettişlik Raporu");
            if (data.show_page_numbers !== undefined) setShowPageNumbers(data.show_page_numbers ?? true);
            databaseContentRef.current = data.report_content || "<p></p>";
            setContent(data.report_content || "<p></p>");
            lastAutosaveSnapshotRef.current = data.report_content || "<p></p>";
        } catch (error) {
            console.error("Denetim yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id || loading) return;
        let cancelled = false;
        let ydoc: any = null;
        let provider: any = null;

        const setupCollaboration = async () => {
            try {
                const [Y, { WebsocketProvider }] = await Promise.all([
                    import("yjs"),
                    import("y-websocket")
                ]);

                if (cancelled) return;

                ydoc = new Y.Doc();
                const baseWs = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                provider = new WebsocketProvider(`${baseWs}/api/collaboration/report`, id, ydoc);

                provider.on('status', (event: any) => {
                    setProviderStatus(event.status);
                });

                const userName = user?.displayName || user?.email?.split('@')[0] || "Müfettiş";
                const cursorColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

                provider.awareness.setLocalStateField("user", {
                    uid: user?.uid || "",
                    name: userName,
                    color: cursorColor,
                });

                const updateUsers = () => {
                    const states = provider.awareness.getStates();
                    const users: any[] = [];
                    states.forEach((state: any) => {
                        if (state.user) users.push(state.user);
                    });
                    setActiveUsers(users);
                };

                provider.awareness.on('change', updateUsers);
                updateUsers();
            } catch (error) {
                console.error("Canlı iş birliği başlatılamadı:", error);
                setProviderStatus("disconnected");
            }
        };

        setupCollaboration();

        return () => {
            cancelled = true;
            provider?.disconnect?.();
            ydoc?.destroy?.();
        };
    }, [id, loading]);

    useEffect(() => {
        if (!id || loading) return;
        const interval = setInterval(async () => {
            if (editorRef.current && !saving) {
                const currentHTML = editorRef.current.getContent();
                if (currentHTML !== content && currentHTML.trim() !== "") {
                    try {
                        setAutoSaveStatus("saving");
                        const changed = estimateChangedChars(lastAutosaveSnapshotRef.current, currentHTML);
                        changedCharsSinceVersionRef.current += changed;
                        const shouldCreateVersion =
                            Date.now() - lastVersionAtRef.current >= VERSION_INTERVAL_MS ||
                            changedCharsSinceVersionRef.current >= VERSION_CHAR_THRESHOLD;

                        await updateAudit(id, { report_content: currentHTML }, shouldCreateVersion, userIdentity);
                        setContent(currentHTML);
                        setLastSaved(new Date());
                        setAutoSaveStatus("saved");
                        lastAutosaveSnapshotRef.current = currentHTML;

                        if (shouldCreateVersion) {
                            lastVersionAtRef.current = Date.now();
                            changedCharsSinceVersionRef.current = 0;
                            if (isHistoryOpen) {
                                await loadVersions(id);
                            }
                            toast.success("Otomatik sürüm kaydedildi! Sürüm geçmişinden geri alabilirsin.");
                        }
                    } catch (e) {
                        setAutoSaveStatus("error");
                    }
                }
            }
        }, AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [id, loading, content, saving, canEditContent, userIdentity, isHistoryOpen]);

    useEffect(() => {
        const handleUnloadSave = () => {
            if (editorRef.current && id && !loading) {
                const currentHTML = editorRef.current.getContent();
                if (currentHTML.trim() !== "") {
                    if (!canEditContent) return;
                    updateAudit(id, { report_content: currentHTML }, false, userIdentity).catch(err => {
                        console.warn("Beforeunload save hatası", err);
                    });
                }
            }
        };
        window.addEventListener('beforeunload', handleUnloadSave);
        return () => {
            window.removeEventListener('beforeunload', handleUnloadSave);
            handleUnloadSave();
        };
    }, [id, loading, canEditContent, userIdentity]);

    useEffect(() => {
        if (!id) return;
        loadAudit(id);
    }, [id]);

    useEffect(() => {
        if (!id || !isHistoryOpen) return;
        loadVersions(id);
    }, [id, isHistoryOpen]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(aiPresetStorageKey);
            if (!raw) {
                setSavedAiPresets([]);
                return;
            }
            const parsed = JSON.parse(raw);
            setSavedAiPresets(Array.isArray(parsed) ? parsed : []);
        } catch {
            setSavedAiPresets([]);
        }
    }, [aiPresetStorageKey]);

    useEffect(() => {
        if (!id) return;
        const refreshConflictState = () => {
            const conflicts = getSyncConflicts();
            const currentConflict = conflicts.find((item) => item.auditId === id);
            setSyncConflictWarning(currentConflict?.reason || null);
        };

        refreshConflictState();
        const onStorage = () => refreshConflictState();
        const onFocus = () => refreshConflictState();
        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
        };
    }, [id]);

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-muted-foreground font-medium italic">Rapor düzenleyici hazırlanıyor...</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[#f3f4f6]">
            <div className="bg-white border-b border-border px-3 md:px-6 py-2 flex flex-wrap items-center gap-2 md:gap-4 shadow-sm shrink-0 z-50">
                <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 flex-wrap">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                            if (editorRef.current && id) {
                                const currentHTML = editorRef.current.getContent();
                                try {
                                    if (!canEditContent) {
                                        navigate(-1);
                                        return;
                                    }
                                    await updateAudit(id, { 
                                        report_content: currentHTML,
                                        doc_header: docHeader,
                                        doc_footer: docFooter,
                                        show_page_numbers: showPageNumbers
                                    }, false, userIdentity);
                                } catch (e) {
                                    console.error("Back button save failed", e);
                                }
                            }
                            navigate(-1);
                        }} 
                        className="rounded-full w-8 h-8 p-0"
                    >
                        <ArrowLeft size={18} />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-nowrap">
                            <h2 className="font-bold text-base text-primary font-outfit truncate max-w-[200px] md:max-w-[400px]">{audit?.title}</h2>
                            {providerStatus === "connected" && (
                                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase rounded-full border border-emerald-100">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Canlı
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold tracking-wide flex-wrap">
                            <span className="flex items-center gap-1"><FileText size={10} /> Rapor Düzenleyici (TinyMCE)</span>
                            {auditRole !== "none" && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span className="uppercase tracking-wider text-[9px] font-black text-slate-500">Yetki: {auditRole === "owner" ? "Sahip" : auditRole === "edit" ? "Düzenle" : auditRole === "comment" ? "Yorumla" : "Görüntüle"}</span>
                                </>
                            )}
                            <span className="text-slate-300">•</span>
                            {autoSaveStatus === "saving" && (
                                <span className="flex items-center gap-1.5 text-amber-500 font-extrabold animate-pulse">
                                    <Loader2 size={10} className="animate-spin" /> Buluta Kaydediliyor...
                                </span>
                            )}
                            {autoSaveStatus === "saved" && (
                                <span className="flex items-center gap-1.5 text-emerald-600 font-extrabold">
                                    <CheckCircle size={10} className="text-emerald-500" /> Buluta Kaydedildi
                                    {lastSaved && <span className="text-slate-400 font-normal">({lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>}
                                </span>
                            )}
                            {autoSaveStatus === "error" && (
                                <span className="flex items-center gap-1.5 text-rose-500 font-extrabold">
                                    <span>⚠️</span> Bağlantı Kesildi (Kayıt Bekliyor)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 ml-0 md:ml-2">
                        <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50">
                            <button type="button" onClick={() => setZoom((z) => Math.max(70, z - 10))} className="text-[10px] font-black text-slate-400 hover:text-slate-800 px-1">-</button>
                            <span className="text-[10px] font-black text-slate-600 min-w-[32px] text-center">{zoom}%</span>
                            <button type="button" onClick={() => setZoom((z) => Math.min(160, z + 10))} className="text-[10px] font-black text-slate-400 hover:text-slate-800 px-1">+</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {providerStatus === 'connected' && onlineUsers.length > 0 && (
                            <div className="flex -space-x-1.5 mr-2">
                                {onlineUsers.map((u, i) => (
                                    <div key={i} title={u.name} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white shadow-sm" style={{ backgroundColor: u.color }}>
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* TÜM BUTONLAR VE PANELLER AKTİF */}
                        <Button variant="ghost" onClick={() => setIsShareModalOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg">Paylaş</Button>
                        <Button variant="ghost" onClick={() => setIsAuditTrailOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg">Denetim İzi</Button>
                        <Button variant="ghost" onClick={() => setIsHistoryOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg"><History size={14} className="mr-1.5" /> Sürümler</Button>
                        <Button variant="ghost" onClick={() => openChat(`audit_${id}`, audit?.title || "Rapor Odası", "audit")} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all"><MessageSquare size={14} className="mr-1.5" /> Rapor Odası</Button>
                        <Button variant="ghost" onClick={() => setIsTemplateModalOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all"><LayoutGrid size={14} className="mr-1.5" /> Şablon Seç</Button>
                        <Button variant="ghost" onClick={() => setIsProofreadOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all"><CheckCircle size={14} className="mr-1.5" /> Dil Kontrolü</Button>
                        <Button variant="ghost" onClick={() => setIsLegislationOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all"><BookOpen size={14} className="mr-1.5" /> Mevzuat Öner</Button>
                        <Button variant="ghost" onClick={() => setIsSnippetBankOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg">Taslak Metinler</Button>
                        <Button variant="ghost" onClick={() => setIsVoiceInputOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg">Sesli Not</Button>
                        <Button variant="ghost" onClick={() => setIsAiSuggestionOpen(true)} disabled={!canEditContent} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"><Sparkles size={14} className="mr-1.5" /> <span className="hidden xl:inline">AI Öneri</span></Button>
                         <Button variant="outline" onClick={handleSave} disabled={saving || !canEditContent} className="h-8 px-2 md:px-3 text-[11px] font-bold border-primary/20 rounded-lg">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="md:mr-1.5" />} <span className="hidden md:inline">Kaydet</span></Button>
                         <Button variant="outline" onClick={handleSaveVersion} disabled={saving || !canEditContent} className="h-8 px-2 md:px-3 text-[11px] font-bold border-emerald-300 text-emerald-700 rounded-lg"><History size={14} className="md:mr-1.5" /> <span className="hidden md:inline">Sürüm Kaydet</span></Button>
                         <ReportEditorVersionLabelModal isOpen={isVersionLabelModalOpen} onClose={() => setIsVersionLabelModalOpen(false)} onSave={handleConfirmSaveVersion} />
                         <Button onClick={handleExportWord} className="h-8 px-2 md:px-3 text-[11px] font-black bg-slate-900 text-white rounded-lg shadow-sm"><Download size={14} className="md:mr-1.5" /> <span className="hidden md:inline">Word</span></Button>
                         <Button variant="outline" onClick={handlePrintPreview} className="h-8 px-2 md:px-3 text-[11px] font-bold rounded-lg border-slate-300"><span className="mr-0 md:mr-1.5">🖨️</span> <span className="hidden md:inline">Önizleme</span></Button>
                                         {/* Tüm panellerin açılması */}
                                         {isAuditTrailOpen && <ReportEditorAuditTrailPanel isOpen={isAuditTrailOpen} onClose={() => setIsAuditTrailOpen(false)} auditId={id || ""} />}
                                         {isSnippetBankOpen && (
                                             <ReportEditorSnippetBankPanel 
                                                 isOpen={isSnippetBankOpen} 
                                                 onClose={() => setIsSnippetBankOpen(false)} 
                                                 onInsert={(html: string) => { 
                                                     if (editorRef.current) {
                                                         editorRef.current.insertContent(html); 
                                                         setContent(editorRef.current.getContent());
                                                     }
                                                     setIsSnippetBankOpen(false); 
                                                 }} 
                                             />
                                         )}
                                        {isVoiceInputOpen && (
                                            <div 
                                                onClick={() => setIsVoiceInputOpen(false)} 
                                                className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200"
                                            >
                                                <div 
                                                    onClick={(e) => e.stopPropagation()} 
                                                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md relative flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-800/80 animate-in zoom-in-95 duration-200"
                                                >
                                                    <button 
                                                        onClick={() => setIsVoiceInputOpen(false)} 
                                                        className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all" 
                                                        title="Kapat"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Sesli Not Girişi</h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-2 leading-relaxed">
                                                        Konuşmaya başlamak için aşağıdaki mikrofona tıklayın. Deşifre edilen metni düzenleyebilir, kopyalayabilir veya doğrudan editöre aktarabilirsiniz.
                                                    </p>
                                                    <VoiceToTextInput onResult={(text: string) => { 
                                                        if (editorRef.current) {
                                                            editorRef.current.insertContent(text); 
                                                            setContent(editorRef.current.getContent());
                                                        }
                                                        setIsVoiceInputOpen(false); 
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-12 flex justify-center gap-6">
                <div className="w-full max-w-[850px]">
                    {(auditRole === "view" || auditRole === "comment") && (
                        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
                            {auditRole === "comment"
                                ? "Yorumla rolundesiniz. Rapor metnini duzenleyemezsiniz; rapor sohbeti uzerinden geri bildirim verebilirsiniz."
                                : "Goruntuleme rolundesiniz. Bu rapor salt-okunur modda acildi."}
                        </div>
                    )}
                    {syncConflictWarning && (
                        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800 flex items-center justify-between gap-2">
                            <span>Çakışma uyarısı: {syncConflictWarning}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="text-[10px] uppercase tracking-widest font-black text-rose-700 hover:text-rose-900"
                                    onClick={() => setIsHistoryOpen(true)}
                                >
                                    Sürümleri Aç
                                </button>
                                <button
                                    type="button"
                                    className="text-[10px] uppercase tracking-widest font-black text-slate-500 hover:text-slate-700"
                                    onClick={() => {
                                        if (!id) return;
                                        clearSyncConflictsForAudit(id);
                                        setSyncConflictWarning(null);
                                    }}
                                >
                                    Kapat
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="mb-3 flex items-center justify-between px-2">
                        <div className="text-xs font-semibold text-slate-500">
                            {wordCount.toLocaleString("tr-TR")} kelime • {charCount.toLocaleString("tr-TR")} karakter • Tahmini {estimatedPages} sayfa
                        </div>
                        <div className="text-[11px] font-bold">
                            {checklistSummary.criticalFailures === 0 ? (
                                <span className="text-emerald-600">Teslim kontrolü hazır</span>
                            ) : (
                                <button type="button" onClick={() => setIsChecklistOpen(true)} className="text-amber-600 hover:text-amber-700">
                                    {checklistSummary.criticalFailures} kritik eksik var
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => setShowRuler((v) => !v)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                                {showRuler ? "Cetveli Gizle" : "Cetveli Göster"}
                            </button>
                        </div>
                    </div>

                    <Card onClick={(e) => { if (e.target === e.currentTarget && editorRef.current) editorRef.current.focus(); }} style={{ zoom: `${zoom}%` }} className="p-4 md:p-16 min-h-[1100px] bg-white shadow-2xl border-none rounded-none prose max-w-none relative mb-20 overflow-visible cursor-text">
                        <div className="absolute -top-1 left-0 w-full h-1 bg-primary/10" />
                        <div className="mb-4 pb-2 border border-dashed border-slate-200 hover:border-violet-300 hover:bg-slate-50/50 rounded-lg p-2 transition-all group relative">
                            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">✍️ RAPOR ÜST BİLGİSİ</span>
                            <input
                                value={docHeader}
                                onChange={(e) => setDocHeader(e.target.value)}
                                readOnly={isReadOnlyEditor}
                                className="w-full text-center text-xs font-semibold text-slate-500 bg-transparent outline-none cursor-pointer focus:cursor-text"
                                placeholder="Rapor Üst Bilgisi Eklemek İçin Buraya Tıklayın..."
                            />
                        </div>

                        {showRuler && (
                            <div className="hidden md:block mb-5 rounded-lg border border-slate-200 bg-slate-50 px-6 py-2">
                                <div className="h-5 relative overflow-hidden rounded bg-white/70 border border-slate-200" style={{ backgroundImage: "repeating-linear-gradient(to right, transparent 0 39px, #dbe2ea 39px 40px)" }}>
                                    <span className="absolute left-[8%] top-0 text-[9px] font-bold text-slate-400">2</span>
                                    <span className="absolute left-[25%] top-0 text-[9px] font-bold text-slate-400">4</span>
                                    <span className="absolute left-[42%] top-0 text-[9px] font-bold text-slate-400">6</span>
                                    <span className="absolute left-[59%] top-0 text-[9px] font-bold text-slate-400">8</span>
                                    <span className="absolute left-[76%] top-0 text-[9px] font-bold text-slate-400">10</span>
                                    <span className="absolute left-[93%] top-0 text-[9px] font-bold text-slate-400">12</span>
                                </div>
                            </div>
                        )}

                        {/* Cetvel ile Editör Arasındaki Şık Collapse & Pin Kontrolü */}
                        <div className="flex flex-col items-center w-full my-2 z-10 relative select-none">
                            <div 
                                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full px-4 py-1.5 shadow-sm hover:shadow transition-all cursor-pointer group"
                                onClick={() => {
                                    if (isToolbarPinned) {
                                        setIsToolbarPinned(false);
                                        setShowToolbar(false);
                                    } else {
                                        setShowToolbar(!showToolbar);
                                    }
                                }}
                            >
                                {/* Sabitleme Butonu */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextPinned = !isToolbarPinned;
                                        setIsToolbarPinned(nextPinned);
                                        if (nextPinned) {
                                            setShowToolbar(true);
                                        }
                                    }}
                                    className={`p-1 rounded-full hover:bg-white/80 transition-colors ${
                                        isToolbarPinned ? "text-violet-600 bg-violet-50 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    }`}
                                    title={isToolbarPinned ? "Araç Çubuğu Sabitlendi (Serbest Bırak)" : "Araç Çubuğunu Sabitle"}
                                >
                                    <Pin size={12} className={isToolbarPinned ? "fill-violet-600 rotate-45" : ""} />
                                </button>
                                
                                <span className="w-px h-3 bg-slate-200" />
                                
                                {/* Aç/Kapa Uzun Ok / Metin Butonu */}
                                <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 group-hover:text-slate-800 transition-colors">
                                    <span>{showToolbarActual ? "Araç Çubuğunu Gizle" : "Araç Çubuğunu Göster"}</span>
                                    {showToolbarActual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </div>
                        </div>

                        <Suspense fallback={<div className="h-[800px] flex items-center justify-center text-slate-400 text-xs font-bold"><Loader2 size={18} className="mr-2 animate-spin" /> Editör yükleniyor...</div>}>
                            <style>{`
                                .hide-tinymce-toolbar .tox-editor-header {
                                    display: none !important;
                                }
                            `}</style>
                            <div className={showToolbarActual ? "" : "hide-tinymce-toolbar"}>
                                <ReportEditorTinyMCELazy
                                licenseKey="gpl"
                                onInit={(_evt: any, editor: any) => {
                                    editorRef.current = editor;
                                    if (content) {
                                        editor.setContent(content);
                                    }
                                    editor.on("NodeChange SelectionChange KeyUp MouseUp", refreshAiSelectionPreview);
                                    if (!editorInitLoggedRef.current) {
                                        editorInitLoggedRef.current = true;
                                        logPerfSample("report-editor-ready", performance.now() - editorLoadStartRef.current, { auditId: id ? id.slice(0, 8) : "unknown" });
                                    }
                                }}
                                value={content}
                                onEditorChange={(newContent: any) => setContent(newContent)}
                                disabled={isReadOnlyEditor}
                                init={{
                                height: 800,
                                menubar: 'file edit view insert format tools table help',
                                toolbar_sticky: true,
                                toolbar_mode: 'wrap',
                                toolbar: 'undo redo | blocks | fontfamily fontsize | lineheightselect textcase | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist checklist outdent indent | blockquote link image media table | subscript superscript | removeformat | code fullscreen preview',
                                plugins: [
                                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                    'insertdatetime', 'media', 'table', 'help', 'wordcount', 'quickbars'
                                ],
                                skin: false,
                                content_css: false,
                                font_formats: 'Times New Roman=Times New Roman,Times,serif; Arial=arial,helvetica,sans-serif; Calibri=Calibri,sans-serif; Courier New=Courier New,Courier,monospace; Verdana=Verdana,sans-serif',
                                fontsize_formats: '8pt 9pt 10pt 10.5pt 11pt 12pt 14pt 16pt 18pt 20pt 22pt 24pt 26pt 28pt 36pt 48pt 72pt',
                                block_formats: 'Paragraf=p; Başlık 1=h1; Başlık 2=h2; Başlık 3=h3; Başlık 4=h4; Alıntı=blockquote',
                                line_height_formats: '1 1.15 1.5 2 2.5 3',
                                contextmenu: 'undo redo | inserttable | cell row column deletetable | link image',
                                quickbars_selection_toolbar: 'bold italic underline | forecolor backcolor | blocks | quicklink blockquote',
                                quickbars_insert_toolbar: 'quickimage quicktable',
                                table_default_attributes: {
                                    border: '1'
                                },
                                table_default_styles: {
                                    width: '100%',
                                    borderCollapse: 'collapse'
                                },
                                table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol',
                                content_style: 'body { font-family: Times New Roman, serif; font-size: 12pt; line-height: 1.6; padding: 24px; } p { margin: 0 0 12px 0; } table td, table th { border: 1px solid #cbd5e1; padding: 8px; }',
                                language: 'tr',
                                branding: false,
                                promotion: false,
                                setup: (editor: any) => {
                                    editor.ui.registry.addMenuButton('lineheightselect', {
                                        text: 'Satır Aralığı',
                                        fetch: (callback: any) => {
                                            callback([
                                                { type: 'menuitem', text: '1.0', onAction: () => editor.execCommand('LineHeight', false, '1') },
                                                { type: 'menuitem', text: '1.15', onAction: () => editor.execCommand('LineHeight', false, '1.15') },
                                                { type: 'menuitem', text: '1.5', onAction: () => editor.execCommand('LineHeight', false, '1.5') },
                                                { type: 'menuitem', text: '2.0', onAction: () => editor.execCommand('LineHeight', false, '2') },
                                                { type: 'menuitem', text: '2.5', onAction: () => editor.execCommand('LineHeight', false, '2.5') },
                                                { type: 'menuitem', text: '3.0', onAction: () => editor.execCommand('LineHeight', false, '3') }
                                            ]);
                                        }
                                    });

                                    editor.ui.registry.addMenuButton('textcase', {
                                        text: 'Harf',
                                        fetch: (callback: any) => {
                                            callback([
                                                { type: 'menuitem', text: 'BÜYÜK HARF', onAction: () => applyCaseTransform(editor, 'upper') },
                                                { type: 'menuitem', text: 'küçük harf', onAction: () => applyCaseTransform(editor, 'lower') },
                                                { type: 'menuitem', text: 'İlk Harfler Büyük', onAction: () => applyCaseTransform(editor, 'title') }
                                            ]);
                                        }
                                    });

                                    editor.ui.registry.addButton('insertcustomtable', {
                                        text: 'Tablo Ekle',
                                        onAction: () => setIsTableModalOpen(true)
                                    });

                                    editor.addShortcut('meta+s', 'Kaydet', () => {
                                        if (!isReadOnlyEditor) handleSave();
                                    });
                                    editor.addShortcut('ctrl+s', 'Kaydet', () => {
                                        if (!isReadOnlyEditor) handleSave();
                                    });
                                }
                                }}
                            />
                            </div>
                        </Suspense>

                        <div className="mt-8 pt-2 border border-dashed border-slate-200 hover:border-violet-300 hover:bg-slate-50/50 rounded-lg p-2.5 transition-all group relative flex items-center justify-between">
                            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">✍️ RAPOR ALT BİLGİSİ</span>
                            <input
                                value={docFooter}
                                onChange={(e) => setDocFooter(e.target.value)}
                                readOnly={isReadOnlyEditor}
                                className="w-[50%] text-xs font-semibold text-slate-500 bg-transparent outline-none cursor-pointer focus:cursor-text"
                                placeholder="Rapor Alt Bilgisi Eklemek İçin Buraya Tıklayın..."
                            />
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showPageNumbers}
                                        onChange={(e) => setShowPageNumbers(e.target.checked)}
                                        disabled={isReadOnlyEditor}
                                        className="rounded text-violet-600 focus:ring-violet-400 w-3.5 h-3.5 cursor-pointer border-slate-300"
                                    />
                                    Sayfa No Ekle
                                </label>
                                <span className="text-xs font-bold text-slate-400">Sayfa 1 / {estimatedPages}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {isShareModalOpen && (
                <Suspense fallback={null}>
                    <ShareModalLazy
                        isOpen={isShareModalOpen}
                        onClose={() => setIsShareModalOpen(false)}
                        sharedWith={audit?.shared_with || []}
                        sharedRoles={audit?.shared_roles || {}}
                        enableRoles={true}
                        onShare={() => {}}
                        onShareWithRoles={handleShareUpdate}
                        title={`"${audit?.title}" Rapor Paylaşımı`}
                    />
                </Suspense>
            )}

            {isHistoryOpen && (
                <Suspense fallback={null}>
                    <ReportEditorHistoryPanelLazy
                        isOpen={isHistoryOpen}
                        onClose={() => setIsHistoryOpen(false)}
                        versions={versions}
                        versionChangeStats={versionChangeStats}
                        onRestoreVersion={handleRestoreVersion}
                        onOpenDiff={handleOpenDiff}
                        onDeleteVersions={async (ids: string[]) => {
                            if (!id || !ids.length) return;
                            if (!window.confirm("Seçili sürümleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
                            try {
                                const { deleteAuditVersion } = await import("../lib/api/audit");
                                for (const vid of ids) {
                                    await deleteAuditVersion(id, vid);
                                }
                                await loadVersions(id);
                                toast.success("Seçili sürümler silindi.");
                            } catch (e) {
                                toast.error("Sürüm(ler) silinemedi.");
                            }
                        }}
                    />
                </Suspense>
            )}

            {isChecklistOpen && (
                <Suspense fallback={null}>
                    <ReportEditorChecklistPanelLazy
                        isOpen={isChecklistOpen}
                        onClose={() => setIsChecklistOpen(false)}
                        summary={checklistSummary}
                        items={qualityChecks}
                        criticalFailureCount={checklistSummary.criticalFailures}
                        onPrepareDelivery={async () => {
                            if (checklistSummary.criticalFailures > 0) {
                                toast.error("Önce kritik eksikleri tamamlayın.");
                                return;
                            }
                            setIsChecklistOpen(false);
                            await handleExportWord();
                        }}
                    />
                </Suspense>
            )}

            {isAiSuggestionOpen && (
                <Suspense fallback={null}>
                    <ReportEditorAiSuggestionPanelLazy
                        isOpen={isAiSuggestionOpen}
                        onClose={() => setIsAiSuggestionOpen(false)}
                        canEditContent={canEditContent}
                        aiPromptPresets={AI_PROMPT_PRESETS}
                        savedAiPresets={savedAiPresets}
                        onSelectPreset={(preset) => {
                            setAiInstructions(preset.instructions);
                            setAiSection(preset.section);
                        }}
                        onDeletePreset={handleDeleteAiPreset}
                        aiPresetName={aiPresetName}
                        setAiPresetName={setAiPresetName}
                        onSavePreset={handleSaveAiPreset}
                        aiSection={aiSection}
                        setAiSection={setAiSection}
                        aiInstructions={aiInstructions}
                        setAiInstructions={setAiInstructions}
                        aiGenerating={aiGenerating}
                        onGenerateSuggestion={handleGenerateAiSuggestion}
                        aiApplyMode={aiApplyMode}
                        setAiApplyMode={setAiApplyMode}
                        aiSelectedText={aiSelectedText}
                        aiSuggestedHtml={aiSuggestedHtml}
                        aiSuggestionWordCount={aiSuggestionWordCount}
                        aiChangedLineCount={aiChangedLineCount}
                        aiDiffLineCount={aiDiffRows.length}
                        aiShowChangedOnly={aiShowChangedOnly}
                        setAiShowChangedOnly={setAiShowChangedOnly}
                        aiVisibleDiffRows={aiVisibleDiffRows}
                        getWordDiffSegments={getWordDiffSegments}
                        onApplySuggestion={handleApplyAiSuggestion}
                    />
                </Suspense>
            )}

            {isDiffOpen && selectedDiffVersion && (
                <div className="fixed inset-x-0 bottom-0 top-[64px] z-40 bg-black/35 flex items-start justify-center p-2 md:p-4">
                    <Card className="w-full max-w-6xl h-[calc(100vh-80px)] p-0 overflow-hidden border border-slate-200 shadow-2xl">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm md:text-base font-bold text-slate-800">Sürüm Karşılaştırma</h3>
                                <p className="text-[11px] text-slate-500">Sol: {selectedDiffVersion.version_name} • Sağ: Mevcut Taslak</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{changedLineCount} satır farklı / {diffRows.length} satır toplam</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowChangedOnly((v) => !v)}
                                    className="h-8 text-[11px]"
                                >
                                    {showChangedOnly ? "Tüm Satırlar" : "Sadece Değişenler"}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                        await handleRestoreVersion(selectedDiffVersion.id);
                                        setIsDiffOpen(false);
                                    }}
                                    className="h-8 text-[11px] border-amber-300 text-amber-700"
                                >
                                    Bu Sürüme Dön
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setIsDiffOpen(false)} className="rounded-full w-8 h-8 p-0">
                                    <X size={16} />
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 h-[calc(100%-58px)]">
                            <div className="border-r border-slate-200 overflow-auto">
                                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                                    {selectedDiffVersion.version_name}
                                </div>
                                <div className="font-mono text-[11px] leading-5">
                                    {visibleDiffRows.length === 0 && (
                                        <div className="px-3 py-4 text-xs text-slate-500">Değişen satır bulunamadı.</div>
                                    )}
                                    {visibleDiffRows.map((row, idx) => {
                                        const segments = row.changed && typeof getWordDiffSegments === 'function' ? getWordDiffSegments(row.left, row.right).leftSegments : [{ text: row.left || " ", changed: false }];
                                        return (
                                        <div key={`left-${idx}`} className={`px-3 py-1 whitespace-pre-wrap ${row.changed ? "bg-rose-50" : "bg-white"}`}>
                                            <span className="text-slate-400 mr-2">{row.lineNumber}.</span>
                                            <span>
                                                {segments.map((segment, sIdx) => (
                                                    <span key={`ls-${idx}-${sIdx}`} className={segment.changed ? "bg-rose-200/80 rounded px-0.5" : ""}>{segment.text}</span>
                                                ))}
                                            </span>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="overflow-auto">
                                <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                                    Mevcut Taslak
                                </div>
                                <div className="font-mono text-[11px] leading-5">
                                    {visibleDiffRows.length === 0 && (
                                        <div className="px-3 py-4 text-xs text-slate-500">Değişen satır bulunamadı.</div>
                                    )}
                                    {visibleDiffRows.map((row, idx) => {
                                        const segments = row.changed && typeof getWordDiffSegments === 'function' ? getWordDiffSegments(row.left, row.right).rightSegments : [{ text: row.right || " ", changed: false }];
                                        return (
                                        <div key={`right-${idx}`} className={`px-3 py-1 whitespace-pre-wrap ${row.changed ? "bg-emerald-50" : "bg-white"}`}>
                                            <span className="text-slate-400 mr-2">{row.lineNumber}.</span>
                                            <span>
                                                {segments.map((segment, sIdx) => (
                                                    <span key={`rs-${idx}-${sIdx}`} className={segment.changed ? "bg-emerald-200/90 rounded px-0.5" : ""}>{segment.text}</span>
                                                ))}
                                            </span>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {isTableModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-96 p-6">
                        <h3 className="text-lg font-bold mb-4">Tablo Ekle</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-slate-600">Satır Sayısı</label>
                                <input
                                    type="number"
                                    value={tableRows}
                                    onChange={(e) => setTableRows(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-slate-600">Sütun Sayısı</label>
                                <input
                                    type="number"
                                    value={tableCols}
                                    onChange={(e) => setTableCols(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                                    min="1"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={() => setIsTableModalOpen(false)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Vazgeç
                                </Button>
                                <Button
                                    onClick={handleConfirmInsertTable}
                                    className="flex-1"
                                >
                                    Tablo Ekle
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Şablon Seçim Modali */}
            {isTemplateModalOpen && (
                <div 
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
                >
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-100 dark:border-slate-800/80 overflow-hidden animate-in zoom-in-95 duration-200"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <LayoutGrid className="text-violet-600 dark:text-violet-400" size={20} /> Resmi Rapor Taslakları & Şablonları
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Müfettişlik rehberi standartlarına uygun resmi rapor kapak ve içerik taslakları.</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setIsTemplateModalOpen(false)} className="rounded-full w-8 h-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center">
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Group by category */}
                            {["Genel Teftiş", "Spor Kulüpleri", "Ön İnceleme", "İnceleme-Soruşturma"].map((cat) => {
                                const templates = REPORT_TEMPLATES.filter((t) => t.category === cat);
                                if (templates.length === 0) return null;

                                let catIcon = <BookOpen className="text-blue-500" size={16} />;
                                if (cat === "Spor Kulüpleri") catIcon = <Users className="text-emerald-500" size={16} />;
                                if (cat === "Ön İnceleme") catIcon = <FileText className="text-amber-500" size={16} />;
                                if (cat === "İnceleme-Soruşturma") catIcon = <CheckCircle className="text-rose-500" size={16} />;

                                return (
                                    <div key={cat} className="space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                                            {catIcon} {cat} ({templates.length} Taslak)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {templates.map((template) => (
                                                <div 
                                                    key={template.id}
                                                    onClick={() => handleSelectTemplate(template)}
                                                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 bg-white dark:bg-slate-900 hover:bg-violet-50/10 cursor-pointer group transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                                                            {template.name}
                                                        </h5>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                            T.C. Gençlik ve Spor Bakanlığı resmi formatında düzenlenmiş Word uyumlu taslak.
                                                        </p>
                                                    </div>
                                                    <div className="mt-4 flex items-center justify-end text-[10px] font-bold text-violet-600 dark:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        ŞABLONU SEÇ ➔
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">Toplam 14 resmi Word şablonu yüklü.</span>
                            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(false)} className="rounded-xl h-9 text-xs">
                                Kapat
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dil Kontrol Paneli */}
            {isProofreadOpen && (
                <ReportEditorProofreadPanel
                    content={content || ""}
                    onClose={() => setIsProofreadOpen(false)}
                />
            )}

            {/* Mevzuat Öneri Paneli */}
            {isLegislationOpen && (
                <ReportEditorLegislationPanel
                    content={content || ""}
                    onInsertReference={(refText) => {
                        if (editorRef.current) {
                            editorRef.current.insertContent(refText);
                        }
                    }}
                    onClose={() => setIsLegislationOpen(false)}
                />
            )}
        </div>
    );
}