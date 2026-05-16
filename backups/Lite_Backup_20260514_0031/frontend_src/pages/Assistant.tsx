import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Info, Trash2, Shield, ChevronRight, History, Sparkles, Copy, Check as CheckIcon, Zap, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";
import { useLocation } from "react-router-dom";
import { API_URL } from "../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useConfirm } from "../lib/context/ConfirmContext";
import { toast } from "react-hot-toast";

interface Message {
    role: 'assistant' | 'user';
    text: string;
    timestamp: Date;
    actions?: ActionResult[];
}

interface ActionResult {
    success: boolean;
    action: string;
    message: string;
    data?: Record<string, any>;
}

// Basit markdown → React nodes dönüştürücü (hiç paket gerektirmez)
function renderMarkdown(text: string) {
    if (!text) return [];
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // Başlık
        if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="font-black text-base text-foreground mt-3 mb-1">{parseInline(line.slice(4))}</h3>);
        } else if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="font-black text-lg text-foreground mt-4 mb-1">{parseInline(line.slice(3))}</h2>);
        } else if (line.startsWith('# ')) {
            elements.push(<h1 key={i} className="font-black text-xl text-foreground mt-4 mb-2">{parseInline(line.slice(2))}</h1>);
        // Madde imi
        } else if (line.match(/^[-*] /)) {
            elements.push(
                <li key={i} className="ml-4 list-disc text-[15px] leading-relaxed">{parseInline(line.slice(2))}</li>
            );
        // Numaralı liste
        } else if (line.match(/^\d+\. /)) {
            const content = line.replace(/^\d+\. /, '');
            elements.push(
                <li key={i} className="ml-4 list-decimal text-[15px] leading-relaxed">{parseInline(content)}</li>
            );
        // Yatay çizgi
        } else if (line.match(/^---+$/)) {
            elements.push(<hr key={i} className="my-3 border-border" />);
        // Boş satır
        } else if (line.trim() === '') {
            elements.push(<div key={i} className="h-2" />);
        // Normal paragraf
        } else {
            elements.push(<p key={i} className="text-[15px] leading-relaxed">{parseInline(line)}</p>);
        }
        i++;
    }
    return elements;
}

function parseInline(text: string): React.ReactNode[] {
    // **bold**, *italic*, `code` destekle
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const raw = match[0];
        if (raw.startsWith('**')) {
            parts.push(<strong key={match.index} className="font-black">{raw.slice(2, -2)}</strong>);
        } else if (raw.startsWith('*')) {
            parts.push(<em key={match.index}>{raw.slice(1, -1)}</em>);
        } else if (raw.startsWith('`')) {
            parts.push(
                <code key={match.index} className="bg-muted/80 text-primary px-1.5 py-0.5 rounded-md text-[13px] font-mono font-bold">
                    {raw.slice(1, -1)}
                </code>
            );
        }
        lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
}

const SUGGESTION_CHIPS = [
    "Son denetimleri özetle",
    "Yarın saat 10:00'a toplantı notu ekle",
    "Bolu KYK Genel Denetimi görevi oluştur",
    "Notlarımı listele",
    "Rapor dosyalarını listele",
    "KYK yönetmeliğini detaylı oku ve analiz et",
    "Asansör yeşil etiket tenkit maddesi yaz",
    "Takvimimde bu hafta ne var?",
];

const STORAGE_KEY = "mufyard_assistant_messages";

export default function Assistant() {
    const location = useLocation();
    const confirm = useConfirm();

    // localStorage'dan mesajları yükle
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Eski formattaki mesajları filtrele (text alanı olmayanları at)
                const valid = parsed.filter((m: any) => m && typeof m.text === 'string');
                if (valid.length > 0) {
                    return valid.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
                }
            }
        } catch {}
        return [{
            role: 'assistant' as const,
            text: 'Merhaba, Ben MufYard AI Asistanınız.\n\n**Tüm mevzuat belgelerinizi** okudum ve öğrendim. **Denetim verilerinize**, **rehber bilgilerinize** ve **tenkit bilgi bankasına** tam erişimim var.\n\n**Neler yapabilirim:**\n- Mevzuat analizi, yorumlama ve derinlemesine okuma\n- Tenkit maddesi oluşturma (yasal dayanaklı)\n- Denetim raporu taslağı yazma\n- Sorularınızı yanıtlama\n\n**⚡ Aksiyon Yürütme:**\n- Görev/rapor oluşturma & Denetim başlatma\n- Rehbere kişi ekleme/silme\n- Forum konusu açma/silme & Mesaj gönderme\n- Takvime not ekleme/silme/listeleme\n- Hızlı not oluşturma/silme/listeleme\n- Dosyaları listeleme ve okuma (PDF/DOCX/TXT)\n\nAşağıdaki önerilerden birini seçin veya doğrudan sorunuzu yazın.',
            timestamp: new Date()
        }];
    });
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isTyping]);

    // Mesajları localStorage'a kaydet
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        } catch {}
    }, [messages]);

    // Handle initial query from navigation state
    useEffect(() => {
        const state = location.state as { initialQuery?: string };
        if (state?.initialQuery) {
            handleSendMessage(state.initialQuery);
        }
    }, [location.state]);

    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const newUserMessage = { role: 'user' as const, text: text, timestamp: new Date() };
        setMessages(prev => [...prev, newUserMessage]);
        setInput("");
        setIsTyping(true);

        try {
            // Sohbet geçmişini AI'a gönder (son 20 mesaj)
            const allMessages = [...messages, newUserMessage];
            const history = allMessages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(-20)
                .map(m => ({ role: m.role, text: m.text }));

            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const response = await fetchWithTimeout(`${API_URL}/ai/chat`, {
                method: "POST",
                headers,
                body: JSON.stringify({ message: text, history })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || "AI istegi basarisiz oldu.");
            }
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: data.response,
                timestamp: new Date(),
                actions: data.actions || undefined,
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: err?.message || "Uzgunum, su an sunucu ile baglanti kuramiyorum. Lutfen tekrar deneyin.",
                timestamp: new Date()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSendMessage(input);
    };

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIdx(idx);
            toast.success("Kopyalandı!");
            setTimeout(() => setCopiedIdx(null), 2000);
        });
    };

    const handleClearHistory = async () => {
        const confirmed = await confirm({
            title: "Geçmişi Temizle",
            message: "Tüm sohbet geçmişiniz silinecek. Emin misiniz?",
            confirmText: "Temizle",
            variant: "danger"
        });
        if (confirmed) {
            const initial = [{
                role: 'assistant' as const,
                text: 'Merhaba, Ben MufYard AI Asistanınız.\n\n**Tüm mevzuat belgelerinizi** okudum ve öğrendim. **Denetim verilerinize**, **rehber bilgilerinize** ve **tenkit bilgi bankasına** tam erişimim var.\n\n**Neler yapabilirim:**\n- Mevzuat analizi, yorumlama ve derinlemesine okuma\n- Tenkit maddesi oluşturma (yasal dayanaklı)\n- Denetim raporu taslağı yazma\n- Sorularınızı yanıtlama\n\n**⚡ Aksiyon Yürütme:**\n- Görev/rapor oluşturma & Denetim başlatma\n- Rehbere kişi ekleme/silme\n- Forum konusu açma/silme & Mesaj gönderme\n- Takvime not ekleme/silme/listeleme\n- Hızlı not oluşturma/silme/listeleme\n- Dosyaları listeleme ve okuma (PDF/DOCX/TXT)\n\nAşağıdaki önerilerden birini seçin veya doğrudan sorunuzu yazın.',
                timestamp: new Date()
            }];
            setMessages(initial);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        }
    };
    
    const showSuggestions = messages.length <= 1;

    return (
        <div className="flex-1 flex flex-col min-h-0 gap-4 md:gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Dijital Asistan</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                        Dijital Müfettiş Asistanı
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">Mevzuat ve denetim süreçlerinizde AI desteği alın.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={handleClearHistory} className="flex-1 md:flex-none rounded-xl border-border text-muted-foreground hover:bg-muted font-bold text-[11px] h-11 px-4">
                        <Trash2 size={16} className="mr-2" /> TEMİZLE
                    </Button>
                    <div className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black border border-emerald-100 shadow-sm uppercase tracking-widest h-11">
                        <Bot size={14} /> Gemini Online
                    </div>
                </div>
            </div>

            <Card className="flex-1 flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-card/40 backdrop-blur-md rounded-3xl relative">
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
                    {messages.map((m, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex gap-3 md:gap-4 max-w-[95%] md:max-w-[85%] animate-in slide-in-from-bottom-2 duration-300 group/msg",
                                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg transition-transform hover:scale-110",
                                m.role === 'assistant' ? "bg-primary text-white" : "bg-card border border-border text-primary"
                            )}>
                                {m.role === 'assistant' ? <Bot size={16} className="md:size-[20px]" /> : <User size={16} className="md:size-[20px]" />}
                            </div>
                            <div className="space-y-1 flex-1 min-w-0">
                                <div className={cn(
                                    "p-5 rounded-3xl text-[15px] leading-relaxed shadow-sm relative",
                                    m.role === 'assistant'
                                        ? "bg-card border border-border text-foreground rounded-tl-none"
                                        : "bg-primary text-white rounded-tr-none"
                                )}>
                                    {m.role === 'assistant' ? (
                                        <div className="font-medium space-y-0.5">
                                            {/* Aksiyon sonuç kartları */}
                                            {m.actions && m.actions.length > 0 && (
                                                <div className="space-y-2 mb-3">
                                                    {m.actions.map((act, ai) => (
                                                        <div
                                                            key={ai}
                                                            className={cn(
                                                                "flex items-start gap-2 p-3 rounded-2xl text-sm font-bold border",
                                                                act.success
                                                                    ? "bg-emerald-500/10 border-emerald-200 text-emerald-400"
                                                                    : "bg-red-50 border-red-200 text-red-800"
                                                            )}
                                                        >
                                                            {act.success
                                                                ? <Zap size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                                                                : <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                                                            }
                                                            <span>{act.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {renderMarkdown(m.text)}
                                        </div>
                                    ) : (
                                        <p className="font-medium">{m.text}</p>
                                    )}
                                    {/* Kopyalama butonu */}
                                    {m.role === 'assistant' && (
                                        <button
                                            onClick={() => handleCopy(m.text, idx)}
                                            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-muted/80 hover:bg-slate-200 flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity"
                                            title="Kopyala"
                                        >
                                            {copiedIdx === idx
                                                ? <CheckIcon size={12} className="text-emerald-600" />
                                                : <Copy size={12} className="text-muted-foreground" />
                                            }
                                        </button>
                                    )}
                                </div>
                                <p className={cn(
                                    "text-[10px] font-bold text-muted-foreground uppercase tracking-widest",
                                    m.role === 'user' ? "text-right mr-2" : "ml-2"
                                )}>
                                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Öneri chipleri - sadece sohbet başındaysa */}
                    {showSuggestions && !isTyping && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {SUGGESTION_CHIPS.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSendMessage(chip)}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border rounded-2xl text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shadow-sm"
                                >
                                    <Sparkles size={12} className="text-primary/60" />
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}

                    {isTyping && (
                        <div className="flex gap-4 max-w-[80%]">
                            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg">
                                <Bot size={20} />
                            </div>
                            <div className="p-5 rounded-3xl bg-card border border-border flex items-center gap-3 rounded-tl-none shadow-sm">
                                <Loader2 size={18} className="animate-spin text-primary" />
                                <span className="text-sm font-bold text-primary italic">Asistan verileri analiz ediyor...</span>
                            </div>
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-card/80 border-t border-border/50 backdrop-blur-md">
                    <form onSubmit={onSubmit} className="relative max-w-4xl mx-auto group flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Bir şeyler sorun..."
                                className="w-full h-12 md:h-14 pl-5 md:pl-6 pr-4 rounded-2xl border border-border/60 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-[14px] md:text-[15px] font-medium shadow-inner bg-card/50"
                                disabled={isTyping}
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={isTyping || !input.trim()}
                            className="h-12 md:h-14 px-4 md:px-8 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 border-none"
                        >
                            <span className="hidden sm:inline text-sm font-bold">Sor</span>
                            <Send size={18} />
                        </Button>
                    </form>
                    <div className="flex justify-center gap-6 mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span className="flex items-center gap-1"><History size={12} /> Gerçek Zamanlı Analiz</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Info size={12} /> Veri Kaynağı: Firestore Cloud</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
