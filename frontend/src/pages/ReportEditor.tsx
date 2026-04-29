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



Quill.register("modules/cursors", QuillCursors);
const FontAttributor = Quill.import("formats/font") as any;
FontAttributor.whitelist = ["sans-serif", "serif", "monospace", "times-new-roman"];
Quill.register(FontAttributor, true);
import { Save, Download, ArrowLeft, Loader2, FileText, CheckCircle, History, Clock, Users, Sparkles, MessageSquare, Wand2, BookOpen, X } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchAuditById, updateAudit, exportAuditToWord, fetchAuditVersions, restoreAuditVersion, type Audit, type AuditVersion } from "../lib/api/audit";
import ShareModal from "../components/ShareModal";
import { WS_URL, API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useChat } from "../lib/context/ChatContext";
import { useAuth } from "../lib/hooks/useAuth";


export default function ReportEditor() {
    const confirm = useConfirm();
    const { user } = useAuth();

    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [audit, setAudit] = useState<Audit | null>(null);
    const quillRef = useRef<any>(null);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [versions, setVersions] = useState<AuditVersion[]>([]);
    const [zoom, setZoom] = useState(100);
    const [showRuler, setShowRuler] = useState(true);
    const [showOutline, setShowOutline] = useState(true);
    const [pageMode, setPageMode] = useState(true);
    const [docHeader, setDocHeader] = useState("T.C. GENÇLİK VE SPOR BAKANLIĞI");
    const [docFooter, setDocFooter] = useState("Müfettişlik Raporu");

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

    const focusEditorToEnd = () => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        editor.focus();
        const len = editor.getLength();
        editor.setSelection(Math.max(0, len - 1), 0, 'user');
    };




    useEffect(() => {
        if (id) {
            loadAudit(id);
            loadVersions(id);
        }
    }, [id]);

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
            const key = (u?.name || '').trim().toLowerCase();
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
    const headings = useMemo(() => {
        const list: Array<{ level: number; text: string }> = [];
        const regex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            const level = Number(match[1]);
            const text = match[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
            if (text) list.push({ level, text });
        }
        return list;
    }, [content]);

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
            
            // Get user info from Firebase Auth
            const userName = user?.displayName
                || user?.email?.split('@')[0]
                || "Müfettiş";

            const cursorColor = '#' + Math.floor(Math.random()*16777215).toString(16);
            
            provider.awareness.setLocalStateField("user", {
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

            binding = new QuillBinding(ytext, editor, provider.awareness);
            
            provider.on('sync', (isSynced: boolean) => {
                if (isSynced && ytext.toString().trim() === "" && content) {
                     // Initial push from DB if document is empty
                     editor.clipboard.dangerouslyPasteHTML(content);
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

    const handleAIProcess = async (type: "improve" | "formalize" | "shorten") => {
        if (!selectedText || !selectionRange) return;
        
        const prompts = {
            improve: "Bu metni gramer açısından düzelt ve daha akıcı hale getir:",
            formalize: "Bu metni bir GSB müfettişi raporu ciddiyetinde, daha resmi ve profesyonel bir dille yeniden yaz:",
            shorten: "Bu metnin anlamını koruyarak daha öz ve kısa hale getir:"
        };

        try {
            setProcessingAI(true);
            const aiUrl = (WS_URL.startsWith('ws') ? WS_URL.replace('ws', 'http') : WS_URL).replace(/\/$/, '') + '/api/ai/chat';
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
            await updateAudit(id, { report_content: content });
            setLastSaved(new Date());
            loadVersions(id);
            toast.success("Rapor başarıyla kaydedildi.");
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
        
        try {
            setLoading(true);
            await restoreAuditVersion(id, versionId);
            toast.success("Rapor başarıyla geri yüklendi.");
            window.location.reload();
        } catch (error) {
            console.error(error);
            toast.error("Yükleme başarısız");
        } finally {
            setLoading(false);
        }
    };

    const handleExportWord = async () => {
        if (!id) return;
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

    const jumpToHeading = (headingText: string) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const text = editor.getText() || "";
        const idx = text.indexOf(headingText);
        if (idx >= 0) {
            editor.setSelection(idx, 0, "user");
            editor.focus();
        }
    };

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
            <div className="bg-white border-b border-border px-6 py-2 flex items-center justify-between shadow-sm shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-full w-8 h-8 p-0">
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
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold tracking-wide">
                            <FileText size={10} /> Rapor Düzenleyici
                            {lastSaved && (
                                <span className="flex items-center gap-1 text-success font-black">
                                    <CheckCircle size={10} /> {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2">
                        <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50">
                            <button type="button" onClick={() => setZoom((z) => Math.max(70, z - 10))} className="text-[10px] font-black text-slate-400 hover:text-slate-800 px-1">-</button>
                            <span className="text-[10px] font-black text-slate-600 min-w-[32px] text-center">{zoom}%</span>
                            <button type="button" onClick={() => setZoom((z) => Math.min(160, z + 10))} className="text-[10px] font-black text-slate-400 hover:text-slate-800 px-1">+</button>
                        </div>
                        <button type="button" onClick={() => setPageMode((v) => !v)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 border-l">{pageMode ? 'Sayfa' : 'Akış'}</button>
                        <button type="button" onClick={() => setShowOutline((v) => !v)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 border-l">{showOutline ? 'Anahat' : 'Tam'}</button>
                    </div>

                    <div className="flex items-center gap-2">
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
                        
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
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

                        <div className="flex items-center gap-1">
                            <Button variant="ghost" onClick={() => setIsAIPanelOpen(true)} className="h-8 px-3 text-[11px] font-black text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg">
                                <Wand2 size={14} className="mr-1.5" /> AI
                            </Button>
                            <Button variant="outline" onClick={handleSave} disabled={saving} className="h-8 px-3 text-[11px] font-bold border-primary/20 rounded-lg">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} className="mr-1.5" />} Kaydet
                            </Button>
                            <Button onClick={handleExportWord} className="h-8 px-3 text-[11px] font-black bg-slate-900 text-white rounded-lg shadow-sm">
                                <Download size={14} className="mr-1.5" /> Word
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border-b border-slate-200 px-8 py-2 shrink-0">
                <div className="overflow-x-auto">
                    <div id="report-editor-toolbar" className="ql-toolbar ql-snow rounded-xl border border-slate-200 bg-white min-w-max">
                        <span className="ql-formats">
                            <select className="ql-font" defaultValue="sans-serif">
                                <option value="sans-serif">Sans Serif</option>
                                <option value="serif"></option>
                                <option value="monospace"></option>
                                <option value="times-new-roman">Times New Roman</option>
                            </select>
                            <select className="ql-size" defaultValue="">
                                <option value="small"></option>
                                <option value=""></option>
                                <option value="large"></option>
                                <option value="huge"></option>
                            </select>
                        </span>
                        <span className="ql-formats">
                            <select className="ql-header" defaultValue="">
                                <option value="1"></option>
                                <option value="2"></option>
                                <option value="3"></option>
                                <option value=""></option>
                            </select>
                        </span>
                        <span className="ql-formats">
                            <button type="button" className="ql-bold" aria-label="bold"></button>
                            <button type="button" className="ql-italic" aria-label="italic"></button>
                            <button type="button" className="ql-underline" aria-label="underline"></button>
                            <button type="button" className="ql-strike" aria-label="strike"></button>
                            <button type="button" className="ql-blockquote" aria-label="blockquote"></button>
                            <button type="button" className="ql-code-block" aria-label="code-block"></button>
                        </span>
                        <span className="ql-formats">
                            <select className="ql-color" defaultValue=""></select>
                            <select className="ql-background" defaultValue=""></select>
                        </span>
                        <span className="ql-formats">
                            <button type="button" className="ql-list" value="ordered" aria-label="list ordered"></button>
                            <button type="button" className="ql-list" value="bullet" aria-label="list bullet"></button>
                            <button type="button" className="ql-indent" value="-1" aria-label="indent -1"></button>
                            <button type="button" className="ql-indent" value="+1" aria-label="indent +1"></button>
                        </span>
                        <span className="ql-formats">
                            <button type="button" className="ql-script" value="sub" aria-label="script sub"></button>
                            <button type="button" className="ql-script" value="super" aria-label="script super"></button>
                        </span>
                        <span className="ql-formats">
                            <button type="button" className="ql-link" aria-label="link"></button>
                            <button type="button" className="ql-image" aria-label="image"></button>
                            <button type="button" className="ql-clean" aria-label="clean"></button>
                        </span>
                        <span className="ql-formats">
                            <select className="ql-align" defaultValue=""></select>
                        </span>
                    </div>
                </div>
            </div>


            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-12 flex justify-center gap-6">
                {showOutline && (
                    <aside className="hidden 2xl:block w-72 shrink-0 h-fit sticky top-24">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Belge Anahattı</div>
                            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                                {headings.length === 0 && (
                                    <p className="text-xs text-slate-400 italic">Henüz başlık yok</p>
                                )}
                                {headings.map((h, i) => (
                                    <button
                                        type="button"
                                        key={`${h.text}_${i}`}
                                        onClick={() => jumpToHeading(h.text)}
                                        className={`block w-full text-left text-xs hover:bg-slate-50 rounded-md px-2 py-1.5 truncate ${h.level === 1 ? 'font-bold text-slate-700' : h.level === 2 ? 'font-semibold text-slate-600 pl-4' : 'font-medium text-slate-500 pl-6'}`}
                                        title={h.text}
                                    >
                                        {h.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>
                )}
                <div className="w-full max-w-[850px]">
                    <div className="mb-3 flex items-center justify-between px-2">
                        <div className="text-xs font-semibold text-slate-500">
                            {wordCount.toLocaleString("tr-TR")} kelime • {charCount.toLocaleString("tr-TR")} karakter • Tahmini {estimatedPages} sayfa
                        </div>
                        <button type="button" onClick={() => setShowRuler((v) => !v)} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">
                            {showRuler ? "Cetveli Gizle" : "Cetveli Göster"}
                        </button>
                    </div>
                    <Card onClick={focusEditorToEnd} style={{ zoom: `${zoom}%` }} className="p-16 min-h-[1100px] bg-white shadow-2xl border-none rounded-none prose max-w-none relative mb-20 overflow-visible cursor-text">
                        {/* Word A4 Impression */}
                        <div className="absolute -top-1 left-0 w-full h-1 bg-primary/10" />
                        <div className="mb-4 pb-2 border-b border-dashed border-slate-300">
                            <input
                                value={docHeader}
                                onChange={(e) => setDocHeader(e.target.value)}
                                className="w-full text-center text-xs font-semibold text-slate-500 bg-transparent outline-none"
                                placeholder="Üst bilgi"
                            />
                        </div>
                        {showRuler && (
                            <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-6 py-2">
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
                        
                        {/* Floating AI Bar */}
                        {showAIBar && selectionRect && (
                            <div 
                                className="fixed z-[1000] flex items-center gap-1 bg-[#1e293b] text-white p-1.5 rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 fade-in duration-200"
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
                                    onClick={() => handleAIProcess("improve")}
                                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                >
                                    GELIŞTIR
                                </button>
                                <button 
                                    disabled={processingAI}
                                    onClick={() => handleAIProcess("formalize")}
                                    className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
                                >
                                    RESMILEŞTIR
                                </button>
                                <button 
                                    disabled={processingAI}
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

                        <ReactQuill 
                            ref={quillRef}
                            theme="snow"
                            defaultValue={content}
                            onChange={(content) => { setContent(content); } }
                            placeholder="Raporunuzu buraya yazın..."
                            modules={{
                                ...editorModules,
                                cursors: true // Enable cursors plugin
                            }}
                            formats={editorFormats}
                            className={`h-full border-none ${pageMode ? 'editor-page-mode' : ''}`}
                        />
                        <div className="mt-8 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between">
                            <input
                                value={docFooter}
                                onChange={(e) => setDocFooter(e.target.value)}
                                className="w-[70%] text-xs font-semibold text-slate-500 bg-transparent outline-none"
                                placeholder="Alt bilgi"
                            />
                            <span className="text-xs font-bold text-slate-400">Sayfa 1 / {estimatedPages}</span>
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
                .ql-container.ql-snow { border: none !important; font-family: 'Inter', sans-serif !important; font-size: 16px !important; }
                .ql-toolbar.ql-snow { border: 1px solid #e2e8f0 !important; background: #fff !important; position: static !important; margin-bottom: 20px; border-radius: 12px; box-shadow: 0 2px 6px -3px rgb(0 0 0 / 0.12); }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="sans-serif"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="sans-serif"]::before { content: "Sans Serif"; font-family: Arial, Helvetica, sans-serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="serif"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="serif"]::before { content: "Serif"; font-family: Georgia, 'Times New Roman', serif; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="monospace"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="monospace"]::before { content: "Monospace"; font-family: 'Courier New', monospace; }
                .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="times-new-roman"]::before,
                .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="times-new-roman"]::before { content: "Times New Roman"; font-family: 'Times New Roman', Times, serif; }
                .ql-font-sans-serif { font-family: Arial, Helvetica, sans-serif; }
                .ql-font-times-new-roman { font-family: 'Times New Roman', Times, serif; }
                .ql-container { min-height: 880px !important; }
                .ql-editor {
                    padding: 8px 0 96px 0 !important;
                    min-height: 860px !important;
                    line-height: 1.8 !important;
                    color: #1e293b !important;
                    font-size: 16px !important;
                }
                .ql-editor h1 { font-size: 2.5rem !important; font-weight: 800 !important; margin-bottom: 2rem !important; color: #0f172a !important; text-align: center; }
                .ql-editor p { margin-bottom: 1rem !important; }
                .ql-editor.ql-blank::before { left: 0 !important; font-style: italic !important; color: #94a3b8 !important; }
                .editor-page-mode .ql-editor {
                    background-image: linear-gradient(to bottom, transparent 0, transparent 1118px, #e2e8f0 1118px, #e2e8f0 1120px);
                    background-size: 100% 1120px;
                    background-repeat: repeat-y;
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
                        <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(false)} className="rounded-full w-8 h-8 p-0">
                            X
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        {versions.length === 0 ? (
                            <p className="text-center text-xs text-muted-foreground mt-10 italic">Henüz bir sürüm kaydı bulunmuyor.</p>
                        ) : (
                            versions.map((v, i) => (
                                <div key={v.id} className={`p-4 rounded-xl border ${i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-white hover:border-slate-300'} cursor-pointer group transition-all`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm text-primary">{v.version_name}</span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12}/> {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">Kaydeden: <span className="font-semibold text-slate-700">{v.user}</span></p>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleRestoreVersion(v.id)}

                                        className="w-full h-7 text-xs rounded-lg mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Bu Sürüme Dön
                                    </Button>
                                </div>
                            ))
                        )}
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
};

const editorFormats = [
    'font', 'size',
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
    'color', 'background',
    'list', 'indent',
    'script',
    'link', 'image', 'align'
];
