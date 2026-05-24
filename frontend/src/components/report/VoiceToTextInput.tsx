import { useRef, useState } from "react";
import { Loader2, Mic, Square, Copy, Check, FilePlus } from "lucide-react";
import { toast } from "react-hot-toast";
import { API_URL as API_BASE_URL } from "../../lib/config";
import { auth } from "../../lib/firebase";

export default function VoiceToTextInput({ onResult }: { onResult: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStart = async () => {
    setError(null);
    setTranscriptionText(""); // Reset previous transcription text
    audioChunksRef.current = [];
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Tarayıcınız veya uygulamanız mikrofona erişimi desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop stream tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) {
          setError("Ses algılanamadı (çok kısa veya boş ses).");
          return;
        }

        await sendAudioToBackend(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200); // collect data every 200ms
      setRecording(true);
    } catch (err: any) {
      console.error("Mikrofon hatası:", err);
      setError("Mikrofona erişilemedi. Lütfen mikrofon izinlerini kontrol edin.");
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const sendAudioToBackend = async (audioBlob: Blob) => {
    setProcessing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice_note.webm");

      const token = await auth.currentUser?.getIdToken();

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/ai/transcribe`, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Ses çözümlenirken sunucu hatası oluştu.");
      }

      const data = await response.json();
      if (data.text) {
        setTranscriptionText(data.text);
        toast.success("Ses başarıyla metne çevrildi!");
      } else {
        setError("Ses deşifre edilemedi (boş yanıt).");
      }
    } catch (err: any) {
      console.error("Deşifre hatası:", err);
      setError(err.message || "Bağlantı hatası oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyAction = () => {
    if (!transcriptionText) return;
    navigator.clipboard.writeText(transcriptionText);
    setCopied(true);
    toast.success("Metin panoya kopyalandı.");
    setTimeout(() => setCopied(null as any), 2000);
  };

  const handleInsertAction = () => {
    if (!transcriptionText) return;
    onResult(transcriptionText);
    toast.success("Metin editöre aktarıldı!");
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full py-2">
      {/* Microphone Record Button */}
      <div className="relative">
        <button
          onClick={recording ? handleStop : handleStart}
          disabled={processing}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            recording 
              ? "bg-rose-500 hover:bg-rose-600 animate-pulse text-white shadow-lg shadow-rose-200" 
              : processing 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200"
          }`}
          title={recording ? "Kaydı Durdur" : "Konuşmaya Başla"}
        >
          {processing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : recording ? (
            <Square className="w-6 h-6 fill-white" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      <div className="text-center">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {recording 
            ? "Kaydediliyor... Durdurmak için tıklayın." 
            : processing 
              ? "Ses metne dönüştürülüyor..." 
              : "Butona basın ve konuşun."}
        </span>
      </div>

      {error && (
        <div className="text-center px-4">
          <span className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 px-3 py-1 rounded-xl border border-rose-100 dark:border-rose-900/30 block">
            {error}
          </span>
        </div>
      )}

      {/* Transcription Preview Area */}
      {transcriptionText && (
        <div className="w-full space-y-2 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Deşifre Edilen Metin (Düzenlenebilir)
            </label>
          </div>
          <textarea
            value={transcriptionText}
            onChange={(e) => setTranscriptionText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-violet-500 transition-all font-medium text-slate-700 dark:text-slate-200 resize-none"
            placeholder="Deşifre edilen metin..."
          />
          <div className="flex gap-2 w-full">
            {/* Copy Button */}
            <button
              onClick={handleCopyAction}
              className={`flex-1 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                copied 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-750"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
            {/* Insert to Editor Button */}
            <button
              onClick={handleInsertAction}
              className="flex-1 py-2 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <FilePlus size={14} /> Editöre Aktar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
