import { useRef, useState } from "react";
import { Button } from "../ui/Button";

export default function VoiceToTextInput({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const handleStart = () => {
    setError(null);
    if (!('webkitSpeechRecognition' in window)) {
      setError("Tarayıcınız sesli not özelliğini desteklemiyor.");
      return;
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setListening(false);
    };
    recognition.onerror = () => {
      setError("Ses algılanamadı veya hata oluştu.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleStop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={listening ? handleStop : handleStart} variant={listening ? "outline" : "primary"}>
        {listening ? "Durdur" : "Sesli Not Başlat"}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
