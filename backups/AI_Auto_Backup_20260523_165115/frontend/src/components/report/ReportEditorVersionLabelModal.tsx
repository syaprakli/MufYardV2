import { useState } from "react";
import { Button } from "../ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string) => void;
  initialLabel?: string;
}

const PRESET_LABELS = [
  "Taslak",
  "Nihai",
  "Düzenleme",
  "Gözden Geçirme",
  "Onaylı"
];

export default function ReportEditorVersionLabelModal({ isOpen, onClose, onSave, initialLabel = "" }: Props) {
  const [label, setLabel] = useState(initialLabel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 min-w-[320px]">
        <h3 className="text-lg font-bold mb-2">Sürüm Etiketi Seç / Gir</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_LABELS.map((preset) => (
            <Button
              key={preset}
              variant={label === preset ? "primary" : "outline"}
              onClick={() => setLabel(preset)}
              className="text-xs px-3 py-1 rounded-full"
            >
              {preset}
            </Button>
          ))}
        </div>
        <input
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Özel etiket girin..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="outline">Vazgeç</Button>
          <Button onClick={() => { if (label.trim()) onSave(label.trim()); }} disabled={!label.trim()}>Kaydet</Button>
        </div>
      </div>
    </div>
  );
}
