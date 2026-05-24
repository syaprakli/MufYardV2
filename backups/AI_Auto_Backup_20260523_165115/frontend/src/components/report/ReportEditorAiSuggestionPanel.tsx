import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";

type SavedAiPromptPreset = {
    id: string;
    label: string;
    section: string;
    instructions: string;
};

type AiDiffRow = {
    lineNumber: number;
    left: string;
    right: string;
    changed: boolean;
};

type DiffSegment = {
    text: string;
    changed: boolean;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    canEditContent: boolean;
    aiPromptPresets: readonly { label: string; section: string; instructions: string }[];
    savedAiPresets: SavedAiPromptPreset[];
    onSelectPreset: (preset: { section: string; instructions: string }) => void;
    onDeletePreset: (presetId: string) => void;
    aiPresetName: string;
    setAiPresetName: (value: string) => void;
    onSavePreset: () => void;
    aiSection: string;
    setAiSection: (value: string) => void;
    aiInstructions: string;
    setAiInstructions: (value: string) => void;
    aiGenerating: boolean;
    onGenerateSuggestion: () => void;
    aiApplyMode: "replace" | "append" | "selection";
    setAiApplyMode: (value: "replace" | "append" | "selection") => void;
    aiSelectedText: string;
    aiSuggestedHtml: string;
    aiSuggestionWordCount: number;
    aiChangedLineCount: number;
    aiDiffLineCount: number;
    aiShowChangedOnly: boolean;
    setAiShowChangedOnly: (value: boolean) => void;
    aiVisibleDiffRows: AiDiffRow[];
    getWordDiffSegments: (leftLine: string, rightLine: string) => { leftSegments: DiffSegment[]; rightSegments: DiffSegment[] };
    onApplySuggestion: () => void;
};

export default function ReportEditorAiSuggestionPanel({
    isOpen,
    onClose,
    canEditContent,
    aiPromptPresets,
    savedAiPresets,
    onSelectPreset,
    onDeletePreset,
    aiPresetName,
    setAiPresetName,
    onSavePreset,
    aiSection,
    setAiSection,
    aiInstructions,
    setAiInstructions,
    aiGenerating,
    onGenerateSuggestion,
    aiApplyMode,
    setAiApplyMode,
    aiSelectedText,
    aiSuggestedHtml,
    aiSuggestionWordCount,
    aiChangedLineCount,
    aiDiffLineCount,
    aiShowChangedOnly,
    setAiShowChangedOnly,
    aiVisibleDiffRows,
    getWordDiffSegments,
    onApplySuggestion
}: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[32rem] max-w-[94vw] bg-white shadow-2xl z-[102] border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
            <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50">
                <div>
                    <h3 className="font-bold flex items-center gap-2"><Sparkles size={18} className="text-primary" /> AI Öneri Paneli</h3>
                    <p className="text-[11px] text-slate-500 mt-1">AI metni önce öneri olarak gelir. Uygulamadan taslağa işlenmez.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0">
                    <X size={16} />
                </Button>
            </div>

            <div className="p-4 border-b border-slate-100 space-y-4">
                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hazır Promptlar</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {aiPromptPresets.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => onSelectPreset(preset)}
                                className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:border-primary/20 hover:text-primary transition-all"
                            >
                                {preset.label}
                            </button>
                        ))}
                        {savedAiPresets.map((preset) => (
                            <div key={preset.id} className="inline-flex items-center rounded-full border border-slate-200 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => onSelectPreset(preset)}
                                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-primary hover:bg-primary/5 transition-all"
                                >
                                    {preset.label}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDeletePreset(preset.id)}
                                    className="px-2 py-1.5 text-[10px] font-black text-slate-400 hover:text-rose-600 border-l border-slate-200"
                                    title="Preset sil"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <input
                        value={aiPresetName}
                        onChange={(e) => setAiPresetName(e.target.value)}
                        placeholder="Bu promptu isim verip kaydet"
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <Button type="button" variant="outline" onClick={onSavePreset} className="h-10 px-4 text-[11px] font-black">
                        Preset Kaydet
                    </Button>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bölüm</label>
                    <select
                        value={aiSection}
                        onChange={(e) => setAiSection(e.target.value)}
                        className="mt-2 w-full h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    >
                        <option value="tamamini">Raporun Tamamı</option>
                        <option value="giris">Giriş</option>
                        <option value="tespitler">Tespitler</option>
                        <option value="tenkit">Tenkit Maddeleri</option>
                        <option value="sonuc">Sonuç ve Öneriler</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ek Talimat</label>
                    <textarea
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        rows={4}
                        placeholder="Örn: Daha resmi bir ton kullan, mali riskleri vurgula, kısa paragraf yapısı uygula..."
                        className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={onGenerateSuggestion} disabled={aiGenerating} className="h-10 px-4 text-[11px] font-black">
                        {aiGenerating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />} Öneri Üret
                    </Button>
                    <span className="text-[11px] text-slate-500 font-medium">AI önerisi mevcut raporu okumaya devam eder ama otomatik yazmaz.</span>
                </div>
            </div>

            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setAiApplyMode("append")}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${aiApplyMode === "append" ? "border-primary/30 bg-primary/10 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                    Sona Ekle
                </button>
                <button
                    type="button"
                    onClick={() => setAiApplyMode("replace")}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${aiApplyMode === "replace" ? "border-primary/30 bg-primary/10 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                    Mevcut İçeriği Değiştir
                </button>
                <button
                    type="button"
                    onClick={() => setAiApplyMode("selection")}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${aiApplyMode === "selection" ? "border-primary/30 bg-primary/10 text-primary" : "border-slate-200 text-slate-500"}`}
                >
                    Seçili Paragrafa Uygula
                </button>
            </div>

            {aiApplyMode === "selection" && (
                <div className="px-4 pb-4 border-b border-slate-100">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500 font-medium">
                        {aiSelectedText
                            ? `Seçili metin hazır: "${aiSelectedText.slice(0, 180)}${aiSelectedText.length > 180 ? "..." : ""}"`
                            : "Henüz editörde seçili bir paragraf yok. Bu modu kullanmak için önce editörde bir paragraf seçin."}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60">
                {aiSuggestedHtml ? (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500 font-medium">
                            Önizleme hazır. Yaklaşık {aiSuggestionWordCount.toLocaleString("tr-TR")} kelime üretildi.
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 prose max-w-none prose-slate">
                            <div dangerouslySetInnerHTML={{ __html: aiSuggestedHtml }} />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Fark Görünümü</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{aiChangedLineCount} satır farklı / {aiDiffLineCount} satır toplam</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAiShowChangedOnly(!aiShowChangedOnly)}
                                    className="h-8 text-[11px]"
                                >
                                    {aiShowChangedOnly ? "Tüm Satırlar" : "Sadece Değişenler"}
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 max-h-[420px] overflow-auto">
                                <div className="border-r border-slate-200">
                                    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Mevcut Taslak</div>
                                    <div className="font-mono text-[11px] leading-5">
                                        {aiVisibleDiffRows.map((row, idx) => {
                                            const segments = row.changed ? getWordDiffSegments(row.left, row.right).leftSegments : [{ text: row.left || " ", changed: false }];
                                            return (
                                                <div key={`ai-left-${idx}`} className={`px-3 py-1 whitespace-pre-wrap ${row.changed ? "bg-rose-50" : "bg-white"}`}>
                                                    <span className="text-slate-400 mr-2">{row.lineNumber}.</span>
                                                    <span>
                                                        {segments.map((segment, sIdx) => (
                                                            <span key={`ai-ls-${idx}-${sIdx}`} className={segment.changed ? "bg-rose-200/80 rounded px-0.5" : ""}>{segment.text}</span>
                                                        ))}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">AI Önerisi</div>
                                    <div className="font-mono text-[11px] leading-5">
                                        {aiVisibleDiffRows.map((row, idx) => {
                                            const segments = row.changed ? getWordDiffSegments(row.left, row.right).rightSegments : [{ text: row.right || " ", changed: false }];
                                            return (
                                                <div key={`ai-right-${idx}`} className={`px-3 py-1 whitespace-pre-wrap ${row.changed ? "bg-emerald-50" : "bg-white"}`}>
                                                    <span className="text-slate-400 mr-2">{row.lineNumber}.</span>
                                                    <span>
                                                        {segments.map((segment, sIdx) => (
                                                            <span key={`ai-rs-${idx}-${sIdx}`} className={segment.changed ? "bg-emerald-200/90 rounded px-0.5" : ""}>{segment.text}</span>
                                                        ))}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-center text-slate-400 text-sm font-medium px-8">
                        AI önerisi burada önizlenecek. Önce öneri üret, sonra istersen tek tıkla uygula.
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-slate-500">
                    Uygulama modu: {aiApplyMode === "append" ? "Öneri taslağın sonuna eklenecek." : aiApplyMode === "replace" ? "Öneri mevcut taslağın yerine geçecek." : "Öneri sadece seçili paragrafın yerine uygulanacak."}
                </div>
                <Button onClick={onApplySuggestion} disabled={!aiSuggestedHtml.trim() || !canEditContent} className="h-10 px-4 text-[11px] font-black">
                    Öneriyi Uygula
                </Button>
            </div>
        </div>
    );
}
