import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { QuillBinding } from "y-quill";
import QuillCursors from "quill-cursors";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { isElectron } from "../lib/firebase";



const registeredImports = (Quill as any).imports || {};

if (!registeredImports["modules/cursors"]) {
    Quill.register("modules/cursors", QuillCursors);
}

// ── Font Family Registration ──
const FontAttributor = Quill.import("formats/font") as any;
if (FontAttributor) {
    FontAttributor.whitelist = ["times-new-roman", "sans-serif", "serif", "monospace", "arial", "calibri", "courier-new"];
    Quill.register(FontAttributor, true);
}

// ── Font Size Registration (Word-standard pt values) ──
const SizeAttributor = Quill.import("attributors/style/size") as any;
if (SizeAttributor) {
    SizeAttributor.whitelist = ["8pt","9pt","10pt","10.5pt","11pt","12pt","14pt","16pt","18pt","20pt","22pt","24pt","26pt","28pt","36pt","48pt","72pt"];
    Quill.register(SizeAttributor, true);
}

// ── Color and Background Color Style Registration (Enables inline styles instead of class styles) ──
const ColorAttributor = Quill.import("attributors/style/color") as any;
if (ColorAttributor) {
    Quill.register(ColorAttributor, true);
}

const BackgroundAttributor = Quill.import("attributors/style/background") as any;
if (BackgroundAttributor) {
    Quill.register(BackgroundAttributor, true);
}

// ── Line Height Block Style Registration ──
try {
    const Parchment = Quill.import("parchment") as any;
    if (Parchment) {
        // Quill 2.0 uses Parchment.StyleAttributor, older versions use Parchment.Attributor.Style or legacy attributors/style
        const StyleAttributor = Parchment.StyleAttributor || Parchment.Attributor?.Style || registeredImports["attributors/style"];
        
        if (StyleAttributor) {
            const LineHeightAttributor = new StyleAttributor("lineheight", "line-height", {
                scope: Parchment.Scope?.BLOCK || 3, // BLOCK level scope
                whitelist: ["1", "1.15", "1.5", "2", "2.5", "3"]
            });
            Quill.register(LineHeightAttributor, true);
        } else {
            console.warn("Could not find StyleAttributor class for custom lineheight.");
        }
    }
} catch (e) {
    console.error("Failed to register custom LineHeightAttributor:", e);
}

// ── Custom Page Break Blot ──
const BlockEmbed = Quill.import("blots/block/embed") as any;
if (BlockEmbed && !registeredImports["formats/pagebreak"]) {
    class PageBreakBlot extends BlockEmbed {
        static create() {
            const node = super.create();
            node.setAttribute("class", "page-break-divider");
            node.setAttribute("contenteditable", "false");
            node.innerHTML = '<span class="page-break-text">SAYFA SONU (PAGE BREAK)</span>';
            return node;
        }
        static value() {
            return true;
        }
    }
    PageBreakBlot.blotName = "pagebreak";
    PageBreakBlot.tagName = "hr";
    Quill.register(PageBreakBlot, true);
}
import { Save, Download, ArrowLeft, Loader2, FileText, CheckCircle, History, Clock, Users, Sparkles, MessageSquare, Wand2, BookOpen, X, Trash2, Square, CheckSquare } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchAuditById, updateAudit, exportAuditToWord, fetchAuditVersions, restoreAuditVersion, deleteAuditVersion, type Audit, type AuditVersion } from "../lib/api/audit";
import ShareModal from "../components/ShareModal";
import { WS_URL, API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useChat } from "../lib/context/ChatContext";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { REPORT_TEMPLATES, type ReportTemplate } from "../lib/reportTemplates";
import { LayoutGrid } from "lucide-react";


export default function ReportEditor() {
    const confirm = useConfirm();
    const { user } = useAuth();

    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { refreshAudits } = useGlobalData();
    const [audit, setAudit] = useState<Audit | null>(null);
    const quillRef = useRef<any>(null);
    const lastSelectionRange = useRef<any>(null);
    const [content, setContent] = useState("");
    const contentRef = useRef("");
    const databaseContentRef = useRef("");
    useEffect(() => {
        contentRef.current = content;
    }, [content]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "error">("saved");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [versions, setVersions] = useState<AuditVersion[]>([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedVersionIds, setSelectedVersionIds] = useState<Set<string>>(new Set());
    const [zoom, setZoom] = useState(100);
    const [showRuler, setShowRuler] = useState(true);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [isTableEditModalOpen, setIsTableEditModalOpen] = useState(false);
    const [tableRows, setTableRows] = useState("3");
    const [tableCols, setTableCols] = useState("3");
    const pageMode = true;
    const [docHeader, setDocHeader] = useState("T.C. GENÇLİK VE SPOR BAKANLIĞI");
    const [docFooter, setDocFooter] = useState("Müfettişlik Raporu");
    const [showPageNumbers, setShowPageNumbers] = useState(true);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    // AI Bubble Menu State
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [showAIBar, setShowAIBar] = useState(false);
    const [processingAI, setProcessingAI] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [selectionRange, setSelectionRange] = useState<any>(null);
    const { openChat } = useChat();

    // AI Report Generation State
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiInstructions, setAiInstructions] = useState("");
    const [aiSection, setAiSection] = useState<string>("tamamini");
    const [aiInsertMode, setAiInsertMode] = useState<"replace" | "append">("append");
    const AI_REPORT_ASSISTANT_ENABLED = false;

    const focusEditorToEnd = (e: React.MouseEvent) => {
        if (e.target !== e.currentTarget) return;
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        editor.focus();
        const len = editor.getLength();
        editor.setSelection(Math.max(0, len - 1), 0, 'user');
    };

    const handleSelectTemplate = async (template: ReportTemplate) => {
        const isConfirmed = await confirm({
            title: "Şablon Yüklensin mi?",
            message: `"${template.name}" şablonu yüklendiğinde editördeki tüm içeriğiniz temizlenecek ve şablon içeriği yazılacaktır. Devam etmek istiyor musunuz?`,
            confirmText: "Evet, Şablonu Yükle",
            cancelText: "Vazgeç"
        });
        if (!isConfirmed) return;
        
        if (quillRef.current) {
            const editor = quillRef.current.getEditor();
            // Tek atomik çağrı: tüm içeriği temizleyip şablon HTML'ini yükler
            editor.clipboard.dangerouslyPasteHTML(template.html);
            setIsTemplateModalOpen(false);
            toast.success(`"${template.name}" şablonu başarıyla yüklendi!`);
        }
    };

    // ── Word-like Features State ──

    // ── Case Conversion ──
    const handleCaseConvert = (mode: "upper" | "lower" | "title") => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const range = editor.getSelection();
        if (!range || range.length === 0) { toast.error("Önce metin seçin."); return; }
        const text = editor.getText(range.index, range.length);
        let converted = text;
        if (mode === "upper") converted = text.toUpperCase();
        else if (mode === "lower") converted = text.toLowerCase();
        else converted = text.replace(/\b\w/g, (c: string) => c.toUpperCase());
        editor.deleteText(range.index, range.length);
        editor.insertText(range.index, converted);
        editor.setSelection(range.index, converted.length);
    };


    // ── Page Break ──
    const handlePageBreak = () => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const range = editor.getSelection(true);
        editor.insertText(range.index, "\n", "user");
        editor.insertEmbed(range.index + 1, "pagebreak", true, "user");
        editor.setSelection(range.index + 2, 0, "user");
    };

    // ── Table Insertion (Word Style) ──
    const handleInsertTable = () => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        
        // Capture range before opening modal to preserve insertion focus
        const range = editor.getSelection() || lastSelectionRange.current || { index: 0, length: 0 };
        lastSelectionRange.current = range;
        
        // Contextually inspect active formats at active index to detect active table
        const formats = editor.getFormat(range.index, range.length);
        const isCurrentlyInTable = !!(formats.table || formats['table-cell'] || formats['table-row'] || formats['table-cell-line']);
        
        if (isCurrentlyInTable) {
            setIsTableEditModalOpen(true);
        } else {
            setTableRows("3");
            setTableCols("3");
            setIsTableModalOpen(true);
        }
    };

    const handleConfirmInsertTable = () => {
        const rows = parseInt(tableRows);
        const cols = parseInt(tableCols);
        
        if (isNaN(rows) || isNaN(cols) || rows <= 0 || cols <= 0) {
            toast.error("Geçersiz satır veya sütun sayısı!");
            return;
        }
        
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const range = lastSelectionRange.current || editor.getSelection(true) || { index: 0 };
        
        // Generate a beautiful, Word-compatible HTML table with light slate borders and subtle head background
        let tableHTML = `<table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; margin:15px 0;">`;
        
        // Header Row
        tableHTML += `<tr style="background-color:#f8fafc;">`;
        for (let c = 1; c <= cols; c++) {
            tableHTML += `<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:bold; font-family:'Times New Roman',Times,serif; font-size:11pt; color:#1e293b;">Başlık ${c}</th>`;
        }
        tableHTML += `</tr>`;
        
        // Data Rows
        for (let r = 1; r <= rows; r++) {
            tableHTML += `<tr>`;
            for (let c = 1; c <= cols; c++) {
                tableHTML += `<td style="border:1px solid #cbd5e1; padding:10px; font-family:'Times New Roman',Times,serif; font-size:11pt; color:#334155; min-width:80px; min-height:30px;">Metin</td>`;
            }
            tableHTML += `</tr>`;
        }
        
        tableHTML += `</table><p><br></p>`;
        
        // Paste the table HTML at the current range index
        editor.clipboard.dangerouslyPasteHTML(range.index, tableHTML, "user");
        editor.setSelection(range.index + 1, 0, "user");
        setIsTableModalOpen(false);
        toast.success(`${rows}x${cols} boyutunda tablo başarıyla oluşturuldu!`);
    };

    // ── Table Actions (Insert/Delete Row/Col) ──
    const handleTableAction = (action: "insert-row" | "delete-row" | "insert-col" | "delete-col" | "delete-table") => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const tableModule = editor.getModule('table');
        if (!tableModule) {
            toast.error("Tablo modülü yüklenemedi.");
            return;
        }
        
        try {
            switch (action) {
                case "insert-row":
                    tableModule.insertRowBelow();
                    toast.success("Yeni satır eklendi.");
                    break;
                case "delete-row":
                    tableModule.deleteRow();
                    toast.success("Satır silindi.");
                    break;
                case "insert-col":
                    tableModule.insertColumnRight();
                    toast.success("Yeni sütun eklendi.");
                    break;
                case "delete-col":
                    tableModule.deleteColumn();
                    toast.success("Sütun silindi.");
                    break;
                case "delete-table":
                    tableModule.deleteTable();
                    toast.success("Tablo silindi.");
                    break;
            }
        } catch (e) {
            toast.error("Bu işlem sadece imleç bir tablo hücresindeyken yapılabilir.");
        }
    };

    // ── Print Preview ──
    const handlePrintPreview = () => {
        if (!quillRef.current) return;
        const editorContent = quillRef.current.getEditor().root.innerHTML;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>${audit?.title || "Rapor"}</title>
        <style>
            @page { size: A4; margin: 2.5cm; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; }
            h1 { font-size: 18pt; text-align: center; margin-bottom: 1em; }
            h2 { font-size: 14pt; margin-top: 1em; }
            p { margin-bottom: 0.5em; text-indent: 1.25cm; }
            .header { text-align: center; font-size: 10pt; border-bottom: 1px solid #ccc; padding-bottom: 8px; margin-bottom: 20px; color: #555; }
            .footer { text-align: right; font-size: 9pt; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 20px; position: fixed; bottom: 0; left: 0; right: 0; color: #555; }
            @media print {
                .footer-text::after {
                    content: "${showPageNumbers ? "  |  Sayfa " + "counter(page)" : ""}";
                }
            }
        </style></head><body>
        <div class="header">${docHeader}</div>
        ${editorContent}
        <div class="footer"><span class="footer-text">${docFooter}</span></div>
        </body></html>`);
        // We write counter(page) literally as a CSS string
        printWindow.document.body.innerHTML = printWindow.document.body.innerHTML.replace("counter(page)", "counter(page)");
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    useEffect(() => {
        if (id) {
            loadAudit(id);
            loadVersions(id);
        }
    }, [id]);

    // Unmount and beforeunload auto-save to guarantee 100% data retention when closing window or navigating away
    useEffect(() => {
        const handleUnloadSave = () => {
            if (quillRef.current && id && !loading) {
                const editor = quillRef.current.getEditor();
                const currentHTML = editor.root.innerHTML;
                const isEmpty = currentHTML.trim() === "" || currentHTML === "<h1></h1>" || currentHTML === "<p><br></p>";
                if (!isEmpty) {
                    // Fire-and-forget sync save via updateAudit
                    updateAudit(id, { report_content: currentHTML }).catch(err => {
                        console.warn("Beforeunload auto-save failed", err);
                    });
                }
            }
        };

        window.addEventListener('beforeunload', handleUnloadSave);
        return () => {
            window.removeEventListener('beforeunload', handleUnloadSave);
            handleUnloadSave(); // Fire-and-forget save when React component unmounts (e.g. sidebar navigation)
        };
    }, [id, loading]);

    // Premium Word-Style Auto-Save Hook: Saves silently every 10 seconds if changes are detected, showing live cloud save status
    useEffect(() => {
        if (!id || loading) return;

        const interval = setInterval(async () => {
            if (quillRef.current && !saving) {
                const editor = quillRef.current.getEditor();
                const currentHTML = editor.root.innerHTML;
                
                // Normal empty editor is "<h1></h1>" or "<p><br></p>"
                const isEmpty = currentHTML.trim() === "" || currentHTML === "<h1></h1>" || currentHTML === "<p><br></p>";
                
                // Only auto-save if content has changed and is not empty
                if (currentHTML !== content && !isEmpty) {
                    try {
                        setAutoSaveStatus("saving");
                        await updateAudit(id, { report_content: currentHTML }); // Silent background save (uses 30-min smart threshold backend logic)
                        setContent(currentHTML);
                        setLastSaved(new Date());
                        setAutoSaveStatus("saved");
                        console.log("MufYard Live Auto-Save: Success.");
                    } catch (e) {
                        console.warn("MufYard Live Auto-Save: Failure.", e);
                        setAutoSaveStatus("error");
                    }
                }
            }
        }, 10000); // Word-style 10 seconds background loop

        return () => clearInterval(interval);
    }, [id, loading, content, saving]);

    const loadVersions = async (auditId: string) => {
        try {
            const data = await fetchAuditVersions(auditId);
            setVersions(data);
        } catch (error) {
            console.error(error);
            toast.error("Sürümler yüklenemedi");
        }

    };

    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [providerStatus, setProviderStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
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
    const plainText = useMemo(() => {
        return content
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }, [content]);
    const wordCount = useMemo(() => (plainText ? plainText.split(" ").length : 0), [plainText]);
    const charCount = plainText.length;
    const estimatedPages = useMemo(() => Math.max(1, Math.ceil(wordCount / 450)), [wordCount]);
    useEffect(() => {
        if (!id || loading) return;

        // Initialize YJS Document & WebSocket Provider
        const ydoc = new Y.Doc();
        const baseWs = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
        const provider = new WebsocketProvider(
            `${baseWs}/api/collaboration/report`,
            id,
            ydoc
        );

        provider.on('status', (event: any) => {
            setProviderStatus(event.status);
        });

        const ytext = ydoc.getText("quill");
        
        let binding: any;
        if (quillRef.current) {
            const editor = quillRef.current.getEditor();
            
            // ── Selection Loss Prevention Patch (Quill Core API Override) ──
            // Seçim kaybı tüm platformlarda (web + Electron) olabilir;
            // renklendirme/vurgulama için seçim null döndüğünde son geçerli seçimi kullan.
            {
                const originalGetSelection = editor.getSelection.bind(editor);
                editor.getSelection = (focus = false) => {
                    const sel = originalGetSelection(focus);
                    if (sel) {
                        lastSelectionRange.current = sel;
                        return sel;
                    }
                    return lastSelectionRange.current || { index: 0, length: 0 };
                };
            }
            
            // Get user info from Firebase Auth
            const userName = user?.displayName
                || user?.email?.split('@')[0]
                || "Müfettiş";

            const cursorColor = '#' + Math.floor(Math.random()*16777215).toString(16);
            
            provider.awareness.setLocalStateField("user", {
                uid: user?.uid || "",
                name: userName,
                color: cursorColor,
            });

            // Track active users
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
            
            provider.on('sync', (isSynced: boolean) => {
                const latestDbContent = databaseContentRef.current;
                if (isSynced && latestDbContent) {
                    const states = provider.awareness.getStates();
                    // Filter out the current user's own active/stale connections
                    const otherCollaborators = Array.from(states.values()).filter(
                        (s: any) => s.user && s.user.uid !== user?.uid
                    );
                    
                    // Destroy any existing binding to prevent duplicates
                    if (binding) {
                        binding.destroy();
                    }
                    
                    // Instantiate QuillBinding ONLY after successful sync!
                    // This preserves the defaultValue locally even if connection is slow or offline.
                    binding = new QuillBinding(ytext, editor, provider.awareness);
                    
                    // If ytext is empty, OR if there are no OTHER distinct collaborators editing,
                    // ALWAYS initialize the editor and Yjs text with the latest database content!
                    if (ytext.toString().trim() === "" || otherCollaborators.length === 0) {
                        editor.setContents([]);
                        editor.clipboard.dangerouslyPasteHTML(0, latestDbContent, "user");
                    }
                }
            });
        }

        return () => {
            binding?.destroy();
            provider.disconnect();
            ydoc.destroy();
        };
    }, [id, loading]);

    // Handle Selection for AI Bar
    useEffect(() => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();

        const handleSelection = (range: any) => {
            if (range) {
                // If it's a real selection (length > 0), always save it!
                // If it's just a cursor position (length === 0), only save it if the editor actually has focus.
                // This prevents losing the text selection when the editor blurs or when clicking toolbar items!
                const hasFocus = editor.hasFocus();
                if (range.length > 0 || hasFocus) {
                    lastSelectionRange.current = range;
                }
            }
            if (range && range.length > 0) {
                const text = editor.getText(range.index, range.length);
                setSelectedText(text);
                setSelectionRange(range);

                // Get bounds of the selection
                const bounds = editor.getBounds(range.index, range.length);
                const editorElement = editor.root;
                const editorRect = editorElement.getBoundingClientRect();

                // Position relative to viewport
                const rect = {
                    top: editorRect.top + bounds.top - 50, // 50px offset above
                    left: editorRect.left + bounds.left,
                    width: bounds.width,
                    bottom: editorRect.top + bounds.bottom,
                    right: editorRect.left + bounds.right
                } as DOMRect;

                setSelectionRect(rect);
                setShowAIBar(true);
            } else {
                setShowAIBar(false);
            }
        };

        editor.on('selection-change', handleSelection);
        return () => editor.off('selection-change', handleSelection);
    }, [loading]);

    // Toolbar etkileşiminde mevcut seçimi kaydet (focus kaybında geri yüklemek için)
    useEffect(() => {
        if (loading) return;
        if (!quillRef.current) return;

        const editor = quillRef.current.getEditor();
        const toolbar = document.getElementById('report-editor-toolbar');
        
        const colorPicker = document.querySelector('.ql-picker.ql-color');
        if (colorPicker) {
            colorPicker.setAttribute('title', 'Yazı Rengi');
        }
        const bgPicker = document.querySelector('.ql-picker.ql-background');
        if (bgPicker) {
            bgPicker.setAttribute('title', 'Asetatlı Kalem (Fosforlu Vurgu)');
        }

        const handleToolbarMouseDown = (event: MouseEvent) => {
            if (!toolbar) return;
            const target = event.target as HTMLElement | null;
            if (!target) return;

            const isToolbarControl = !!target.closest('button, select, .ql-picker-label, .ql-picker-item');
            if (!isToolbarControl) return;

            const currentSelection = editor.getSelection();
            if (currentSelection) {
                lastSelectionRange.current = currentSelection;
            }
        };

        toolbar?.addEventListener('mousedown', handleToolbarMouseDown, true);

        return () => {
            toolbar?.removeEventListener('mousedown', handleToolbarMouseDown, true);
        };
    }, [loading]);

    const handleAIProcess = async (type: "improve" | "formalize" | "shorten") => {
        if (!selectedText || !selectionRange) return;
        
        const prompts = {
            improve: "Bu metni gramer açısından düzelt ve daha akıcı hale getir:",
            formalize: "Bu metni bir GSB müfettişi raporu ciddiyetinde, daha resmi ve profesyonel bir dille yeniden yaz:",
            shorten: "Bu metnin anlamını koruyarak daha öz ve kısa hale getir:"
        };

        try {
            setProcessingAI(true);
            const aiUrl = `${API_URL}/ai/chat`;
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const response = await fetchWithTimeout(aiUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ 
                    message: `${prompts[type]}\n\n"${selectedText}"`,
                    context: "report_editing"
                })
            });
            
            const data = await response.json();
            if (data.response) {
                const editor = quillRef.current.getEditor();
                // Clean response from AI (remove quotes if any)
                let cleanText = data.response.trim();
                if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
                    cleanText = cleanText.substring(1, cleanText.length - 1);
                }
                
                editor.deleteText(selectionRange.index, selectionRange.length);
                editor.insertText(selectionRange.index, cleanText);
                setShowAIBar(false);
                toast.success("AI değişikliği uygulandı.");
            }
        } catch (error) {
            toast.error("AI işlemi başarısız oldu.");
        } finally {
            setProcessingAI(false);
        }
    };

    const handleAIGenerateReport = async () => {
        if (!id) return;
        try {
            setAiGenerating(true);
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const response = await fetchWithTimeout(`${API_URL}/ai/generate-report`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    audit_id: id,
                    instructions: aiInstructions,
                    section: aiSection,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || "AI rapor üretimi başarısız.");
            }
            
            let html = data.html || "";
            // Gemini bazen ```html ... ``` ile sarar, temizle
            html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();

            if (html && quillRef.current) {
                const editor = quillRef.current.getEditor();
                if (aiInsertMode === "replace") {
                    // Tüm içeriği değiştir
                    editor.clipboard.dangerouslyPasteHTML(html);
                } else {
                    // Mevcut içeriğin sonuna ekle
                    const len = editor.getLength();
                    editor.clipboard.dangerouslyPasteHTML(len - 1, html);
                }
                toast.success("AI rapor içeriği editöre eklendi!");
                setIsAIPanelOpen(false);
                setAiInstructions("");
            }
        } catch (err: any) {
            toast.error(err?.message || "AI rapor üretimi başarısız.");
        } finally {
            setAiGenerating(false);
        }
    };

    const loadAudit = async (auditId: string) => {
        try {
            setLoading(true);
            const data = await fetchAuditById(auditId);
            setAudit(data);
            if (data.doc_header !== undefined) setDocHeader(data.doc_header || "T.C. GENÇLİK VE SPOR BAKANLIĞI");
            if (data.doc_footer !== undefined) setDocFooter(data.doc_footer || "Müfettişlik Raporu");
            if (data.show_page_numbers !== undefined) setShowPageNumbers(data.show_page_numbers ?? true);
            databaseContentRef.current = data.report_content || "<h1></h1>";
            setContent(data.report_content || "<h1></h1>");
        } catch (error) {
            console.error("Denetim yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!id) return;
        try {
            setSaving(true);
            
            // Get the absolute latest HTML content directly from the Quill editor instance!
            let latestContent = "";
            if (quillRef.current) {
                latestContent = quillRef.current.getEditor().root.innerHTML;
            } else {
                latestContent = content;
            }

            // PASS TRUE AS THIRD PARAMETER TO FORCE VERSION CREATION ON Firestore!
            await updateAudit(id, { 
                report_content: latestContent,
                doc_header: docHeader,
                doc_footer: docFooter,
                show_page_numbers: showPageNumbers
            }, true);
            
            // Sync local React state
            setContent(latestContent);
            setAutoSaveStatus("saved");

            if (user?.uid) {
                refreshAudits(user.uid, user?.email || undefined);
            }
            setLastSaved(new Date());
            loadVersions(id);
            toast.success("Rapor başarıyla kaydedildi ve yeni sürüm oluşturuldu.");
        } catch (error) {
            toast.error("Kaydedilirken hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    const handleRestoreVersion = async (versionId: string) => {
        if (!id) return;
        const confirmed = await confirm({
            title: "Sürüme Geri Dön",
            message: "Bu sürüme geri dönmek istediğinize emin misiniz? Mevcut değişiklikleriniz kaybolabilir.",
            confirmText: "Geri Dön",
            variant: "warning"
        });
        if (!confirmed) return;
        
        const toastId = toast.loading("Sürüm geri yükleniyor...");
        try {
            // 1. Önce kullanıcının mevcut taslağını kayıpsızca yedekle! (Force create version = true)
            if (quillRef.current) {
                const editor = quillRef.current.getEditor();
                const currentHTML = editor.root.innerHTML;
                const isEmpty = currentHTML.trim() === "" || currentHTML === "<h1></h1>" || currentHTML === "<p><br></p>";
                
                if (!isEmpty) {
                    try {
                        // Force save current draft as a backup version
                        await updateAudit(id, { report_content: currentHTML }, true);
                    } catch (e) {
                        console.error("Mevcut taslak yedeklenirken hata oluştu", e);
                    }
                }
            }

            const restoredAudit = await restoreAuditVersion(id, versionId);
            let restoredContent = restoredAudit.report_content || "";
            
            // Eğer eski sürüm Delta (JSON) formatında kalmışsa, doğrudan setContent ile çözemeyiz.
            // ReactQuill HTML bekler. Ancak Delta ops array ise, Quill setContents ile yükleyebiliriz.
            if (quillRef.current) {
                const editor = quillRef.current.getEditor();
                
                if (restoredContent.trim().startsWith('{"ops":')) {
                    try {
                        const delta = JSON.parse(restoredContent);
                        editor.setContents(delta, "user");
                        restoredContent = editor.root.innerHTML; // Update local state string to HTML representation
                    } catch (e) {
                        editor.clipboard.dangerouslyPasteHTML(0, restoredContent, "user");
                    }
                } else {
                    editor.setContents([]);
                    editor.clipboard.dangerouslyPasteHTML(0, restoredContent, "user");
                }
                
                // Yerel React state'i güncelle
                setContent(restoredContent);
            }
            
            toast.success("Rapor sürümü başarıyla geri yüklendi!", { id: toastId });
            loadVersions(id); // Sürüm listesini yenile ki son yedeklenen sürüm de listede görünsün!
            setIsHistoryOpen(false); // Sürüm geçmişi çekmecesini kapat
        } catch (error) {
            console.error(error);
            toast.error("Sürüm yükleme başarısız", { id: toastId });
        }
    };

    const handleDeleteVersion = async (e: React.MouseEvent, versionId: string, versionName: string) => {
        // Prevent event from bubbling up to trigger version restore
        e.stopPropagation();
        
        if (!id) return;
        const confirmed = await confirm({
            title: "Sürümü Sil",
            message: `"${versionName}" sürümünü kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        
        const toastId = toast.loading("Sürüm siliniyor...");
        try {
            await deleteAuditVersion(id, versionId);
            toast.success("Sürüm başarıyla silindi!", { id: toastId });
            loadVersions(id);
        } catch (error) {
            console.error(error);
            toast.error("Sürüm silinemedi", { id: toastId });
        }
    };

    const handleBulkDeleteVersions = async () => {
        if (!id || selectedVersionIds.size === 0) return;
        const count = selectedVersionIds.size;
        const confirmed = await confirm({
            title: "Seçilen Sürümleri Sil",
            message: `${count} sürümü kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        const toastId = toast.loading(`${count} sürüm siliniyor...`);
        try {
            await Promise.all([...selectedVersionIds].map(vId => deleteAuditVersion(id, vId)));
            toast.success(`${count} sürüm başarıyla silindi!`, { id: toastId });
            setSelectedVersionIds(new Set());
            setSelectionMode(false);
            loadVersions(id);
        } catch (error) {
            toast.error("Bazı sürümler silinemedi.", { id: toastId });
        }
    };

    const handleDeleteAllVersions = async () => {
        if (!id || versions.length === 0) return;
        const confirmed = await confirm({
            title: "Tüm Sürümleri Sil",
            message: `${versions.length} sürümün tamamını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Tümünü Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        const toastId = toast.loading("Tüm sürümler siliniyor...");
        try {
            await Promise.all(versions.map(v => deleteAuditVersion(id, v.id)));
            toast.success("Tüm sürümler başarıyla silindi!", { id: toastId });
            setSelectedVersionIds(new Set());
            setSelectionMode(false);
            loadVersions(id);
        } catch (error) {
            toast.error("Bazı sürümler silinemedi.", { id: toastId });
        }
    };

    const handleExportWord = async () => {
        if (!id) return;
        if (!isElectron) {
            toast.error("Rapor indirme ve dışa aktarma işlemleri güvenlik kuralları gereği sadece masaüstü uygulamasında aktiftir.");
            return;
        }
        await handleSave();
        exportAuditToWord(id);
    };

    const handleShareUpdate = async (newSharedWith: string[]) => {
        if (!id) return;
        try {
            const updated = await updateAudit(id, { shared_with: newSharedWith });
            setAudit(updated);
            toast.success("Paylaşım ayarları güncellendi.");
        } catch (error) {
            toast.error("Paylaşım güncellenemedi.");
        }
    };

    const memoizedToolbar = useMemo(() => {
        return (
            <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-2 shrink-0">
                <div id="report-editor-toolbar" className="ql-toolbar ql-snow rounded-xl border border-slate-200 bg-white flex flex-wrap items-center gap-y-2 gap-x-0.5 px-2 py-1.5">
                        {/* ── FONT ── */}
                        <span className="ql-formats">
                            <select className="ql-font" defaultValue="times-new-roman">
                                <option value="times-new-roman">Times New Roman</option>
                                <option value="arial">Arial</option>
                                <option value="calibri">Calibri</option>
                                <option value="sans-serif">Sans Serif</option>
                                <option value="serif">Serif</option>
                                <option value="courier-new">Courier New</option>
                                <option value="monospace">Monospace</option>
                            </select>
                            <select className="ql-size" defaultValue="12pt">
                                <option value="8pt">8</option>
                                <option value="9pt">9</option>
                                <option value="10pt">10</option>
                                <option value="10.5pt">10.5</option>
                                <option value="11pt">11</option>
                                <option value="12pt">12</option>
                                <option value="14pt">14</option>
                                <option value="16pt">16</option>
                                <option value="18pt">18</option>
                                <option value="20pt">20</option>
                                <option value="22pt">22</option>
                                <option value="24pt">24</option>
                                <option value="26pt">26</option>
                                <option value="28pt">28</option>
                                <option value="36pt">36</option>
                                <option value="48pt">48</option>
                                <option value="72pt">72</option>
                            </select>
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── HEADER ── */}
                        <span className="ql-formats">
                            <select className="ql-header" defaultValue="">
                                <option value="1">Başlık 1</option>
                                <option value="2">Başlık 2</option>
                                <option value="3">Başlık 3</option>
                                <option value="">Normal</option>
                            </select>
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── FORMAT ── */}
                        <span className="ql-formats">
                            <button type="button" className="ql-bold" title="Kalın (Ctrl+B)" />
                            <button type="button" className="ql-italic" title="İtalik (Ctrl+I)" />
                            <button type="button" className="ql-underline" title="Altı Çizili (Ctrl+U)" />
                            <button type="button" className="ql-strike" title="Üstü Çizili" />
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── COLOR ── */}
                        <span className="ql-formats">
                            <select className="ql-color" title="Yazı Rengi" defaultValue="">
                                <option value="#000000">Siyah</option>
                                <option value="#ff0000">Kırmızı</option>
                                <option value="#800000">Koyu Kırmızı</option>
                                <option value="#0000ff">Mavi</option>
                                <option value="#000080">Koyu Mavi</option>
                                <option value="#008000">Yeşil</option>
                                <option value="#800080">Mor</option>
                                <option value="#808000">Zeytin Yeşili</option>
                                <option value="#808080">Gri</option>
                                <option value="#ffffff">Beyaz</option>
                            </select>
                            <select className="ql-background" title="Metin Vurgu Rengi (Asetatlı Kalem)" defaultValue="">
                                <option value="#ffff00">Sarı</option>
                                <option value="#00ff00">Parlak Yeşil</option>
                                <option value="#00ffff">Turkuaz</option>
                                <option value="#ff00ff">Pembe</option>
                                <option value="#ff0000">Kırmızı</option>
                                <option value="#0000ff">Mavi</option>
                                <option value="#000080">Koyu Mavi</option>
                                <option value="#008080">Firuze</option>
                                <option value="#008000">Koyu Yeşil</option>
                                <option value="#800080">Mor</option>
                                <option value="#800000">Bordo</option>
                                <option value="#808000">Koyu Sarı</option>
                                <option value="#808080">Koyu Gri</option>
                                <option value="#c0c0c0">Açık Gri</option>
                                <option value="">Renk Yok</option>
                            </select>
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <span className="ql-formats">
                            <button type="button" title="BÜYÜK HARF" className="!text-[10px] !font-black !w-auto !px-1.5" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCaseConvert("upper")}>AA</button>
                            <button type="button" title="küçük harf" className="!text-[10px] !font-black !w-auto !px-1.5" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCaseConvert("lower")}>aa</button>
                            <button type="button" title="Her Kelimenin Başı Büyük" className="!text-[10px] !font-black !w-auto !px-1.5" onMouseDown={(e) => e.preventDefault()} onClick={() => handleCaseConvert("title")}>Aa</button>
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── ALIGNMENT ── */}
                        <span className="ql-formats">
                            <button type="button" className="ql-align" value="" title="Sola Hizala" />
                            <button type="button" className="ql-align" value="center" title="Ortala" />
                            <button type="button" className="ql-align" value="right" title="Sağa Hizala" />
                            <button type="button" className="ql-align" value="justify" title="İki Yana Yasla" />
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── LIST / INDENT ── */}
                        <span className="ql-formats">
                            <button type="button" className="ql-list" value="bullet" title="Madde İşareti" />
                            <button type="button" className="ql-list" value="ordered" title="Numaralı Liste" />
                            <button type="button" className="ql-indent" value="-1" title="Girintiyi Azalt" />
                            <button type="button" className="ql-indent" value="+1" title="Girintiyi Artır" />
                        </span>

                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── SUB/SUPER ── */}
                        <span className="ql-formats">
                            <button type="button" className="ql-script" value="sub" title="Alt Simge" />
                            <button type="button" className="ql-script" value="super" title="Üst Simge" />
                        </span>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        {/* ── INSERT ── */}
                        <span className="ql-formats">
                            <button type="button" className="ql-blockquote" title="Alıntı" />
                            <button type="button" className="ql-link" title="Bağlantı" />
                            <button type="button" title="Tablo Ekle veya Tabloyu Yönet" className="!w-auto !px-2 flex items-center justify-center gap-1 hover:text-violet-600 transition-colors" onMouseDown={(e) => e.preventDefault()} onClick={handleInsertTable}>
                                <span className="text-[11px]">📊</span>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Tablo</span>
                            </button>
                            <button type="button" title="Sayfa Sonu" className="!text-[10px] !font-black !w-auto !px-1.5" onMouseDown={(e) => e.preventDefault()} onClick={handlePageBreak}>⏎</button>
                            <button type="button" className="ql-clean" title="Biçimlendirmeyi Temizle" />
                        </span>
                </div>
            </div>
        );
    }, []);

    const memoizedEditor = useMemo(() => {
        return (
            <ReactQuill 
                ref={quillRef}
                theme="snow"
                defaultValue={content}
                onChange={(val) => { setContent(val); }}
                placeholder="Raporunuzu buraya yazın..."
                modules={{
                    ...editorModules,
                    cursors: true
                }}
                formats={editorFormats}
                className={`h-full border-none ${pageMode ? 'editor-page-mode' : ''}`}
            />
        );
    }, [pageMode, loading]);

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
            {/* Toolbar */}
            <div className="bg-white border-b border-border px-3 md:px-6 py-2 flex flex-wrap items-center gap-2 md:gap-4 shadow-sm shrink-0 z-50">
                <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 flex-wrap">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                            if (quillRef.current && id) {
                                const editor = quillRef.current.getEditor();
                                const currentHTML = editor.root.innerHTML;
                                try {
                                    await updateAudit(id, { 
                                        report_content: currentHTML,
                                        doc_header: docHeader,
                                        doc_footer: docFooter,
                                        show_page_numbers: showPageNumbers
                                    });
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
                            <span className="flex items-center gap-1"><FileText size={10} /> Rapor Düzenleyici</span>
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
                                    <div
                                        key={i}
                                        title={u.name}
                                        className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white shadow-sm"
                                        style={{ backgroundColor: u.color }}
                                    >
                                        {u.name.substring(0, 2).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto max-w-full">
                            <Button variant="ghost" onClick={() => setIsShareModalOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all">
                                <Users size={14} className="mr-1.5" /> <span className="hidden xl:inline">Paylaşım</span>
                            </Button>
                            <Button variant="ghost" onClick={() => setIsHistoryOpen(true)} className="h-8 px-3 text-[11px] font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all">
                                <History size={14} className="mr-1.5" /> <span className="hidden xl:inline">Sürümler</span>
                            </Button>
                            <Button variant="ghost" onClick={() => openChat(`audit_${id}`, audit?.title || "Denetim Raporu", "audit")} className="h-8 px-3 text-[11px] font-bold text-primary rounded-lg hover:bg-white hover:shadow-sm transition-all">
                                <MessageSquare size={14} className="mr-1.5" /> <span className="hidden xl:inline">Sohbet</span>
                            </Button>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                            <Button
                                variant="ghost"
                                disabled={!AI_REPORT_ASSISTANT_ENABLED}
                                title={AI_REPORT_ASSISTANT_ENABLED ? "AI Rapor Asistanını Aç" : "Yakında"}
                                onClick={() => AI_REPORT_ASSISTANT_ENABLED && setIsAIPanelOpen(true)}
                                className={`h-8 px-2 md:px-3 text-[11px] font-black rounded-lg ${
                                    AI_REPORT_ASSISTANT_ENABLED 
                                        ? "text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200"
                                        : "text-slate-500 bg-slate-100 hover:bg-slate-100 disabled:opacity-100 disabled:cursor-not-allowed"
                                }`}
                            >
                                <Wand2 size={14} className="md:mr-1.5" /> <span className="hidden md:inline">{AI_REPORT_ASSISTANT_ENABLED ? "AI Asistanı" : "AI Asistanı (Yakında)"}</span>
                            </Button>
                            <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)} className="h-8 px-2 md:px-3 text-[11px] font-bold border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg">
                                <LayoutGrid size={14} className="md:mr-1.5" /> <span className="hidden md:inline">Şablon Seç</span>
                            </Button>
                            <Button variant="outline" onClick={handleSave} disabled={saving} className="h-8 px-2 md:px-3 text-[11px] font-bold border-primary/20 rounded-lg">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="md:mr-1.5" />} <span className="hidden md:inline">Kaydet</span>
                            </Button>
                            <Button onClick={handleExportWord} className="h-8 px-2 md:px-3 text-[11px] font-black bg-slate-900 text-white rounded-lg shadow-sm">
                                <Download size={14} className="md:mr-1.5" /> <span className="hidden md:inline">Word</span>
                            </Button>
                            <Button variant="outline" onClick={handlePrintPreview} className="h-8 px-2 md:px-3 text-[11px] font-bold rounded-lg border-slate-300">
                                <span className="mr-0 md:mr-1.5">🖨️</span> <span className="hidden md:inline">Önizleme</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {memoizedToolbar}


            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-2 md:p-12 flex justify-center gap-6">
                <div className="w-full max-w-[850px]">
                    <div className="mb-3 flex items-center justify-between px-2">
                        <div className="text-xs font-semibold text-slate-500">
                            {wordCount.toLocaleString("tr-TR")} kelime • {charCount.toLocaleString("tr-TR")} karakter • Tahmini {estimatedPages} sayfa
                        </div>
                        <button type="button" onClick={() => setShowRuler((v) => !v)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                            {showRuler ? "Cetveli Gizle" : "Cetveli Göster"}
                        </button>
                    </div>
                        {/* Floating AI Bar (Positioned outside zoomed Card for perfect viewport coordinates in Electron & Web) */}
                        {AI_REPORT_ASSISTANT_ENABLED && showAIBar && selectionRect && (
                            <div 
                                onMouseDown={(e) => e.preventDefault()}
                                className="fixed z-[1000] flex items-center gap-1 bg-[#1e293b] text-white p-1.5 rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 fade-in duration-200 select-none"
                                style={{ 
                                    top: `${selectionRect.top}px`, 
                                    left: `${Math.max(20, selectionRect.left + (selectionRect.width / 2) - 150)}px` 
                                }}
                            >
                                <div className="px-3 py-1.5 border-r border-white/10 flex items-center gap-2">
                                    <Sparkles size={14} className="text-blue-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">AI Asistan</span>
                                </div>
                                <button 
                                    disabled={processingAI}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleAIProcess("improve")}
                                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                >
                                    GELIŞTIR
                                </button>
                                <button 
                                    disabled={processingAI}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleAIProcess("formalize")}
                                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                >
                                    RESMILEŞTIR
                                </button>
                                <button 
                                    disabled={processingAI}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleAIProcess("shorten")}
                                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                >
                                    KISALT
                                </button>
                                {processingAI && (
                                    <div className="px-3 py-1.5">
                                        <Loader2 size={12} className="animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}

                    <Card onClick={focusEditorToEnd} style={{ zoom: `${zoom}%` }} className="p-4 md:p-16 min-h-[1100px] bg-white shadow-2xl border-none rounded-none prose max-w-none relative mb-20 overflow-visible cursor-text">
                        {/* Word A4 Impression */}
                        <div className="absolute -top-1 left-0 w-full h-1 bg-primary/10" />
                        <div className="mb-4 pb-2 border border-dashed border-slate-200 hover:border-violet-300 hover:bg-slate-50/50 rounded-lg p-2 transition-all group relative">
                            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">✍️ RAPOR ÜST BİLGİSİ (ÇIFT TIKLA DÜZENLE)</span>
                            <input
                                value={docHeader}
                                onChange={(e) => setDocHeader(e.target.value)}
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

                        {memoizedEditor}
                        <div className="mt-8 pt-2 border border-dashed border-slate-200 hover:border-violet-300 hover:bg-slate-50/50 rounded-lg p-2.5 transition-all group relative flex items-center justify-between">
                            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">✍️ RAPOR ALT BİLGİSİ (ÇIFT TIKLA DÜZENLE)</span>
                            <input
                                value={docFooter}
                                onChange={(e) => setDocFooter(e.target.value)}
                                className="w-[50%] text-xs font-semibold text-slate-500 bg-transparent outline-none cursor-pointer focus:cursor-text"
                                placeholder="Rapor Alt Bilgisi Eklemek İçin Buraya Tıklayın..."
                            />
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showPageNumbers}
                                        onChange={(e) => setShowPageNumbers(e.target.checked)}
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

            {/* Share Modal */}
            <ShareModal 
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                sharedWith={audit?.shared_with || []}
                onShare={handleShareUpdate}
                title={`"${audit?.title}" Rapor Paylaşımı`}
            />

            <style>{`
                /* ── Selection Fix for Electron/Desktop ── */
                .ql-container, .ql-editor, .ql-editor * {
                    -webkit-user-select: text !important;
                    user-select: text !important;
                }

                /* ── Toolbar Selection Fix for Electron/Desktop (Prevents Selection Loss on Click) ── */
                #report-editor-toolbar, #report-editor-toolbar *, .ql-toolbar, .ql-toolbar * {
                    -webkit-user-select: none !important;
                    user-select: none !important;
                }

                /* ── Custom Highlighter Pen (Asetatlı Kalem) Icon ── */
                .ql-snow .ql-picker.ql-background .ql-picker-label svg {
                    display: none !important;
                }
                .ql-snow .ql-picker.ql-background .ql-picker-label::before {
                    content: "🖍️" !important;
                    font-size: 14px !important;
                    display: inline-block !important;
                    line-height: 1 !important;
                    vertical-align: middle !important;
                }
                .ql-snow .ql-picker.ql-background .ql-picker-label {
                    padding-left: 6px !important;
                    padding-right: 6px !important;
                    background: none !important;
                    background-image: none !important;
                }

                /* ── Base Container ── */
                .ql-container.ql-snow { border: none !important; font-family: 'Times New Roman', Times, serif !important; font-size: 12pt !important; }
                .ql-toolbar.ql-snow { border: 1px solid #e2e8f0 !important; background: #fff !important; position: static !important; margin-bottom: 0; border-radius: 12px; box-shadow: 0 1px 3px -1px rgb(0 0 0 / 0.08); }

                /* ── Font Family Labels (Toolbar Dropdowns) ── */
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="times-new-roman"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="times-new-roman"]::before { content: "Times New Roman"; font-family: 'Times New Roman', Times, serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="arial"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="arial"]::before { content: "Arial"; font-family: Arial, Helvetica, sans-serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="calibri"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="calibri"]::before { content: "Calibri"; font-family: Calibri, 'Segoe UI', sans-serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="sans-serif"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="sans-serif"]::before { content: "Sans Serif"; font-family: Arial, Helvetica, sans-serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="serif"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="serif"]::before { content: "Serif"; font-family: Georgia, 'Times New Roman', serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="courier-new"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="courier-new"]::before { content: "Courier New"; font-family: 'Courier New', Courier, monospace; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="monospace"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="monospace"]::before { content: "Monospace"; font-family: 'Courier New', monospace; }

                /* ── Font Family Applied in Editor ── */
                .ql-font-times-new-roman { font-family: 'Times New Roman', Times, serif !important; }
                .ql-font-arial { font-family: Arial, Helvetica, sans-serif !important; }
                .ql-font-calibri { font-family: Calibri, 'Segoe UI', sans-serif !important; }
                .ql-font-sans-serif { font-family: Arial, Helvetica, sans-serif !important; }
                .ql-font-serif { font-family: Georgia, 'Times New Roman', serif !important; }
                .ql-font-courier-new { font-family: 'Courier New', Courier, monospace !important; }
                .ql-font-monospace { font-family: 'Courier New', monospace !important; }

                /* ── Font Size Dropdown Labels ── */
                .ql-snow .ql-picker.ql-size .ql-picker-label::before,
                .ql-snow .ql-picker.ql-size .ql-picker-item::before { content: attr(data-value) !important; }
                .ql-snow .ql-picker.ql-size { width: 55px !important; }
                .ql-snow .ql-picker.ql-font { width: 160px !important; }

                /* ── Editor Area (A4 Page Style) ── */
                .ql-container { min-height: 1000px !important; }
                .ql-editor {
                    padding: 0 !important;
                    min-height: 980px !important;
                    line-height: 1.5;
                    color: #000;
                    font-size: 12pt;
                    font-family: 'Times New Roman', Times, serif;
                    tab-size: 4;
                    -moz-tab-size: 4;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .ql-editor h1 { font-size: 18pt; font-weight: 700; margin-bottom: 12pt !important; color: #000; }
                .ql-editor h2 { font-size: 14pt; font-weight: 700; margin-bottom: 6pt !important; color: #000; }
                .ql-editor h3 { font-size: 12pt; font-weight: 700; margin-bottom: 6pt !important; color: #000; }
                .ql-editor p { margin-bottom: 6pt !important; }
                .ql-editor ol, .ql-editor ul { padding-left: 1.5em !important; }
                .ql-editor.ql-blank::before { left: 0 !important; font-style: italic !important; color: #999 !important; font-family: 'Times New Roman', Times, serif !important; }
                
                /* ── Page Mode (A4 page break lines) ── */
                .editor-page-mode .ql-editor {
                    background-image: linear-gradient(to bottom, transparent 0, transparent 1118px, #cbd5e1 1118px, #cbd5e1 1120px);
                    background-size: 100% 1120px;
                    background-repeat: repeat-y;
                }

                /* ── Line Spacing Dropdown ── */
                .custom-lineheight {
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 6px !important;
                    padding: 2px 6px !important;
                    height: 24px !important;
                    background: #ffffff !important;
                    cursor: pointer !important;
                    outline: none !important;
                    transition: all 0.15s ease !important;
                    vertical-align: middle !important;
                }
                .custom-lineheight:hover {
                    border-color: #94a3b8 !important;
                    background: #f8fafc !important;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
                }
                .ql-snow .ql-picker.custom-lineheight {
                    width: 75px !important;
                    height: 24px !important;
                    line-height: 20px !important;
                }
                .ql-snow .ql-picker.custom-lineheight .ql-picker-label {
                    padding: 0 4px !important;
                    border: none !important;
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                }
                .ql-snow .ql-picker.custom-lineheight .ql-picker-label::before,
                .ql-snow .ql-picker.custom-lineheight .ql-picker-item::before {
                    content: attr(data-label) !important;
                    font-size: 11px !important;
                }
                .ql-snow .ql-picker.custom-lineheight .ql-picker-options {
                    min-width: 75px !important;
                }

                /* ── Page Break Styling ── */
                .page-break-divider {
                    border: none !important;
                    border-bottom: 2px dashed #94a3b8 !important;
                    height: 24px !important;
                    position: relative !important;
                    margin: 24px 0 !important;
                    text-align: center !important;
                    cursor: default !important;
                    user-select: none !important;
                }
                .page-break-text {
                    position: absolute !important;
                    top: 12px !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    background: #ffffff !important;
                    padding: 2px 10px !important;
                    font-size: 8pt !important;
                    font-weight: 800 !important;
                    color: #64748b !important;
                    border: 1px dashed #cbd5e1 !important;
                    border-radius: 4px !important;
                    letter-spacing: 0.1em !important;
                }
                @media print {
                    .page-break-divider {
                        page-break-after: always !important;
                        break-after: page !important;
                        border: none !important;
                        height: 0 !important;
                        margin: 0 !important;
                    }
                    .page-break-text {
                        display: none !important;
                    }
                }
            `}</style>
            {/* AI Rapor Üretme Paneli */}
            {isAIPanelOpen && (
                <div className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-white shadow-2xl z-[100] border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
                    <div className="p-5 border-b border-violet-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
                        <h3 className="font-bold flex items-center gap-2 text-violet-800">
                            <Wand2 size={18} className="text-violet-600"/> AI Rapor Asistanı
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setIsAIPanelOpen(false)} className="rounded-full w-8 h-8 p-0 hover:bg-violet-100">
                            <X size={16} />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                        {/* Denetim Bilgisi */}
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Denetim</div>
                            <p className="font-bold text-sm text-slate-800">{audit?.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{audit?.location} — {audit?.date}</p>
                        </div>

                        {/* Bölüm Seçimi */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 mb-2 block">Ne oluşturayım?</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "tamamini", label: "Tam Rapor", icon: "📋" },
                                    { value: "giris", label: "Giriş", icon: "📖" },
                                    { value: "tespitler", label: "Tespitler", icon: "🔍" },
                                    { value: "tenkit", label: "Tenkit Maddeleri", icon: "⚖️" },
                                    { value: "sonuc", label: "Sonuç & Öneriler", icon: "✅" },
                                ].map((s) => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => setAiSection(s.value)}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            aiSection === s.value
                                                ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                        } ${s.value === "tamamini" ? "col-span-2" : ""}`}
                                    >
                                        <span className="text-lg">{s.icon}</span>
                                        <span className="block text-xs font-bold mt-1 text-slate-700">{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Talimatlar */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 mb-2 block">Ek talimatlar (opsiyonel)</label>
                            <textarea
                                value={aiInstructions}
                                onChange={(e) => setAiInstructions(e.target.value)}
                                placeholder="Örn: Asansör eksikliğine özellikle değin, yangın söndürücü tespitlerini ekle..."
                                rows={4}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none"
                            />
                        </div>

                        {/* Ekleme Modu */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 mb-2 block">İçerik nasıl eklensin?</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAiInsertMode("append")}
                                    className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        aiInsertMode === "append"
                                            ? "border-violet-400 bg-violet-50 text-violet-700"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                    }`}
                                >
                                    Mevcut içeriğin sonuna ekle
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAiInsertMode("replace")}
                                    className={`flex-1 p-3 rounded-xl border text-xs font-bold transition-all ${
                                        aiInsertMode === "replace"
                                            ? "border-red-400 bg-red-50 text-red-700"
                                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                    }`}
                                >
                                    Tümünü değiştir
                                </button>
                            </div>
                        </div>

                        {/* Bilgi notu */}
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
                            <BookOpen size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 leading-relaxed">
                                AI, mevzuat kütüphanesindeki tüm belgeleri ve tenkit bilgi bankasını okuyarak rapor oluşturur. 
                                Yasal dayanakları otomatik olarak referans gösterir.
                            </p>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <div className="p-5 border-t border-slate-200 bg-slate-50">
                        <Button
                            onClick={handleAIGenerateReport}
                            disabled={aiGenerating}
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-sm shadow-lg shadow-violet-200 disabled:opacity-50"
                        >
                            {aiGenerating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin mr-2" />
                                    AI rapor yazıyor...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} className="mr-2" />
                                    Rapor Oluştur
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* Sürüm Geçmişi Çekmecesi (Drawer) */}
            {isHistoryOpen && (
                <div className="fixed inset-y-0 right-0 w-full md:w-80 bg-white shadow-2xl z-[100] border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
                    <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50">
                        <h3 className="font-bold flex items-center gap-2"><History size={18} className="text-primary"/> Sürüm Geçmişi</h3>
                        <div className="flex items-center gap-1">
                            {selectionMode ? (
                                <>
                                    {selectedVersionIds.size > 0 && (
                                        <Button
                                            variant="ghost" size="sm"
                                            onClick={handleBulkDeleteVersions}
                                            className="h-7 px-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 size={12} className="mr-1" />
                                            {selectedVersionIds.size} Sil
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => { setSelectionMode(false); setSelectedVersionIds(new Set()); }}
                                        className="h-7 px-2 text-xs rounded-lg text-slate-500"
                                    >
                                        İptal
                                    </Button>
                                </>
                            ) : (
                                versions.length > 0 && (
                                    <Button
                                        variant="ghost" size="sm"
                                        onClick={() => setSelectionMode(true)}
                                        className="h-7 px-2 text-xs rounded-lg text-slate-500 hover:text-slate-800"
                                    >
                                        Seç
                                    </Button>
                                )
                            )}
                            <Button variant="ghost" size="sm" onClick={() => { setIsHistoryOpen(false); setSelectionMode(false); setSelectedVersionIds(new Set()); }} className="rounded-full w-8 h-8 p-0 ml-1">
                                <X size={16} />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        {versions.length === 0 ? (
                            <p className="text-center text-xs text-muted-foreground mt-10 italic">Henüz bir sürüm kaydı bulunmuyor.</p>
                        ) : (
                            versions.map((v, i) => {
                                const rawDateStr = v.created_at || "";
                                const formattedDateStr = (rawDateStr && !rawDateStr.includes('Z') && !rawDateStr.includes('+')) 
                                    ? `${rawDateStr}Z` 
                                    : rawDateStr;
                                const d = new Date(formattedDateStr);
                                const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                const timeStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                                const isSelected = selectedVersionIds.has(v.id);
                                return (
                                    <div
                                        key={v.id}
                                        onClick={() => {
                                            if (selectionMode) {
                                                setSelectedVersionIds(prev => {
                                                    const next = new Set(prev);
                                                    next.has(v.id) ? next.delete(v.id) : next.add(v.id);
                                                    return next;
                                                });
                                            }
                                        }}
                                        className={`p-4 rounded-xl border transition-all group
                                            ${selectionMode
                                                ? isSelected
                                                    ? 'bg-primary/10 border-primary/40 cursor-pointer'
                                                    : 'bg-white hover:border-slate-300 cursor-pointer'
                                                : i === 0
                                                    ? 'bg-primary/5 border-primary/20 cursor-pointer'
                                                    : 'bg-white hover:border-slate-300 cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {selectionMode && (
                                                    <span className="text-primary shrink-0">
                                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                                                    </span>
                                                )}
                                                <span className="font-bold text-sm text-primary">{v.version_name}</span>
                                                {!selectionMode && (
                                                    <Button 
                                                        variant="ghost" size="sm" 
                                                        onClick={(e) => handleDeleteVersion(e, v.id, v.version_name)}
                                                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Sürümü Sil"
                                                    >
                                                        <Trash2 size={13} />
                                                    </Button>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-full" title={`${dateStr} ${timeStr}`}>
                                                <Clock size={10} className="text-slate-400" /> {dateStr} - {timeStr}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-2">Kaydeden: <span className="font-semibold text-slate-700">{v.user}</span></p>
                                        {!selectionMode && (
                                            <Button 
                                                variant="outline" size="sm" 
                                                onClick={() => handleRestoreVersion(v.id)}
                                                className="w-full h-7 text-xs rounded-lg mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Bu Sürüme Dön
                                            </Button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {selectionMode && versions.length > 0 && (
                        <div className="p-3 border-t border-border flex items-center justify-between bg-slate-50 shrink-0">
                            <button
                                onClick={() => {
                                    if (selectedVersionIds.size === versions.length) {
                                        setSelectedVersionIds(new Set());
                                    } else {
                                        setSelectedVersionIds(new Set(versions.map(v => v.id)));
                                    }
                                }}
                                className="text-xs font-bold text-primary hover:underline"
                            >
                                {selectedVersionIds.size === versions.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                            </button>
                            <Button
                                variant="ghost" size="sm"
                                onClick={handleDeleteAllVersions}
                                className="h-7 px-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 size={12} className="mr-1" /> Tümünü Sil
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Şablon Seçim Modali */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <LayoutGrid className="text-violet-600" size={20} /> Resmi Rapor Taslakları & Şablonları
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Müfettişlik rehberi standartlarına uygun 2025 yılı resmi rapor kapak ve içerik taslakları.</p>
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
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-2">
                                            {catIcon} {cat} ({templates.length} Taslak)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {templates.map((template) => (
                                                <div 
                                                    key={template.id}
                                                    onClick={() => handleSelectTemplate(template)}
                                                    className="p-4 rounded-2xl border border-slate-200 hover:border-violet-300 bg-white hover:bg-violet-50/10 cursor-pointer group transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <h5 className="font-bold text-sm text-slate-800 group-hover:text-violet-700 transition-colors">
                                                            {template.name}
                                                        </h5>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                            T.C. Gençlik ve Spor Bakanlığı resmi formatında düzenlenmiş Word uyumlu taslak.
                                                        </p>
                                                    </div>
                                                    <div className="mt-4 flex items-center justify-end text-[10px] font-bold text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400">Toplam 14 resmi Word şablonu yüklü.</span>
                            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(false)} className="rounded-xl h-9 text-xs">
                                Kapat
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CUSTOM TABLE GENERATOR MODAL (Word Style & Electron Safe) ── */}
            {isTableModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                    📊 Word Tarzı Tablo Oluştur
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-1">Eklemek istediğiniz tablonun boyutlarını giriniz.</p>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsTableModalOpen(false)} 
                                className="rounded-full w-8 h-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center"
                            >
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1.5">Satır Sayısı</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={tableRows}
                                        onChange={(e) => setTableRows(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm font-bold text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1.5">Sütun Sayısı</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={tableCols}
                                        onChange={(e) => setTableCols(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-sm font-bold text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setIsTableModalOpen(false)} 
                                className="rounded-xl h-9 text-xs"
                            >
                                İptal
                            </Button>
                            <Button 
                                onClick={handleConfirmInsertTable} 
                                className="rounded-xl h-9 px-4 text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md shadow-violet-200"
                            >
                                Tabloyu Ekle
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONTEXTUAL TABLE EDIT WIZARD MODAL ── */}
            {isTableEditModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                    📊 Tablo Düzenleme Sihirbazı
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-1">İmlecinizin bulunduğu tablo üzerinde işlemler yapın.</p>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsTableEditModalOpen(false)} 
                                className="rounded-full w-8 h-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 flex items-center justify-center"
                            >
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        handleTableAction("insert-row");
                                        setIsTableEditModalOpen(false);
                                    }}
                                    className="h-12 px-4 rounded-2xl bg-slate-50 hover:bg-violet-50 border border-slate-200/60 hover:border-violet-200 text-xs font-black uppercase text-slate-600 hover:text-violet-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <span>➕</span> Satır Ekle
                                </button>
                                <button
                                    onClick={() => {
                                        handleTableAction("delete-row");
                                        setIsTableEditModalOpen(false);
                                    }}
                                    className="h-12 px-4 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-200/60 hover:border-red-200 text-xs font-black uppercase text-slate-600 hover:text-red-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <span>❌</span> Satır Sil
                                </button>
                                <button
                                    onClick={() => {
                                        handleTableAction("insert-col");
                                        setIsTableEditModalOpen(false);
                                    }}
                                    className="h-12 px-4 rounded-2xl bg-slate-50 hover:bg-violet-50 border border-slate-200/60 hover:border-violet-200 text-xs font-black uppercase text-slate-600 hover:text-violet-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <span>➕</span> Sütun Ekle
                                </button>
                                <button
                                    onClick={() => {
                                        handleTableAction("delete-col");
                                        setIsTableEditModalOpen(false);
                                    }}
                                    className="h-12 px-4 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-200/60 hover:border-red-200 text-xs font-black uppercase text-slate-600 hover:text-red-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <span>❌</span> Sütun Sil
                                </button>
                            </div>
                            
                            <div className="pt-2">
                                <button
                                    onClick={() => {
                                        handleTableAction("delete-table");
                                        setIsTableEditModalOpen(false);
                                    }}
                                    className="w-full h-12 rounded-2xl bg-red-50 hover:bg-red-600 border border-red-200/40 hover:border-red-600 text-xs font-black uppercase text-red-600 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm hover:shadow-md shadow-red-100"
                                >
                                    <span>🗑️</span> Tüm Tabloyu Kaldır
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                            <Button variant="outline" onClick={() => setIsTableEditModalOpen(false)} className="rounded-xl h-9 text-xs">
                                Kapat
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const editorModules = {
    toolbar: {
        container: '#report-editor-toolbar',
    },
    table: true, // Enable Quill's built-in table support
    keyboard: {
        bindings: {
            tab: {
                key: 9,
                handler: function(this: any) {
                    const quill = this.quill;
                    const range = quill.getSelection(true);
                    quill.insertText(range.index, '\t', 'user');
                    quill.setSelection(range.index + 1, 0, 'user');
                    return false;
                }
            }
        }
    }
};

const editorFormats = [
    'font', 'size',
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
    'color', 'background',
    'list', 'indent',
    'script',
    'link', 'image', 'align', 'pagebreak', 'lineheight',
    'table'
];
