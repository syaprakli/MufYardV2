import { Plus, StickyNote, Trash2, Search, Pin, PinOff, Loader2, Lock, AlertCircle, Shield, ChevronRight, Share2, UserPlus } from "lucide-react";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { fetchNotes, createNote, updateNote, deleteNote, acceptNote, type Note } from "../lib/api/notes";
import ShareModal from "../components/ShareModal";

const NOTE_COLORS = [
    { id: 'amber', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-t-amber-500', text: 'text-amber-900 dark:text-amber-400', iconBg: 'bg-amber-200 dark:bg-amber-900/40' },
    { id: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-t-blue-500', text: 'text-blue-900 dark:text-blue-400', iconBg: 'bg-blue-200 dark:bg-blue-900/40' },
    { id: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-t-emerald-500', text: 'text-emerald-900 dark:text-emerald-400', iconBg: 'bg-emerald-200 dark:bg-emerald-900/40' },
    { id: 'rose', bg: 'bg-rose-100 dark:bg-rose-900/20', border: 'border-t-rose-500', text: 'text-rose-900 dark:text-rose-400', iconBg: 'bg-rose-300 dark:bg-rose-900/40' },
    { id: 'slate', bg: 'bg-muted/40', border: 'border-t-slate-500', text: 'text-slate-900 dark:text-slate-400', iconBg: 'bg-slate-200 dark:bg-slate-800' },
    { id: 'violet', bg: 'bg-violet-50 dark:bg-violet-900/10', border: 'border-t-violet-500', text: 'text-violet-900 dark:text-violet-400', iconBg: 'bg-violet-200 dark:bg-violet-900/40' },
];

export default function Notes() {
    const { user, loading: authLoading } = useAuth();
    const confirm = useConfirm();
    const [notes, setNotes] = useState<Note[]>([]);
    const [invitations, setInvitations] = useState<Note[]>([]);
    const [shareNote, setShareNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingNote, setEditingNote] = useState<Note | null>(null);


    const [newNote, setNewNote] = useState({ 
        title: "", 
        text: "", 
        is_pinned: false, 
        color: "amber", 
        priority: "normal", // normal | urgent
    });


    useEffect(() => {
        if (user?.uid) {
            loadNotes(user.uid);
        }
    }, [user, authLoading]);


    const loadNotes = async (uid: string) => {
        try {
            setLoading(true);
            const data = await fetchNotes(uid);
            const userEmail = user?.email?.toLowerCase();
            const userKeys = [uid, userEmail].filter(Boolean) as string[];
            
            const accepted = data.filter(n => 
                userKeys.includes(n.owner_id || '') || 
                (n.accepted_collaborators || []).some(value => userKeys.includes(value)) ||
                (n.shared_with || []).some(value => userKeys.includes(value))
            );
            
            const pending = data.filter(n => 
                (n.pending_collaborators || []).some(value => userKeys.includes(value)) &&
                !userKeys.includes(n.owner_id || '')
            );

            setNotes(accepted);
            setInvitations(pending);
        } catch (error) {
            console.error("Notlar yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.uid) return;

        try {
            if (editingNote) {
                await updateNote(editingNote.id, newNote);
            } else {
                await createNote({ ...newNote, owner_id: user.uid });
            }
            loadNotes(user.uid);
            setIsModalOpen(false);
            setEditingNote(null);
            setNewNote({ title: "", text: "", is_pinned: false, color: "amber", priority: "normal" });
            toast.success("Not başarıyla kaydedildi.");
        } catch (error) {
            console.error(error);
            toast.error("Not kaydedilemedi.");
        }
    };


    const handleTogglePin = async (id: string, currentPin: boolean) => {
        if (!user?.uid) return;
        try {
            await updateNote(id, { is_pinned: !currentPin });
            loadNotes(user.uid);
            toast.success(currentPin ? "İğne kaldırıldı." : "Not iğnelendi.");
        } catch (error) {
            toast.error("İğneleme işlemi başarısız.");
        }
    };


    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Notu Sil",
            message: "Bu notu silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        if (!user?.uid) return;
        try {
            await deleteNote(id);
            loadNotes(user.uid);
            toast.success("Not silindi.");
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        }
    };

    const handleAcceptInvitation = async (noteId: string) => {
        if (!user?.uid) return;
        try {
            await acceptNote(noteId, user.uid, user.email || undefined);
            toast.success("Not kabul edildi ve listenize eklendi.");
            loadNotes(user.uid);
        } catch (error) {
            toast.error("Not kabul edilemedi.");
        }
    };

    const handleShareUpdate = async (newSharedWith: string[]) => {
        if (!shareNote) return;
        try {
            await updateNote(shareNote.id, { pending_collaborators: newSharedWith });
            toast.success("Paylaşım davetleri gönderildi.");
            setShareNote(null);
            if (user?.uid) loadNotes(user.uid);
        } catch { toast.error("Paylaşım güncellenemedi."); }
    };


    const filteredNotes = notes.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              n.text.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });


    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 capitalize tracking-wide">Hızlı Notlar</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400">© 2025 MufYard Project • Sefa Yaprakli</p>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        Hızlı Notlar
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Denetim esnasında aldığınız pratik notları yönetin.</p>
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <Button onClick={() => {
                        setEditingNote(null);
                        setNewNote({ title: "", text: "", is_pinned: false, color: "amber", priority: "normal" });
                        setIsModalOpen(true);
                    }} className="h-12 px-6 shadow-lg shadow-primary/20 rounded-xl">
                        <Plus className="mr-2" size={20} /> Yeni Not Ekle
                    </Button>
                </div>

            </div>

            <div className="flex items-center gap-4">
                <div className="flex-1 bg-card border border-border dark:border-slate-800 rounded-xl px-5 py-3 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                    <Search size={18} className="text-muted-foreground dark:text-slate-500 mr-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Not başlığı veya içeriği ile ara..."
                        className="bg-transparent border-none outline-none text-sm w-full font-outfit font-medium dark:text-slate-200"
                    />
                </div>
            </div>

            {/* Bekleyen Not Davetleri */}
            {invitations.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mb-8 font-inter">
                    <div className="flex items-center gap-2 px-1 text-amber-600">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black tracking-widest font-outfit">Bekleyen Not Davetleri ({invitations.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex flex-col justify-between group hover:bg-amber-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg tracking-widest">Paylaşılan Not</span>
                                        <StickyNote size={14} className="text-amber-500" />
                                    </div>
                                    <h4 className="font-bold text-foreground dark:text-slate-100 text-sm mb-1">{inv.title}</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-4 italic flex items-center gap-1">
                                        <UserPlus size={10} /> Gönderen: {inv.owner_id}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleAcceptInvitation(inv.id)} 
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-10 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-amber-200/50 transition-all active:scale-95"
                                >
                                    Notu Kabul Et ve Listeye Ekle
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="mt-4 text-muted-foreground font-medium italic text-sm">Notlar yükleniyor...</p>
                </div>
            ) : filteredNotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredNotes.map(note => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onPin={() => handleTogglePin(note.id, note.is_pinned)}
                            onDelete={() => handleDelete(note.id)}
                            onShare={() => setShareNote(note)}
                            onClick={() => {
                                setEditingNote(note);
                                setNewNote({
                                    title: note.title,
                                    text: note.text,
                                    is_pinned: note.is_pinned,
                                    color: note.color,
                                    priority: (note as any).priority || 'normal',
                                });
                                setIsModalOpen(true);
                            }}
                        />
                    ))}
                </div>
            ) : (
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-5 border-dashed border-2 rounded-3xl bg-white/50 dark:bg-slate-900/50 border-border/50 dark:border-slate-800/50">
                    <StickyNote size={48} className="text-muted-foreground/30 dark:text-slate-700" />
                    <div>
                        <h3 className="text-xl font-bold text-primary dark:text-primary/90 font-outfit tracking-tight">Not Bulunmadı</h3>
                        <p className="text-muted-foreground dark:text-slate-400 mt-2 max-w-sm font-medium">Bu alanda henüz bir not bulunmuyor. Yeni bir not ekleyerek başlayabilirsiniz.</p>
                    </div>
                </Card>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingNote(null);
                }}
                title={editingNote ? "Notu Düzenle" : "Yeni Not Ekle"}
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary dark:text-slate-400 capitalize tracking-wide">Başlık</label>
                        <input 
                            required
                            className="w-full px-4 py-3 rounded-xl border border-border dark:border-slate-700 bg-card dark:text-slate-100 focus:ring-4 focus:ring-primary/5 outline-none font-outfit transition-all"
                            placeholder="Not başlığı..."
                            value={newNote.title}
                            onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary dark:text-slate-400 capitalize tracking-wide">Not İçeriği</label>
                        <textarea 
                            required
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-border dark:border-slate-700 bg-card dark:text-slate-100 focus:ring-4 focus:ring-primary/5 outline-none font-outfit resize-none transition-all"
                            placeholder="Not detaylarını buraya yazın..."
                            value={newNote.text}
                            onChange={(e) => setNewNote({...newNote, text: e.target.value})}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-secondary dark:text-slate-400 capitalize tracking-wide">Öncelik</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button 
                                    type="button"
                                    onClick={() => setNewNote({...newNote, priority: 'normal'})}
                                    className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-all", newNote.priority === 'normal' ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400")}
                                >Normal</button>
                                <button 
                                    type="button"
                                    onClick={() => setNewNote({...newNote, priority: 'urgent'})}
                                    className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-all", newNote.priority === 'urgent' ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400")}
                                >Acil</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary dark:text-slate-400 capitalize tracking-wide">Renk Seçimi</label>
                        <div className="flex gap-3 pt-1">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setNewNote({...newNote, color: c.id})}
                                    className={cn(
                                        "w-8 h-8 rounded-full border-4 transition-all hover:scale-110",
                                        c.bg.replace('50', '500').replace(' dark:bg-amber-900/10', '').replace(' dark:bg-blue-900/10', '').replace(' dark:bg-emerald-900/10', '').replace(' dark:bg-rose-900/20', '').replace(' dark:bg-slate-800/40', '').replace(' dark:bg-violet-900/10', ''),
                                        newNote.color === c.id ? "border-primary ring-2 ring-primary/20" : "border-white dark:border-slate-800"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input 
                            type="checkbox"
                            className="w-4 h-4 rounded border-border dark:border-slate-700 bg-card text-primary focus:ring-primary"
                            id="pinNote"
                            checked={newNote.is_pinned}
                            onChange={(e) => setNewNote({...newNote, is_pinned: e.target.checked})}
                        />
                        <label htmlFor="pinNote" className="text-xs font-bold text-secondary dark:text-slate-400 cursor-pointer">Sayfa Başına İğnele</label>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsModalOpen(false)}>İptal</Button>
                        <Button type="submit" className="flex-1 h-12 rounded-xl">{editingNote ? "Güncelle" : "Notu Kaydet"}</Button>
                    </div>
                </form>
            </Modal>
            
            {shareNote && (
                <ShareModal
                    isOpen={!!shareNote}
                    onClose={() => setShareNote(null)}
                    title="Notu Paylaş"
                    sharedWith={(shareNote as any).pending_collaborators || []}
                    onShare={handleShareUpdate}
                />
            )}
        </div>
    );
}

function NoteCard({ note, onPin, onDelete, onShare, onClick }: { note: Note, onPin: () => void, onDelete: () => void, onShare: () => void, onClick: () => void }) {
    const color = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
    const isUrgent = (note as any).priority === 'urgent';

    return (
        <Card 
            onClick={onClick}
            className={cn(
                "p-6 h-72 flex flex-col justify-between transition-all group relative border-t-8 shadow-md rounded-2xl cursor-pointer active:scale-95",
                color.border,
                note.is_pinned ? "scale-[1.03] ring-2 ring-primary/10 bg-card" : "hover:shadow-xl hover:scale-[1.01] bg-white/80 dark:bg-slate-900/80",
                color.bg
            )}
        >
            {isUrgent && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-rose-500 text-white rounded-full text-[10px] font-black capitalize tracking-wide shadow-lg flex items-center gap-1">
                    <AlertCircle size={10} /> Acil Not
                </div>
            )}

            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                    onClick={(e) => { e.stopPropagation(); onPin(); }} 
                    title={note.is_pinned ? "İğneyi Kaldır" : "İğnele"} 
                    className="p-1.5 bg-card hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-sm text-primary transition-all"
                >
                    {note.is_pinned ? <Pin size={16} className="fill-current" /> : <PinOff size={16} className="text-muted-foreground dark:text-slate-500" />}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onShare(); }} 
                    title="Paylaş" 
                    className="p-1.5 bg-card hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-sm text-blue-500 transition-all"
                >
                    <Share2 size={16} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="p-1.5 bg-card hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-sm text-rose-500 transition-all"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="overflow-hidden">
                <div className="flex items-center gap-3 mb-4 mt-2">
                    <div className={cn("p-2.5 rounded-xl", color.iconBg, color.text)}>
                        <StickyNote size={18} />
                    </div>
                    <h4 className="font-bold text-sm truncate pr-14 font-outfit capitalize tracking-tight text-primary dark:text-primary/90">{note.title}</h4>
                </div>
                <p className="text-[9px] text-slate-300 dark:text-slate-600 font-bold mt-1 tracking-widest uppercase">Daha İyi Denetimler İçin Sevgiyle Hazırlandı</p>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-6 leading-relaxed font-outfit font-medium italic px-1">
                    "{note.text}"
                </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 capitalize tracking-wide flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                    <Lock size={10} />
                    {new Date(note.created_at).toLocaleDateString('tr-TR')}
                </span>
                {note.is_pinned && <span className="text-primary dark:text-primary/90 flex items-center gap-1 font-black"><Pin size={10} /> SABİTLENDİ</span>}
            </div>

        </Card>
    );
}
