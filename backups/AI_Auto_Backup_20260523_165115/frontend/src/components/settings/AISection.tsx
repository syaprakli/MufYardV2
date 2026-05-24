import { useState, useEffect } from 'react';
import { Wand2, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { toast } from "react-hot-toast";
import { cn } from "../../lib/utils";
import { API_URL } from "../../lib/config";
import { fetchWithTimeout, getAuthHeaders } from "../../lib/api/utils";
import { type Profile } from "../../lib/api/profiles";

const GEMINI_MODELS = [
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Mevzuat Uzmanı)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Önerilen - Güncel)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Hızlı ve Ekonomik)" },
];

interface AISectionProps {
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

export const AISection: React.FC<AISectionProps> = ({ profile, setProfile }) => {
    const [key, setKey] = useState("");
    const [model, setModel] = useState("gemini-2.0-flash");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState<"idle" | "connected" | "error">("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [maskedKey, setMaskedKey] = useState("");
    const [hasKey, setHasKey] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetchWithTimeout(`${API_URL}/ai/my-settings`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setHasKey(data.has_key);
                    setMaskedKey(data.masked_key || "");
                    if (data.gemini_model) setModel(data.gemini_model);
                }
            } catch {}
        })();
    }, []);

    const handleSaveKey = async () => {
        if (!key.trim()) { toast.error("API anahtarı boş olamaz."); return; }
        setSaving(true);
        try {
            const headers = await getAuthHeaders({ "Content-Type": "application/json" });
            const res = await fetchWithTimeout(`${API_URL}/ai/set-key`, {
                method: "POST",
                headers,
                body: JSON.stringify({ gemini_api_key: key.trim(), gemini_model: model }),
            });
            if (!res.ok) throw new Error((await res.json()).detail);
            toast.success("API anahtarınız kaydedildi!");
            setHasKey(true);
            setMaskedKey(key.trim().slice(0, 6) + "****" + key.trim().slice(-4));
            setKey("");
            setStatus("idle");
        } catch (e: any) {
            toast.error(e.message || "Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setStatus("idle");
        setStatusMsg("");
        try {
            const headers = await getAuthHeaders();
            const res = await fetchWithTimeout(`${API_URL}/ai/test-connection`, { headers });
            const data = await res.json();
            if (data.connected) {
                setStatus("connected");
                setStatusMsg("Bağlantı başarılı! Asistan kullanıma hazır.");
            } else {
                setStatus("error");
                setStatusMsg(data.message || "Bağlanamıyor.");
            }
        } catch {
            setStatus("error");
            setStatusMsg("Sunucuya ulaşılamadı.");
        } finally {
            setTesting(false);
        }
    };

    return (
        <Card className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8 rounded-3xl border-none shadow-xl bg-card">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h3 className="text-xl font-black font-outfit text-primary tracking-tight">Gemini API Anahtarı</h3>
                    <p className="text-xs text-slate-500 font-medium">Yapay zeka asistanını kullanmak için kendi Google AI Studio anahtarınızı kullanabilirsiniz.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <input
                            type={showKey ? "text" : "password"}
                            value={key}
                            onChange={e => setKey(e.target.value)}
                            placeholder={hasKey ? `Kayıtlı: ${maskedKey}` : "AI Studio API Key girin..."}
                            className="w-full h-12 pl-5 pr-12 rounded-2xl bg-muted border border-slate-200 dark:border-slate-800 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all dark:text-slate-100"
                        />
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors p-1"
                        >
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <select
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all bg-muted dark:bg-slate-800 dark:text-slate-100 cursor-pointer w-full md:w-auto"
                    >
                        {GEMINI_MODELS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleSaveKey} disabled={saving} className="flex-1 h-12 rounded-2xl shadow-md shadow-primary/20 font-black">
                        {saving ? <><Loader2 size={15} className="animate-spin mr-2" />Kaydediliyor</> : <><Save size={15} className="mr-2" />Kaydet</>}
                    </Button>
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex-1 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-sm text-muted-foreground dark:text-slate-300 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {testing ? <><Loader2 size={14} className="animate-spin" />Test ediliyor...</> : "Bağlantıyı Test Et"}
                    </button>
                </div>

                {status !== "idle" && (
                    <div className={cn(
                        "flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-bold border",
                        status === "connected"
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                    )}>
                        <div className={cn(
                            "w-3 h-3 rounded-full flex-shrink-0 animate-pulse",
                            status === "connected" ? "bg-emerald-500" : "bg-red-500"
                        )} />
                        {statusMsg}
                    </div>
                )}

                <hr className="border-slate-100 dark:border-slate-800" />
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Wand2 className="text-primary" size={24} />
                        <h3 className="font-black text-xl font-outfit text-primary dark:text-primary/90 tracking-tight">AI Asistan Modu</h3>
                    </div>
                    <div 
                        onClick={() => setProfile(prev => prev ? {...prev, ai_enabled: !prev.ai_enabled} : null)}
                        className={cn(
                            "w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300",
                            profile?.ai_enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                        )}
                    >
                        <div className={cn(
                            "absolute top-1 w-6 h-6 bg-card rounded-full shadow-lg transition-all duration-300",
                            profile?.ai_enabled ? "right-1" : "left-1"
                        )} />
                    </div>
                </div>
            </div>
        </Card>
    );
};
