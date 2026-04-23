import { Plus, StickyNote, Trash2, Search, Pin, PinOff, Loader2, Lock, AlertCircle, Shield, ChevronRight } from "lucide-react";
import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { fetchNotes, createNote, updateNote, deleteNote, type Note } from "../lib/api/notes";

const NOTE_COLORS = [
    { id: 'amber', bg: 'bg-amber-50', border: 'border-t-amber-500', text: 'text-amber-900', iconBg: 'bg-amber-200' },
    { id: 'blue', bg: 'bg-blue-50', border: 'border-t-blue-500', text: 'text-blue-900', iconBg: 'bg-blue-200' },
    { id: 'emerald', bg: 'bg-emerald-50', border: 'border-t-emerald-500', text: 'text-emerald-900', iconBg: 'bg-emerald-200' },
    { id: 'rose', bg: 'bg-rose-100', border: 'border-t-rose-500', text: 'text-rose-900', iconBg: 'bg-rose-300' },
    { id: 'slate', bg: 'bg-slate-50', border: 'border-t-slate-500', text: 'text-slate-900', iconBg: 'bg-slate-200' },
    { id: 'violet', bg: 'bg-violet-50', border: 'border-t-violet-500', text: 'text-violet-900', iconBg: 'bg-violet-200' },
];

export default function Notes() {
    const { user, loading: authLoading } = useAuth();
    const confirm = useConfirm();
    const [notes, setNotes] = useState<Note[]>([]);
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
            setNotes(data);
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
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        Hızlı Notlar
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Denetim esnasında aldığınız pratik notları yönetin.</p>
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
                <div className="flex-1 bg-white border border-border rounded-xl px-5 py-3 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/5 transition-all">
                    <Search size={18} className="text-muted-foreground mr-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Not başlığı veya içeriği ile ara..."
                        className="bg-transparent border-none outline-none text-sm w-full font-outfit font-medium"
                    />
                </div>
            </div>

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
                <Card className="p-20 flex flex-col items-center justify-center text-center space-y-5 border-dashed border-2 rounded-3xl bg-white/50 border-border/50">
                    <StickyNote size={48} className="text-muted-foreground/30" />
                    <div>
                        <h3 className="text-xl font-bold text-primary font-outfit tracking-tight">Not Bulunmadı</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm font-medium">Bu alanda henüz bir not bulunmuyor. Yeni bir not ekleyerek başlayabilirsiniz.</p>
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
                        <label className="text-[10px] font-bold text-secondary capitalize tracking-wide">Başlık</label>
                        <input 
                            required
                            className="w-full px-4 py-3 rounded-xl border border-border focus:ring-4 focus:ring-primary/5 outline-none font-outfit"
                            placeholder="Not başlığı..."
                            value={newNote.title}
                            onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary capitalize tracking-wide">Not İçeriği</label>
                        <textarea 
                            required
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border border-border focus:ring-4 focus:ring-primary/5 outline-none font-outfit resize-none"
                            placeholder="Not detaylarını buraya yazın..."
                            value={newNote.text}
                            onChange={(e) => setNewNote({...newNote, text: e.target.value})}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-secondary capitalize tracking-wide">Öncelik</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button 
                                    type="button"
                                    onClick={() => setNewNote({...newNote, priority: 'normal'})}
                                    className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-all", newNote.priority === 'normal' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                                >Normal</button>
                                <button 
                                    type="button"
                                    onClick={() => setNewNote({...newNote, priority: 'urgent'})}
                                    className={cn("flex-1 py-1.5 text-xs font-bold rounded-md transition-all", newNote.priority === 'urgent' ? "bg-rose-500 text-white shadow-sm" : "text-slate-500")}
                                >Acil</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-secondary capitalize tracking-wide">Renk Seçimi</label>
                        <div className="flex gap-3 pt-1">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setNewNote({...newNote, color: c.id})}
                                    className={cn(
                                        "w-8 h-8 rounded-full border-4 transition-all hover:scale-110",
                                        c.bg.replace('50', '500'),
                                        newNote.color === c.id ? "border-primary ring-2 ring-primary/20" : "border-white"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input 
                            type="checkbox"
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            id="pinNote"
                            checked={newNote.is_pinned}
                            onChange={(e) => setNewNote({...newNote, is_pinned: e.target.checked})}
                        />
                        <label htmlFor="pinNote" className="text-xs font-bold text-secondary cursor-pointer">Sayfa Başına İğnele</label>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsModalOpen(false)}>İptal</Button>
                        <Button type="submit" className="flex-1 h-12 rounded-xl">{editingNote ? "Güncelle" : "Notu Kaydet"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

function NoteCard({ note, onPin, onDelete, onClick }: { note: Note, onPin: () => void, onDelete: () => void, onClick: () => void }) {
    const color = NOTE_COLORS.find(c => c.id === note.color) || NOTE_COLORS[0];
    const isUrgent = (note as any).priority === 'urgent';

    return (
        <Card 
            onClick={onClick}
            className={cn(
                "p-6 h-72 flex flex-col justify-between transition-all group relative border-t-8 shadow-md rounded-2xl cursor-pointer active:scale-95",
                color.border,
                note.is_pinned ? "scale-[1.03] ring-2 ring-primary/10 bg-white" : "hover:shadow-xl hover:scale-[1.01] bg-white/80"
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
                    className="p-1.5 hover:bg-white rounded-full shadow-sm text-primary"
                >
                    {note.is_pinned ? <Pin size={16} className="fill-current" /> : <PinOff size={16} className="text-muted-foreground" />}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="p-1.5 hover:bg-white rounded-full shadow-sm text-rose-500"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="overflow-hidden">
                <div className="flex items-center gap-3 mb-4 mt-2">
                    <div className={cn("p-2.5 rounded-xl", color.iconBg, color.text)}>
                        <StickyNote size={18} />
                    </div>
                    <h4 className="font-bold text-sm truncate pr-14 font-outfit capitalize tracking-tight text-primary">{note.title}</h4>
                </div>
                <p className="text-[9px] text-slate-300 font-bold mt-1 tracking-widest uppercase">Daha İyi Denetimler İçin Sevgiyle Hazırlandı</p>
                <p className="text-[13px] text-slate-600 line-clamp-6 leading-relaxed font-outfit font-medium italic px-1">
                    "{note.text}"
                </p>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[9px] font-black text-slate-400 capitalize tracking-wide flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                    <Lock size={10} />
                    {new Date(note.created_at).toLocaleDateString('tr-TR')}
                </span>
                {note.is_pinned && <span className="text-primary flex items-center gap-1 font-black"><Pin size={10} /> SABİTLENDİ</span>}
            </div>

        </Card>
    );
}
