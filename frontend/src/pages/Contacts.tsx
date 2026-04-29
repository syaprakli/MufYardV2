import { Search, MapPin, Phone, Mail, User, Plus, Share2, Trash2, Loader2, Shield, ChevronRight, Edit2, MessageSquare } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchContacts, createContact, shareContact, deleteContact, updateContact, type Contact } from "../lib/api/contacts";
import { useChat } from "../lib/context/ChatContext";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";

export default function Contacts() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<"corporate" | "personal">("personal");
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    
    const cacheRef = useRef<Record<string, Contact[]>>({});
    const { openChat } = useChat();
    const [newContact, setNewContact] = useState({
        name: "",
        title: "",
        unit: "",
        phone: "",
        email: "",
        tagsString: "",
        is_shared: false
    });

    useEffect(() => {
        if (cacheRef.current[activeTab]) {
            setContacts(cacheRef.current[activeTab]);
            setLoading(false);
            loadContacts(true); 
        } else {
            loadContacts();
        }
    }, [activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadContacts = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const data = await fetchContacts(activeTab, user?.uid);
            const validData = Array.isArray(data) ? data : [];
            setContacts(validData);
            cacheRef.current[activeTab] = validData;
        } catch (error) {
            setContacts([]);
            toast.error("İletişim bilgileri yüklenemiyor.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        try {
            const tags = newContact.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
            await createContact({
                ...newContact,
                tags,
                owner_id: user.uid
            });
            setIsModalOpen(false);
            setNewContact({ name: "", title: "", unit: "", phone: "", email: "", tagsString: "", is_shared: false });
            toast.success("Kişi oluşturuldu.");
            loadContacts();
        } catch {
            toast.error("Hata oluştu.");
        }
    };

    const handleUpdateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !editingContact) return;
        try {
            const tags = newContact.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
            await updateContact(editingContact.id, user.uid, {
                ...newContact,
                tags,
                owner_id: editingContact.owner_id
            });
            setIsModalOpen(false);
            setEditingContact(null);
            setNewContact({ name: "", title: "", unit: "", phone: "", email: "", tagsString: "", is_shared: false });
            toast.success("Güncellendi.");
            loadContacts();
        } catch {
            toast.error("Hata oluştu.");
        }
    };

    const handleShare = async (id: string) => {
        const confirmed = await confirm({
            title: "Rehberde Paylaş",
            message: "Bu kişiyi kurumsal rehberde paylaşmak istediğinize emin misiniz?",
            confirmText: "Paylaş",
            variant: "info"
        });
        if (confirmed) {
            try {
                await shareContact(id, user!.uid);
                toast.success("Paylaşıldı.");
                loadContacts();
            } catch {
                toast.error("Hata oluştu.");
            }
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Kişiyi Sil",
            message: "Bu kişiyi silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (confirmed) {
            try {
                await deleteContact(id, user!.uid);
                toast.success("Silindi.");
                loadContacts();
            } catch {
                toast.error("Hata oluştu.");
            }
        }
    };

    const sortedContacts = useMemo(() => {
        const filtered = contacts.filter(c => {
            const normalize = (s: string) => s.toLowerCase().trim();
            const normSearch = normalize(debouncedSearch);
            if (!normSearch) return true;
            return normalize(c.name).includes(normSearch) || 
                   normalize(c.unit).includes(normSearch) || 
                   normalize(c.title).includes(normSearch);
        });
        return filtered.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }, [contacts, debouncedSearch]);


    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 font-outfit">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary">Kurumsal Rehber</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">{activeTab === "corporate" ? "Bakanlık Rehberi" : "Kişisel Rehberim"}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-muted p-1 rounded-xl h-11">
                        <button onClick={() => setActiveTab("personal")} className={cn("px-6 rounded-lg text-xs font-bold transition-all", activeTab === "personal" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Kişisel</button>
                        <button onClick={() => setActiveTab("corporate")} className={cn("px-6 rounded-lg text-xs font-bold transition-all", activeTab === "corporate" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>Kurumsal</button>
                    </div>
                    <Button onClick={() => { setEditingContact(null); setIsModalOpen(true); }} className="h-11 rounded-xl bg-primary text-white font-black px-6"><Plus size={18} className="mr-2" /> EKLE</Button>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center shadow-sm">
                    <Search size={18} className="text-slate-400 mr-3" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="İsim veya birim ile ara..." className="bg-transparent border-none outline-none text-[15px] w-full font-outfit" />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
            ) : (
                <div className="space-y-12">
                    {activeTab === "corporate" ? (
                        // Kurumsal Rehber için Gruplandırılmış Görünüm
                        Object.entries(
                            sortedContacts.reduce((acc: any, contact) => {
                                // Öncelik: Birim (unit) -> Ünvan (title) -> Diğer
                                let group = contact.unit || contact.title || "Diğer";
                                
                                // Özel kural: Eğer ünvan "Başkan" içeriyorsa "Başkanlık" grubuna koy
                                if (group.toLowerCase().includes("başkan") && !group.toLowerCase().includes("başmüfettiş")) {
                                    group = "Başkanlık";
                                }
                                
                                if (!acc[group]) acc[group] = [];
                                acc[group].push(contact);
                                return acc;
                            }, {})
                        ).sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([unit, unitContacts]: any) => (
                            <div key={unit} className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">{unit}</h2>
                                    <div className="h-[1px] w-full bg-slate-100 dark:bg-slate-800" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {unitContacts.map((contact: any) => (
                                        <ContactCard key={contact.id} contact={contact} isOwner={contact.owner_id === user?.uid} onEdit={() => { setEditingContact(contact); setNewContact({ ...contact, tagsString: contact.tags?.join(', ') || "" }); setIsModalOpen(true); }} onShare={() => handleShare(contact.id)} onDelete={() => handleDelete(contact.id)} onChat={() => openChat(["dm", ...[user!.uid, contact.id].sort()].join("_"), contact.name, "dm")} />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        // Kişisel Rehber için Düz Görünüm
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {sortedContacts.map(contact => (
                                <ContactCard key={contact.id} contact={contact} isOwner={contact.owner_id === user?.uid} onEdit={() => { setEditingContact(contact); setNewContact({ ...contact, tagsString: contact.tags?.join(', ') || "" }); setIsModalOpen(true); }} onShare={() => handleShare(contact.id)} onDelete={() => handleDelete(contact.id)} onChat={() => openChat(["dm", ...[user!.uid, contact.id].sort()].join("_"), contact.name, "dm")} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingContact ? "Düzenle" : "Ekle"}>
                <form onSubmit={editingContact ? handleUpdateContact : handleCreateContact} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-secondary uppercase">Ad Soyad</label>
                        <input required className="w-full px-4 py-3 rounded-xl border border-border outline-none" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase">Ünvan</label>
                            <input required className="w-full px-4 py-3 rounded-xl border border-border outline-none" value={newContact.title} onChange={e => setNewContact({...newContact, title: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase">Birim</label>
                            <input required className="w-full px-4 py-3 rounded-xl border border-border outline-none" value={newContact.unit} onChange={e => setNewContact({...newContact, unit: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase">Telefon</label>
                            <input required className="w-full px-4 py-3 rounded-xl border border-border outline-none" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase">E-Posta</label>
                            <input required type="email" className="w-full px-4 py-3 rounded-xl border border-border outline-none" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>İptal</Button>
                        <Button type="submit" className="flex-1 bg-primary text-white">Kaydet</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

interface ContactCardProps {
    contact: Contact;
    isOwner: boolean;
    onEdit: () => void;
    onShare: () => void;
    onDelete: () => void;
    onChat: () => void;
}

function ContactCard({ contact, isOwner, onEdit, onShare, onDelete, onChat }: ContactCardProps) {
    return (
        <Card className="p-6 relative group border border-border hover:border-primary/50 transition-all flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
                    <User size={28} />
                </div>
                {isOwner && (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={onEdit} className="text-amber-500"><Edit2 size={18} /></Button>
                        <Button variant="ghost" size="icon" onClick={onShare} className="text-indigo-600"><Share2 size={18} /></Button>
                        <Button variant="ghost" size="icon" onClick={onDelete} className="text-red-500"><Trash2 size={18} /></Button>
                    </div>
                )}
            </div>
            <div className="space-y-4 flex-1">
                <div>
                    <h4 className="font-bold text-xl text-secondary">{contact.name}</h4>
                    <p className="text-xs font-bold text-primary tracking-widest mt-1">{contact.title}</p>
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2"><MapPin size={14} /> {contact.unit}</p>
                </div>
                <div className="space-y-2 pt-4 border-t border-border/50">
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm font-bold text-slate-600"><Phone size={16} /> {contact.phone}</a>
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm font-bold text-slate-600"><Mail size={16} /> {contact.email}</a>
                </div>
                <Button onClick={onChat} className="w-full mt-4 rounded-xl bg-slate-900 text-white"><MessageSquare size={18} className="mr-2" /> Sohbet</Button>
            </div>
        </Card>
    );
}
