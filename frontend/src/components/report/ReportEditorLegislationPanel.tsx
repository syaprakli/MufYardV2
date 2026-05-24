import { useState } from "react";
import { Button } from "../ui/Button";
import { API_URL as API_BASE_URL } from "../../lib/config";
import { getAuthHeaders, fetchWithTimeout } from "../../lib/api/utils";
import { X, AlertCircle, Loader2, BookOpen, Plus } from "lucide-react";
import { toast } from "react-hot-toast";

type LegislationRecommendation = {
  title: string;
  article: string;
  snippet: string;
  relevance_reason: string;
};

export default function ReportEditorLegislationPanel({
  content,
  onInsertReference,
  onClose,
}: {
  content: string;
  onInsertReference: (ref: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<LegislationRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    setRecommendations(null);
    try {
      // Strip tags from HTML before sending to AI
      const plainText = content.replace(/<[^>]+>/g, " ").trim();
      if (!plainText) {
        throw new Error("Mevzuat önermek için raporda yazılmış bir metin bulunmalıdır.");
      }

      const headers = await getAuthHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetchWithTimeout(`${API_BASE_URL}/ai/suggest-legislation`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: plainText,
        }),
        timeout: 90000,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Mevzuat motorundan yanıt alınamadı.");
      }
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = (rec: LegislationRecommendation) => {
    const textToInsert = ` (Bkz: ${rec.title}, ${rec.article}) `;
    onInsertReference(textToInsert);
    toast.success("Mevzuat referansı editöre eklendi.");
  };

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800/80 shadow-2xl flex flex-col gap-4 min-w-[380px] max-w-xl w-full max-h-[85vh] overflow-auto animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between w-full mb-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="text-primary" size={20} /> Akıllı Mevzuat Önerisi
          </h3>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </Button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed -mt-2">
          Yapay zeka, raporunuzda yazdığınız metni analiz ederek GSB mevzuat veri tabanındaki en alakalı yasa ve yönetmelikleri bulur.
        </p>

        <Button onClick={handleFetchRecommendations} disabled={loading} className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Analiz Ediliyor...
            </>
          ) : (
            "Rapor Metnini Analiz Et ve Mevzuat Bul"
          )}
        </Button>

        {error && (
          <div className="text-rose-600 dark:text-rose-400 text-xs font-bold bg-rose-50 dark:bg-rose-950/20 px-4 py-3 rounded-2xl border border-rose-100/70 dark:border-rose-900/30 w-full text-center flex items-center gap-2 justify-center">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {recommendations && (
          <div className="w-full mt-2">
            {recommendations.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-950/20 px-5 py-6 rounded-2xl border border-slate-150 dark:border-slate-800/40 text-center text-xs">
                Bu rapor metniyle doğrudan eşleşen bir mevzuat bulunamadı.
              </div>
            ) : (
              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                {recommendations.map((rec, i) => (
                  <div 
                    key={i} 
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-3"
                  >
                    <div>
                      <div className="font-black text-xs text-slate-800 dark:text-slate-200">
                        {rec.title}
                      </div>
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wider mt-0.5">
                        {rec.article}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40 p-2.5 rounded-xl font-medium italic leading-relaxed">
                      "{rec.snippet}"
                    </div>

                    <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold bg-indigo-50/60 dark:bg-indigo-950/20 px-2.5 py-2 rounded-xl border border-indigo-100/40 dark:border-indigo-900/20">
                      <span className="font-bold">Gerekçe:</span> {rec.relevance_reason}
                    </div>

                    <Button 
                      size="sm" 
                      onClick={() => handleInsert(rec)} 
                      className="self-end rounded-lg h-8 text-[10px] font-bold bg-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1"
                    >
                      <Plus size={12} /> Editöre Referans Ekle
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="w-full h-10 rounded-xl">Kapat</Button>
      </div>
    </div>
  );
}
