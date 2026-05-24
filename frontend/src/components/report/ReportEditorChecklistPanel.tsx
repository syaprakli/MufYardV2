import { AlertTriangle, CheckCircle, ClipboardCheck, X } from "lucide-react";
import { Button } from "../ui/Button";

type ChecklistItem = {
    id: string;
    label: string;
    ok: boolean;
    critical: boolean;
    detail: string;
};

type ChecklistSummary = {
    passed: number;
    total: number;
    criticalFailures: number;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    summary: ChecklistSummary;
    items: ChecklistItem[];
    criticalFailureCount: number;
    onPrepareDelivery: () => void | Promise<void>;
};

export default function ReportEditorChecklistPanel({
    isOpen,
    onClose,
    summary,
    items,
    criticalFailureCount,
    onPrepareDelivery
}: Props) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-96 max-w-[92vw] bg-white shadow-2xl z-[101] border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
            <div className="p-5 border-b border-border flex items-start justify-between bg-slate-50">
                <div>
                    <h3 className="font-bold flex items-center gap-2"><ClipboardCheck size={18} className="text-primary" /> Teslim Öncesi Kontrol</h3>
                    <p className="text-[11px] text-slate-500 mt-1">{summary.passed}/{summary.total} kontrol tamam. {summary.criticalFailures === 0 ? "Teslime hazır." : `${summary.criticalFailures} kritik eksik var.`}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0">
                    <X size={16} />
                </Button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full transition-all ${summary.criticalFailures === 0 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${(summary.passed / summary.total) * 100}%` }} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {items.map((item) => (
                    <div key={item.id} className={`rounded-xl border p-3 ${item.ok ? "border-emerald-100 bg-emerald-50/60" : item.critical ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {item.ok ? <CheckCircle size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className={item.critical ? "text-rose-600" : "text-amber-600"} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[12px] font-black text-slate-800">{item.label}</p>
                                    {item.critical && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">Kritik</span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">{item.detail}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-slate-500">
                    {criticalFailureCount === 0 ? "Word çıktısı serbest." : "Kritik eksikler giderilmeden Word çıktısı alınamaz."}
                </div>
                <Button
                    onClick={onPrepareDelivery}
                    disabled={criticalFailureCount > 0}
                    className="h-9 px-4 text-[11px] font-black"
                >
                    Teslime Hazırla
                </Button>
            </div>
        </div>
    );
}
