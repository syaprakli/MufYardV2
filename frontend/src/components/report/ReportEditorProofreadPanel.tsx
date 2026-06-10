import { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/Button";
import { API_URL as API_BASE_URL } from "../../lib/config";
import { getAuthHeaders, fetchWithTimeout } from "../../lib/api/utils";
import { ChevronLeft, ChevronRight, X, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

export type ProofreadResult = {
  matches: Array<{
    message: string;
    offset: number;
    length: number;
    replacements: string[];
    context: { text: string; offset: number; length: number };
  }>;
};

// Helper function to split HTML content into logical pages
const getPages = (htmlContent: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Extract paragraphs/text nodes
  const paragraphs = Array.from(doc.body.childNodes)
    .map(node => node.textContent || '')
    .filter(text => text.trim().length > 0);
  
  const pages: string[] = [];
  let currentPage = "";
  for (const p of paragraphs) {
    // Group paragraphs into pages of approx 2000 characters
    if ((currentPage + p).length > 2000 && currentPage.length > 0) {
      pages.push(currentPage.trim());
      currentPage = p + "\n\n";
    } else {
      currentPage += p + "\n\n";
    }
  }
  if (currentPage.trim().length > 0) {
    pages.push(currentPage.trim());
  }
  return pages.length > 0 ? pages : [""];
};

export default function ReportEditorProofreadPanel({
  content,
  onClose,
  onReplaceText,
}: {
  content: string;
  onClose: () => void;
  onReplaceText: (context: string, error: string, replacement: string) => boolean;
}) {
  const pages = useMemo(() => getPages(content), [content]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApplyReplacement = (matchIndex: number, replacement: string) => {
    const match = result?.matches[matchIndex];
    if (!match) return;

    const errorText = match.context.text.substr(match.context.offset, match.context.length);
    const success = onReplaceText(match.context.text, errorText, replacement);

    if (success) {
      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          matches: prev.matches.filter((_, idx) => idx !== matchIndex)
        };
      });
      toast.success("Düzeltme uygulandı!");
    } else {
      toast.error("Metin editörde bulunamadı veya değiştirilemedi.");
    }
  };

  const handleCheck = async (index: number) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers = await getAuthHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetchWithTimeout(`${API_BASE_URL}/ai/proofread`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: pages[index],
        }),
        timeout: 90000, // 90 saniye limit
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Dil kontrolü servisi bir hata döndürdü.");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCheck(currentPageIndex);
  }, [currentPageIndex]);

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/80 shadow-2xl flex flex-col items-center gap-4 min-w-[380px] max-w-lg w-full max-h-[85vh] overflow-auto animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between w-full mb-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Yazım ve Dil Kontrolü</h3>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </Button>
        </div>

        {/* Sayfa Kontrol/Yönlendirme Alanı */}
        <div className="flex items-center justify-between w-full bg-slate-50 dark:bg-slate-950/40 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/60">
          <Button
            variant="ghost"
            onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
            disabled={currentPageIndex === 0 || loading}
            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-xs font-black text-slate-600 dark:text-slate-300">
            Sayfa {currentPageIndex + 1} / {pages.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
            disabled={currentPageIndex === pages.length - 1 || loading}
            className="h-8 w-8 p-0 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 w-full">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sayfa taranıyor, lütfen bekleyin...</span>
          </div>
        )}

        {error && (
          <div className="text-rose-600 dark:text-rose-400 text-xs font-bold bg-rose-50 dark:bg-rose-950/20 px-4 py-3 rounded-2xl border border-rose-100/70 dark:border-rose-900/30 w-full text-center flex items-center gap-2 justify-center">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && result && (
          <div className="w-full max-w-md">
            {result.matches.length === 0 ? (
              <div className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-5 py-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-center text-sm py-8">
                Bu sayfada hata bulunmadı! Rapor dili kusursuz görünüyor.
              </div>
            ) : (
              <ul className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                {result.matches.map((m, i) => (
                  <li key={i} className="border-b border-slate-100 dark:border-slate-800/80 pb-4 last:border-none">
                    <div className="font-bold text-xs text-rose-700 dark:text-rose-400">{m.message}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-semibold">
                      <span className="font-mono bg-yellow-100/70 dark:bg-yellow-950/30 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                        {m.context.text.substring(
                          Math.max(0, m.context.offset - 15),
                          m.context.offset
                        )}
                        <b className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-1 rounded font-black">
                          {m.context.text.substr(m.context.offset, m.context.length)}
                        </b>
                        {m.context.text.substring(
                          m.context.offset + m.context.length,
                          m.context.offset + m.context.length + 15
                        )}
                      </span>
                    </div>
                    {m.replacements.length > 0 && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-2.5 flex items-center gap-1.5 flex-wrap">
                        Öneriler: {m.replacements.slice(0, 3).map((rep, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleApplyReplacement(i, rep)}
                            className="bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-2.5 py-1 rounded-xl text-[10px] font-black text-emerald-800 dark:text-emerald-300 cursor-pointer"
                          >
                            {rep}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="mt-2 w-full h-10 rounded-xl">Kapat</Button>
      </div>
    </div>
  );
}
