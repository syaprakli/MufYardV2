import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/Button";
import type { Task } from "../../lib/api/tasks";

type Props = {
    task: Task;
    analysisText: string;
    onClose: () => void;
    overlayStyle: React.CSSProperties;
    modalBoxStyle: React.CSSProperties;
};

export default function TaskAnalysisModal({
    task,
    analysisText,
    onClose,
    overlayStyle,
    modalBoxStyle
}: Props) {
    return createPortal(
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ ...modalBoxStyle, maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                    <div>
                        <h3 className="text-lg font-black font-outfit text-foreground dark:text-slate-100">Görev Durum Analizi</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{task.rapor_kodu}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>
                <pre className="bg-muted/40 border border-border rounded-xl p-4 text-[12px] leading-relaxed font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                    {analysisText}
                </pre>
                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            navigator.clipboard.writeText(analysisText);
                            toast.success("Analiz metni kopyalandı.");
                        }}
                    >
                        Kopyala
                    </Button>
                    <Button size="sm" onClick={onClose}>Kapat</Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
