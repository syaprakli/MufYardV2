import { useState } from "react";
import { Button } from "../ui/Button";

export type ProofreadResult = {
  matches: Array<{
    message: string;
    offset: number;
    length: number;
    replacements: string[];
    context: { text: string; offset: number; length: number };
  }>;
};

export default function ReportEditorProofreadPanel({
  content,
  onClose,
}: {
  content: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("https://api.languagetoolplus.com/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text: content,
          language: "tr-TR",
        }),
      });
      if (!res.ok) throw new Error("Dil kontrol servisine ulaşılamadı.");
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 min-w-[340px] max-w-[90vw] max-h-[90vh] overflow-auto">
        <h3 className="text-lg font-bold mb-2">Yazım ve Dil Kontrolü</h3>
        <Button onClick={handleCheck} disabled={loading} className="mb-2">
          {loading ? "Kontrol Ediliyor..." : "Dil Kontrolü Başlat"}
        </Button>
        {error && <div className="text-red-600 text-xs font-bold">{error}</div>}
        {result && (
          <div className="w-full max-w-md">
            {result.matches.length === 0 ? (
              <div className="text-green-700 font-bold">Hata bulunamadı!</div>
            ) : (
              <ul className="space-y-2">
                {result.matches.map((m, i) => (
                  <li key={i} className="border-b pb-2">
                    <div className="font-bold text-sm text-rose-700">{m.message}</div>
                    <div className="text-xs text-slate-600">
                      <span className="font-mono bg-yellow-100 px-1 rounded">
                        {m.context.text.substring(
                          Math.max(0, m.context.offset - 15),
                          m.context.offset
                        )}
                        <b className="bg-rose-100 px-1 rounded">
                          {m.context.text.substr(m.context.offset, m.context.length)}
                        </b>
                        {m.context.text.substring(
                          m.context.offset + m.context.length,
                          m.context.offset + m.context.length + 15
                        )}
                      </span>
                    </div>
                    {m.replacements.length > 0 && (
                      <div className="text-xs text-emerald-700 mt-1">
                        Öneriler: {m.replacements.join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Button variant="outline" onClick={onClose} className="mt-2">Kapat</Button>
      </div>
    </div>
  );
}
