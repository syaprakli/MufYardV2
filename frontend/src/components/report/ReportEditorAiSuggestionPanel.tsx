import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
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
    // Slayt/Sunum Ayrıştırıcı
    const slides = useMemo(() => {
        if (!aiSuggestedHtml) return [];
        
        const slideRegex = /\[Slayt\s*\d+\]|Slayt\s*\d+\s*:/gi;
        if (slideRegex.test(aiSuggestedHtml)) {
            const parts = aiSuggestedHtml.split(/\[Slayt\s*\d+\]|Slayt\s*\d+\s*:/gi);
            const cleaned = parts.map(p => p.trim()).filter(p => p.length > 0);
            if (cleaned.length > 1) {
                return cleaned.map((slideContent, index) => `
                    <div class="space-y-3 p-4">
                        <h4 class="text-lg font-black text-violet-500 tracking-tight mb-4 uppercase">Slayt ${index + 1}</h4>
                        <div class="text-slate-150 dark:text-slate-205 text-sm leading-relaxed">${slideContent}</div>
                    </div>
                `);
            }
        }
        
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = aiSuggestedHtml;
        const headers = Array.from(tempDiv.querySelectorAll("h1, h2, h3, h4"));
        const slideTitles = headers.filter(h => h.textContent?.toLowerCase().includes("slayt"));
        if (slideTitles.length > 1) {
            const parsedSlides: string[] = [];
            for (let i = 0; i < slideTitles.length; i++) {
                const currentHeader = slideTitles[i];
                const nextHeader = slideTitles[i + 1];
                let slideContent = `<h4 class="text-lg font-black text-violet-500 tracking-tight mb-4 uppercase">${currentHeader.textContent}</h4>`;
                let sibling = currentHeader.nextElementSibling;
                while (sibling && sibling !== nextHeader) {
                    slideContent += sibling.outerHTML;
                    sibling = sibling.nextElementSibling;
                }
                parsedSlides.push(`<div class="space-y-3 p-4">${slideContent}</div>`);
            }
            return parsedSlides;
        }
        
        return [];
    }, [aiSuggestedHtml]);

    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [viewMode, setViewMode] = useState<"standard" | "slides">("slides");

    useEffect(() => {
        if (slides.length > 0) {
            setActiveSlideIndex(0);
            setViewMode("slides");
        } else {
            setViewMode("standard");
        }
    }, [slides]);

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose} // Close modal on backdrop click
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div 
                onClick={(e) => e.stopPropagation()} // Prevent closing on modal content click
                className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-3xl w-full max-w-[850px] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
                    <div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Sparkles size={18} className="text-violet-600 animate-pulse" /> AI Öneri Paneli
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                            AI metni önce öneri olarak gelir, doğrudan onaylamadan raporunuza işlenmez.
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0 hover:bg-slate-200/50 dark:hover:bg-slate-800">
                        <X size={16} />
                    </Button>
                </div>

                {/* Main Content Layout - Split View */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Column: Prompt Settings (w-80 or w-[340px]) */}
                    <div className="w-[340px] border-r border-slate-200 dark:border-slate-800 p-5 overflow-y-auto space-y-4 flex-shrink-0 bg-white dark:bg-slate-900">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Hazır Prompt Şablonları
                            </label>
                            <div className="mt-2 flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                                {aiPromptPresets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => onSelectPreset(preset)}
                                        className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-violet-300 hover:text-violet-600 dark:hover:border-violet-800 dark:hover:text-violet-400 transition-all bg-slate-50/50 dark:bg-slate-950/20"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                {savedAiPresets.map((preset) => (
                                    <div key={preset.id} className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                                        <button
                                            type="button"
                                            onClick={() => onSelectPreset(preset)}
                                            className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-950/20 transition-all"
                                        >
                                            {preset.label}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeletePreset(preset.id)}
                                            className="px-1.5 py-1.5 text-[10px] font-black text-slate-400 hover:text-rose-600 border-l border-slate-200 dark:border-slate-800"
                                            title="Preset sil"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Promptu Kaydet
                            </label>
                            <div className="grid grid-cols-[1fr_auto] gap-1.5">
                                <input
                                    value={aiPresetName}
                                    onChange={(e) => setAiPresetName(e.target.value)}
                                    placeholder="Şablon ismi..."
                                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
                                />
                                <Button type="button" variant="outline" onClick={onSavePreset} className="h-9 px-3 text-[10px] font-black">
                                    Kaydet
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                İşlenecek Rapor Bölümü
                            </label>
                            <select
                                value={aiSection}
                                onChange={(e) => setAiSection(e.target.value)}
                                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                                <option value="tamamini">Raporun Tamamı</option>
                                <option value="giris">Giriş</option>
                                <option value="tespitler">Tespitler</option>
                                <option value="tenkit">Tenkit Maddeleri</option>
                                <option value="sonuc">Sonuç ve Öneriler</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Yapay Zeka Talimatı
                            </label>
                            <textarea
                                value={aiInstructions}
                                onChange={(e) => setAiInstructions(e.target.value)}
                                rows={4}
                                placeholder="Örn: Resmi ve hukuki bir dil kullan, bulguları kısa maddeler halinde özetle..."
                                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none"
                            />
                        </div>

                        <div className="pt-2">
                            <Button 
                                onClick={onGenerateSuggestion} 
                                disabled={aiGenerating} 
                                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white h-10 px-4 text-xs font-black flex items-center justify-center gap-1.5 rounded-xl shadow-md transition-all"
                            >
                                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                                {aiGenerating ? "Öneri Üretiliyor..." : "Yapay Zeka Önerisi Üret"}
                            </Button>
                        </div>
                    </div>

                    {/* Right Column: HTML Preview and Diff Visualizer (flex-1) */}
                    <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20 flex flex-col min-w-0">
                        {/* Upper Segment Toggles */}
                        <div className="mb-4 flex flex-wrap gap-1.5 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setAiApplyMode("append")}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                    aiApplyMode === "append" 
                                        ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                        : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                }`}
                            >
                                Raporun Sonuna Ekle
                            </button>
                            <button
                                type="button"
                                onClick={() => setAiApplyMode("replace")}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                    aiApplyMode === "replace" 
                                        ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                        : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                }`}
                            >
                                Mevcut İçeriği Değiştir
                            </button>
                            <button
                                type="button"
                                onClick={() => setAiApplyMode("selection")}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                    aiApplyMode === "selection" 
                                        ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                        : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                }`}
                            >
                                Seçili Paragrafta Kullan
                            </button>
                        </div>

                        {aiApplyMode === "selection" && (
                            <div className="mb-4 flex-shrink-0">
                                <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                    {aiSelectedText
                                        ? `Seçilen Metin Hazır: "${aiSelectedText.slice(0, 150)}${aiSelectedText.length > 150 ? "..." : ""}"`
                                        : "Uyarı: Editörde seçili metin bulunamadı. Lütfen önce değiştirmek istediğiniz paragrafı seçin."}
                                </div>
                            </div>
                        )}

                        {/* Suggestions output area */}
                        <div className="flex-1 min-h-0 flex flex-col space-y-4">
                            {aiSuggestedHtml ? (
                                <div className="space-y-4 overflow-y-auto pr-1">
                                    <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-slate-800/50 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex-shrink-0 gap-3">
                                        <span>Öneri hazır. Yaklaşık {aiSuggestionWordCount.toLocaleString("tr-TR")} kelime üretildi.</span>
                                        {slides.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setViewMode(prev => prev === "slides" ? "standard" : "slides")}
                                                className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg border-violet-250 dark:border-violet-800/30 text-violet-600 dark:text-violet-400"
                                            >
                                                {viewMode === "slides" ? "Klasik Görünüm" : "Slayt Görünümü"}
                                            </Button>
                                        )}
                                    </div>
                                    {slides.length > 0 && viewMode === "slides" ? (
                                        <div className="bg-slate-950 text-white rounded-3xl border border-slate-850/80 shadow-2xl p-8 relative min-h-[300px] flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
                                            {/* Slide Content */}
                                            <div className="flex-1 overflow-y-auto font-semibold leading-relaxed" dangerouslySetInnerHTML={{ __html: slides[activeSlideIndex] }} />
                                            
                                            {/* Slide Footer / Carousel Navigation */}
                                            <div className="flex items-center justify-between mt-6 border-t border-slate-800/50 pt-4 flex-shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                                                    disabled={activeSlideIndex === 0}
                                                    className="h-8 w-8 p-0 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white"
                                                >
                                                    <ChevronLeft size={16} />
                                                </Button>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Slayt {activeSlideIndex + 1} / {slides.length}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                                                    disabled={activeSlideIndex === slides.length - 1}
                                                    className="h-8 w-8 p-0 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white"
                                                >
                                                    <ChevronRight size={16} />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-900 p-5 prose max-w-none prose-slate dark:prose-invert text-xs">
                                            <div dangerouslySetInnerHTML={{ __html: aiSuggestedHtml }} />
                                        </div>
                                    )}
                                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-900 overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Fark Karşılaştırma Görünümü</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{aiChangedLineCount} satır farklı / {aiDiffLineCount} satır toplam</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAiShowChangedOnly(!aiShowChangedOnly)}
                                                className="h-8 text-[10px] font-black"
                                            >
                                                {aiShowChangedOnly ? "Tüm Satırlar" : "Yalnızca Değişenler"}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[300px] overflow-auto divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                                            <div className="p-3 bg-white dark:bg-slate-900">
                                                <div className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 px-2 py-1 text-[10px] font-black rounded text-slate-700 dark:text-slate-300 mb-2">Mevcut Rapor Taslağı</div>
                                                <div className="font-mono text-[10px] leading-5">
                                                    {aiVisibleDiffRows.map((row, idx) => {
                                                        const segments = row.changed ? getWordDiffSegments(row.left, row.right).leftSegments : [{ text: row.left || " ", changed: false }];
                                                        return (
                                                            <div key={`ai-left-${idx}`} className={`px-2 py-0.5 whitespace-pre-wrap rounded ${row.changed ? "bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}>
                                                                <span className="text-slate-400 mr-1.5 select-none">{row.lineNumber}.</span>
                                                                <span>
                                                                    {segments.map((segment, sIdx) => (
                                                                        <span key={`ai-ls-${idx}-${sIdx}`} className={segment.changed ? "bg-rose-200/80 dark:bg-rose-900/60 rounded px-0.5 font-bold" : ""}>{segment.text}</span>
                                                                    ))}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white dark:bg-slate-900">
                                                <div className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-950 px-2 py-1 text-[10px] font-black rounded text-slate-700 dark:text-slate-300 mb-2">Önerilen Değişiklikler</div>
                                                <div className="font-mono text-[10px] leading-5">
                                                    {aiVisibleDiffRows.map((row, idx) => {
                                                        const segments = row.changed ? getWordDiffSegments(row.left, row.right).rightSegments : [{ text: row.right || " ", changed: false }];
                                                        return (
                                                            <div key={`ai-right-${idx}`} className={`px-2 py-0.5 whitespace-pre-wrap rounded ${row.changed ? "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}>
                                                                <span className="text-slate-400 mr-1.5 select-none">{row.lineNumber}.</span>
                                                                <span>
                                                                    {segments.map((segment, sIdx) => (
                                                                        <span key={`ai-rs-${idx}-${sIdx}`} className={segment.changed ? "bg-emerald-200/90 dark:bg-emerald-900/60 rounded px-0.5 font-bold" : ""}>{segment.text}</span>
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
                                <div className="flex-1 flex items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs font-semibold px-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                                    Yapay zeka metin önerileri burada görüntülenecektir. Soldaki panelden talimatları belirleyip öneri ürettikten sonra, metni tek tıkla onaylayıp raporunuza ekleyebilirsiniz.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0 gap-3">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 max-w-[60%] leading-relaxed">
                        Uygulama Modu: {aiApplyMode === "append" ? "Öneri mevcut taslak raporun sonuna eklenecek." : aiApplyMode === "replace" ? "Öneri mevcut taslağın tamamı ile değiştirilecek." : "Öneri yalnızca editörde seçili olan paragrafın yerine yazılacak."}
                    </div>
                    <Button onClick={onApplySuggestion} disabled={!aiSuggestedHtml.trim() || !canEditContent} className="h-10 px-4 text-xs font-black bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98] rounded-xl transition-all shadow-md">
                        Metin Önerisini Uygula
                    </Button>
                </div>
            </div>
        </div>
    );
}
