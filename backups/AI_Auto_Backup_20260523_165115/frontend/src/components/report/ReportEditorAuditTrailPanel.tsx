import { useEffect, useState } from "react";
import { fetchAuditTrail, type AuditTrailEntry } from "../../lib/api/auditTrail";
import { Loader2, History } from "lucide-react";

interface Props {
    auditId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportEditorAuditTrailPanel({ auditId, isOpen, onClose }: Props) {
    const [loading, setLoading] = useState(false);
    const [entries, setEntries] = useState<AuditTrailEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setError(null);
        fetchAuditTrail(auditId)
            .then(setEntries)
            .catch((err) => setError(err.message || "Geçmiş yüklenemedi."))
            .finally(() => setLoading(false));
    }, [auditId, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-xl font-bold">×</button>
                <div className="flex items-center gap-2 mb-4">
                    <History size={20} className="text-blue-600" />
                    <h2 className="font-bold text-lg text-blue-700 dark:text-blue-200">Değişiklik Geçmişi</h2>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin" size={24} /></div>
                ) : error ? (
                    <div className="text-red-500 text-sm py-8">{error}</div>
                ) : entries.length === 0 ? (
                    <div className="text-gray-500 text-sm py-8">Kayıtlı değişiklik bulunamadı.</div>
                ) : (
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {entries.map((entry) => (
                            <div key={entry.id} className="py-2 px-1">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-bold text-blue-700 dark:text-blue-300">{entry.user}</span>
                                    <span className="text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString("tr-TR")}</span>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    <span className="font-bold">{entry.action}</span>
                                    {entry.details && <span className="ml-2">{entry.details}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
