import { useMemo } from "react";
import { Archive, CheckCircle2, Clock, Download, Edit3, FileText, MapPin, RotateCcw, Share2, Shield, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";
import { updateTask, type Task } from "../../lib/api/tasks";
import type { Audit as AuditType } from "../../lib/api/audit";
import { VirtualizedList } from "../ui/VirtualizedList";
import { useConfirm } from "../../lib/context/ConfirmContext";

const RAPOR_DURUMLARI = ["Başlanmadı", "Devam Ediyor", "İncelemede", "Tamamlandı"];

type AuditListProps = {
  audits: AuditType[];
  tasks: Task[];
  currentUserKeys: string[];
  selectedIds: string[];
  isElectron: boolean;
  onToggleSelect: (auditId: string) => void;
  onExportWord: (auditId: string) => void;
  onEdit: (auditId: string) => void;
  onUpdate: (id: string, updates: Partial<AuditType>) => Promise<void> | void;
  onDelete: (auditId: string) => void;
  onShare: (auditId: string) => void;
  onRefresh: () => Promise<void> | void;
};

export default function AuditList({
  audits,
  tasks,
  currentUserKeys,
  isElectron,
  selectedIds,
  onToggleSelect,
  onExportWord,
  onEdit,
  onUpdate,
  onDelete,
  onShare,
  onRefresh,
}: AuditListProps) {
  const taskById = useMemo(() => new Map(tasks.map((task) => [String(task.id).trim(), task])), [tasks]);


  return (
    <VirtualizedList
      items={audits}
      itemKey={(audit) => audit.id}
      estimatedItemHeight={230}
      minCountToVirtualize={10}
      className="max-h-[78vh] overflow-y-auto pr-1"
      itemClassName="space-y-4"
      emptyState={null}
      renderItem={(audit) => {
        const t = taskById.get(String(audit.task_id).trim());
        const hasFinalCode = t && t.rapor_kodu && t.rapor_kodu.includes("S.Y.64/");
        const resolvedTitle = hasFinalCode
          ? (audit.report_seq && audit.report_seq > 1 ? `${t.rapor_kodu} - ${audit.report_seq}` : t.rapor_kodu)
          : audit.title;
        return (
          <AuditListItem
            audit={audit}
            currentUserKeys={currentUserKeys}
            task={t}
            resolvedTitle={resolvedTitle}
            isSelected={selectedIds.includes(audit.id)}
            isElectron={isElectron}
            onToggleSelect={() => onToggleSelect(audit.id)}
            onExportWord={() => onExportWord(audit.id)}
            onEdit={() => onEdit(audit.id)}
            onUpdate={onUpdate}
            onDelete={() => onDelete(audit.id)}
            onShare={() => onShare(audit.id)}
            onRefresh={onRefresh}
          />
        );
      }}
    />
  );
}

function AuditListItem({
  audit,
  currentUserKeys,
  task,
  resolvedTitle,
  isSelected,
  isElectron,
  onToggleSelect,
  onExportWord,
  onEdit,
  onUpdate,
  onDelete,
  onShare,
  onRefresh,
}: {
  audit: AuditType;
  currentUserKeys: string[];
  task?: Task;
  resolvedTitle: string;
  isSelected: boolean;
  isElectron: boolean;
  onToggleSelect: () => void;
  onExportWord: () => void;
  onEdit: () => void;
  onUpdate: (id: string, updates: Partial<AuditType>) => Promise<void> | void;
  onDelete: () => void;
  onShare: () => void;
  onRefresh: () => Promise<void> | void;
}) {
  const { date, status, inspector, location } = audit;
  const confirm = useConfirm();
  const statusColors: Record<string, string> = {
    "Başlanmadı": "bg-slate-500/10 text-slate-600 border-slate-500/20",
    "Devam Ediyor": "bg-blue-500/10 text-blue-600 border-blue-500/20",
    "İncelemede": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    "Tamamlandı": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  };

  const resolvedRole = (() => {
    const normalizedUserKeys = currentUserKeys.map((k) => String(k).toLowerCase());
    const owner = String((audit as any).owner_id || "").toLowerCase();
    if (owner && normalizedUserKeys.includes(owner)) return "owner";

    const sharedRoles = ((audit as any).shared_roles || {}) as Record<string, "view" | "comment" | "edit">;
    const roleByKey = Object.entries(sharedRoles).find(([k]) => normalizedUserKeys.includes(String(k).toLowerCase()));
    if (roleByKey?.[1]) return roleByKey[1];

    const sharedWith = (((audit as any).shared_with || []) as string[]).map((k) => String(k).toLowerCase());
    if (normalizedUserKeys.some((k) => sharedWith.includes(k))) return "edit";

    const pending = (((audit as any).pending_collaborators || []) as string[]).map((k) => String(k).toLowerCase());
    if (normalizedUserKeys.some((k) => pending.includes(k))) return "pending";

    return "none";
  })();

  const roleBadge = {
    owner: { label: "Sahip", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    edit: { label: "Düzenle", className: "bg-blue-100 text-blue-700 border-blue-200" },
    comment: { label: "Yorumla", className: "bg-amber-100 text-amber-700 border-amber-200" },
    view: { label: "Görüntüle", className: "bg-slate-100 text-slate-700 border-slate-200" },
    pending: { label: "Davet", className: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
    none: { label: "", className: "" },
  }[resolvedRole as "owner" | "edit" | "comment" | "view" | "pending" | "none"];

  return (
    <Card
      className={cn(
        "p-4 md:p-6 transition-all group shadow-sm bg-card border-border/60 rounded-2xl relative",
        isSelected ? "border-red-500/50 ring-2 ring-red-500/20" : "hover:border-primary/50 hover:shadow-xl"
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none hidden md:block">
        <div className="absolute top-0 right-0 w-24 h-full bg-primary/5 -skew-x-12 translate-x-12 group-hover:translate-x-6 transition-transform opacity-50" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 relative z-10 w-full">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center z-20 cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                title="Seç"
                checked={isSelected}
                onChange={onToggleSelect}
                className="w-5 h-5 rounded-md border-slate-300 text-red-500 cursor-pointer shadow-sm focus:ring-red-500"
              />
            </div>
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-muted flex items-center justify-center text-primary/40 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6 shadow-inner shrink-0">
              <FileText size={28} className="md:hidden" />
              <FileText size={32} className="hidden md:block" />
            </div>
          </div>
          <div className="md:hidden">
            <select
              value={task?.rapor_durumu || status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                try {
                  if (task) {
                    const currentCode = task.rapor_kodu || "";
                    const isDraft = !currentCode || currentCode.startsWith("TASLAK-");
                    if ((newStatus === "İncelemede" || newStatus === "Tamamlandı") && isDraft) {
                      const confirmed = await confirm({
                        title: "Rapor Kodu Oluşturulacak",
                        message: "Bu görevi ilk kez 'İncelemede' veya 'Tamamlandı' aşamasına aldığınızda resmi Rapor Kodu (Görev No) üretilecektir. Daha sonra bu işlemi geri alsanız dahi atanan Rapor Kodu korunacaktır. Devam etmek istiyor musunuz?",
                        confirmText: "Devam Et",
                        cancelText: "İptal",
                        variant: "warning"
                      });
                      if (!confirmed) {
                        await onRefresh();
                        return;
                      }
                    }
                    await updateTask(task.id, { rapor_durumu: newStatus });
                    toast.success("Görev durumu güncellendi.");
                  } else {
                    await onUpdate(audit.id, { status: newStatus });
                  }
                  await onRefresh();
                } catch {
                  toast.error("Durum güncellenemedi.");
                }
              }}
              className={cn(
                "px-2 py-1.5 rounded-lg text-[9px] font-black tracking-widest border shadow-sm outline-none bg-transparent",
                statusColors[task?.rapor_durumu || status] || "bg-slate-100 text-slate-500"
              )}
            >
              {RAPOR_DURUMLARI.map((d) => (
                <option key={d} value={d} className="text-slate-900 bg-white">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
            <h4 className="font-bold text-xs md:text-sm text-secondary group-hover:text-primary transition-colors font-outfit tracking-tight truncate">
              {resolvedTitle}
            </h4>
            {roleBadge.label && (
              <span className={cn("w-fit px-2 py-0.5 text-[9px] md:text-[10px] font-black rounded-lg border uppercase tracking-widest whitespace-nowrap", roleBadge.className)}>
                {roleBadge.label}
              </span>
            )}
            {task && task.rapor_kodu && !task.rapor_kodu.startsWith("TASLAK-") && (
              <span className="w-fit px-2 py-0.5 bg-primary/5 text-primary text-[9px] md:text-[10px] font-black rounded-lg border border-primary/10 uppercase tracking-widest whitespace-nowrap">
                Görev: {task.rapor_kodu}
                {audit.report_seq && audit.report_seq > 1 ? `-${audit.report_seq}` : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-primary/60" /> {date}
            </span>
            <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-border" />
            <span className="flex items-center gap-1.5">
              <Shield size={12} className="text-primary/60" /> {inspector}
            </span>
            {location && location !== "Merkez / Yerinde" && location !== "Merkez / Yerinde " && (
              <>
                <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-border" />
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-primary/60" /> {location}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-border/40 w-full md:w-auto">
          <select
            value={task?.rapor_durumu || status}
            onChange={async (e) => {
              const newStatus = e.target.value;
              try {
                if (task) {
                  const currentCode = task.rapor_kodu || "";
                  const isDraft = !currentCode || currentCode.startsWith("TASLAK-");
                  if ((newStatus === "İncelemede" || newStatus === "Tamamlandı") && isDraft) {
                    const confirmed = await confirm({
                      title: "Rapor Kodu Oluşturulacak",
                      message: "Bu görevi ilk kez 'İncelemede' veya 'Tamamlandı' aşamasına aldığınızda resmi Rapor Kodu (Görev No) üretilecektir. Daha sonra bu işlemi geri alsanız dahi atanan Rapor Kodu korunacaktır. Devam etmek istiyor musunuz?",
                      confirmText: "Devam Et",
                      cancelText: "İptal",
                      variant: "warning"
                    });
                    if (!confirmed) {
                      await onRefresh();
                      return;
                    }
                  }
                  await updateTask(task.id, { rapor_durumu: newStatus });
                  toast.success("Görev durumu güncellendi.");
                } else {
                  await onUpdate(audit.id, { status: newStatus });
                }
                await onRefresh();
              } catch {
                toast.error("Durum güncellenemedi.");
              }
            }}
            className={cn(
              "hidden md:block px-5 py-2 rounded-xl text-[10px] font-bold tracking-[0.1em] border shadow-sm outline-none cursor-pointer hover:bg-slate-50 transition-colors",
              statusColors[task?.rapor_durumu || status] || "bg-slate-100 text-slate-500"
            )}
          >
            {RAPOR_DURUMLARI.map((d) => (
              <option key={d} value={d} className="text-slate-900 bg-white">
                {d}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(audit as any).file_url ? () => window.open((audit as any).file_url, "_blank") : onEdit}
                className={cn(
                  "w-10 h-10 rounded-xl",
                  (audit as any).file_url
                    ? "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title={(audit as any).file_url ? "Dosyayı Aç" : "Düzenle"}
              >
                {(audit as any).file_url ? <Download size={18} /> : <Edit3 size={18} />}
              </Button>
              {isElectron && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onExportWord}
                  className="w-10 h-10 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                  title="Word olarak indir"
                >
                  <Download size={18} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onShare}
                className="w-10 h-10 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                title="Kişilerle Paylaş"
              >
                <Share2 size={18} />
              </Button>
              {!task && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onUpdate(audit.id, { status: status === "Devam Ediyor" ? "Tamamlandı" : "Devam Ediyor" })}
                  className={cn(
                    "w-10 h-10 rounded-xl",
                    status === "Devam Ediyor"
                      ? "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                      : "text-emerald-500 hover:text-orange-500 hover:bg-orange-50"
                  )}
                  title={status === "Devam Ediyor" ? "Tamamlandı Yap" : "Devam Ediyor Yap"}
                >
                  {status === "Devam Ediyor" ? <CheckCircle2 size={18} /> : <RotateCcw size={18} />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdate(audit.id, { is_public: !(audit as any).is_public })}
                className="w-10 h-10 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-xl"
                title={(audit as any).is_public ? "Arşivden Çıkar" : "Arşive Ekle"}
              >
                <Archive size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="w-10 h-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl"
                title="Kaydı Sil"
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
