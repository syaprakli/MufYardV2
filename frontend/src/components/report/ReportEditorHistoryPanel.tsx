import { Clock, History, X, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "../ui/Button";
import type { AuditVersion } from "../../lib/api/audit";
import { useState } from "react";

type VersionStatMap = Record<string, { changedChars: number; changedLines: number }>;

type Props = {
    isOpen: boolean;
    onClose: () => void;
    versions: AuditVersion[];
    versionChangeStats: VersionStatMap;
    onRestoreVersion: (versionId: string) => void | Promise<void>;
    onOpenDiff: (version: AuditVersion) => void;
    onDeleteVersions?: (versionIds: string[]) => void | Promise<void>;
};

export default function ReportEditorHistoryPanel({
    isOpen,
    onClose,
    versions,
    versionChangeStats,
    onRestoreVersion,
    onOpenDiff,
    onDeleteVersions
}: Props) {
    const [selected, setSelected] = useState<string[]>([]);
    const allSelected = versions.length > 0 && selected.length === versions.length;

    if (!isOpen) return null;

    const toggleSelect = (id: string) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };
    const toggleSelectAll = () => {
        if (allSelected) setSelected([]);
        else setSelected(versions.map((v) => v.id));
    };
    const handleDeleteSelected = () => {
        if (onDeleteVersions && selected.length > 0) {
            onDeleteVersions(selected);
            setSelected([]);
        }
    };

    return (
        <div className="fixed lg:relative inset-y-0 right-0 lg:inset-auto lg:h-full w-80 bg-white shadow-2xl lg:shadow-none z-[100] lg:z-10 border-l border-border flex flex-col animate-in slide-in-from-right-10 duration-300">
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50">
                <h3 className="font-bold flex items-center gap-2"><History size={18} className="text-primary" /> Sürüm Geçmişi</h3>
                <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0">
                    <X size={16} />
                </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                <button onClick={toggleSelectAll} className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-primary">
                    {allSelected ? <CheckSquare size={16} /> : <Square size={16} />} Tümünü Seç
                </button>
                <Button
                    variant="error"
                    size="sm"
                    disabled={selected.length === 0}
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 h-7 text-xs rounded-lg"
                >
                    <Trash2 size={14} /> Seçiliyi Sil
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {versions.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground mt-10 italic">Henüz bir sürüm kaydı bulunmuyor.</p>
                ) : (
                    versions.map((v, i) => (
                        <div key={v.id} className={`p-4 rounded-xl border ${i === 0 ? "bg-primary/5 border-primary/20" : "bg-white hover:border-slate-300"} cursor-pointer group transition-all relative`}>
                            <button
                                type="button"
                                onClick={() => toggleSelect(v.id)}
                                className={`absolute left-2 top-2 z-10 p-1 rounded ${selected.includes(v.id) ? "bg-primary/10" : "bg-slate-100"}`}
                                title={selected.includes(v.id) ? "Seçimi kaldır" : "Seç"}
                            >
                                {selected.includes(v.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-slate-400" />}
                            </button>
                            <div className="flex items-center justify-between mb-2 pl-7">
                                <span className="font-bold text-sm text-primary">{v.version_name}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2 pl-7">Kaydeden: <span className="font-semibold text-slate-700">{v.user}</span></p>
                            {versionChangeStats[v.id] && (
                                <p className="text-[11px] text-slate-500 mb-2 pl-7">
                                    Mini geçmiş: {versionChangeStats[v.id].changedLines} satır, ~{versionChangeStats[v.id].changedChars.toLocaleString("tr-TR")} karakter değişti
                                </p>
                            )}
                            <div className="pl-7">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onRestoreVersion(v.id)}
                                    className="w-full h-7 text-xs rounded-lg mt-1"
                                >
                                    Bu Sürüme Dön
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onOpenDiff(v)}
                                    className="w-full h-7 text-xs rounded-lg mt-1 text-slate-600 hover:text-slate-900"
                                >
                                    Farkı Gör
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
