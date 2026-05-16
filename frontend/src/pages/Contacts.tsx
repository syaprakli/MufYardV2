import { Search, MapPin, Phone, Mail, User, Building2, Plus, Share2, Trash2, Loader2, Tag, Shield, ChevronRight, Edit2, Star } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect, useMemo } from "react";
import { createContact, shareContact, deleteContact, updateContact, acceptContact, type Contact } from "../lib/api/contacts";
import { MessageSquare } from "lucide-react";
import { useChat } from "../lib/context/ChatContext";
import { useAuth } from "../lib/hooks/useAuth";
import ShareModal from "../components/ShareModal";
import { useLocation } from "react-router-dom";


import { useGlobalData } from "../lib/context/GlobalDataContext";

export default function Contacts() {
    const { user } = useAuth();
    const location = useLocation();
    const confirm = useConfirm();
    const { data: cachedData, refreshAll, refreshContactsPersonal, refreshContactsCorporate, loading: globalLoading } = useGlobalData();
    
    const [activeTab, setActiveTab] = useState<"corporate" | "personal">("personal");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("Tümü");
    const [favorites, setFavorites] = useState<string[]>([]);
    const [shareContactItem, setShareContactItem] = useState<Contact | null>(null);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

    useEffect(() => {
        if (user) {
            const saved = localStorage.getItem(`mufyard_favorites_${user.uid}`);
            if (saved) setFavorites(JSON.parse(saved));
        }
    }, [user]);

    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
            if (user) localStorage.setItem(`mufyard_favorites_${user.uid}`, JSON.stringify(newFavs));
            return newFavs;
        });
    };

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
        const params = new URLSearchParams(location.search);
        if (params.get("view") === "pending") {
            setActiveTab("personal");
        }
    }, [location.search]);

    // Memoized derived data from global cache
    const { contacts, invitations } = useMemo(() => {
        if (!user) return { contacts: [], invitations: [] };
        const userEmail = user.email?.toLowerCase().trim();
        const userUid = user.uid;
        const userKeys = [userUid, userEmail].filter(Boolean) as string[];

        if (activeTab === "personal") {
            const data = (cachedData.contactsPersonal || []);
            // Kendi eklediklerim + kabul ettiklerim
            const accepted = data.filter(c => {
                const cEmail = c.email?.toLowerCase().trim();
                const isOwner = c.owner_id === userUid || (userEmail && cEmail === userEmail);
                const isAcceptedCollab = (c as any).accepted_collaborators?.some((v: string) => userKeys.includes(v.toLowerCase().trim()));
                return isOwner || isAcceptedCollab;
            });

            // Henüz bekleyen davetler
            const pending = data.filter(c => {
                const cEmail = c.email?.toLowerCase().trim();
                const isOwner = c.owner_id === userUid || (userEmail && cEmail === userEmail);
                const isPendingCollab = (c as any).pending_collaborators?.some((v: string) => userKeys.includes(v.toLowerCase().trim()));
                return !isOwner && isPendingCollab;
            });

            const acceptedContacts = accepted.length > 0 ? accepted : (data.length > 0 ? data.filter(c => c.owner_id === userUid) : []);
            return { contacts: acceptedContacts, invitations: pending };
        } else {
            const corp = (cachedData.contactsCorporate || []).filter(c => {
                const cEmail = c.email?.toLowerCase().trim();
                return cEmail !== userEmail;
            });
            return { contacts: corp, invitations: [] };
        }
    }, [activeTab, cachedData.contactsPersonal, cachedData.contactsCorporate, user]);

    useEffect(() => {
        if (user?.uid) {
            refreshAll(user.uid, user.email || undefined, user.displayName || undefined);
        }
    }, [user, refreshAll]);

    const loadContacts = async () => {
        if (!user) return;
        if (activeTab === "personal") {
            await refreshContactsPersonal(user.uid, user.email || undefined);
        } else {
            await refreshContactsCorporate();
        }
    };

    const handleAcceptInvitation = async (contactId: string) => {
        if (!user?.uid) return;
        try {
            await acceptContact(contactId, user.uid, user.email || undefined);
            toast.success("Kişi kabul edildi ve rehberinize eklendi.");
            loadContacts();
        } catch (error) {
            toast.error("Kişi kabul edilemedi.");
        }
    };

    const handleShareUpdate = async (newSharedWith: string[]) => {
        if (!shareContactItem) return;
        try {
            await updateContact(shareContactItem.id, user!.uid, { 
                pending_collaborators: newSharedWith,
                is_shared: shareContactItem.is_shared 
            } as any);
            toast.success("Paylaşım davetleri gönderildi.");
            setShareContactItem(null);
            loadContacts();
        } catch { toast.error("Paylaşım güncellenemedi."); }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("Lütfen işlem yapabilmek için giriş yapın.");
            return;
        }

        try {
            const tags = newContact.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
            await createContact({
                name: newContact.name,
                title: newContact.title,
                unit: newContact.unit,
                phone: newContact.phone,
                email: newContact.email,
                tags: tags,
                is_shared: newContact.is_shared,
                owner_id: user.uid
            });
            setIsModalOpen(false);
            setNewContact({ name: "", title: "", unit: "", phone: "", email: "", tagsString: "", is_shared: false });
            toast.success("Kişi başarıyla oluşturuldu.");
            loadContacts();
        } catch (error) {
            toast.error("Kişi oluşturulamadı.");
        }
    };

    const handleUpdateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !editingContact) return;

        try {
            const tags = newContact.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
            await updateContact(editingContact.id, user.uid, {
                name: newContact.name,
                title: newContact.title,
                unit: newContact.unit,
                phone: newContact.phone,
                email: newContact.email,
                tags: tags,
                is_shared: newContact.is_shared,
                owner_id: editingContact.owner_id
            });
            setIsModalOpen(false);
            setEditingContact(null);
            setNewContact({ name: "", title: "", unit: "", phone: "", email: "", tagsString: "", is_shared: false });
            toast.success("Kişi başarıyla güncellendi.");
            loadContacts();
        } catch (error: any) {
            toast.error(error.message || "Kişi güncellenemedi.");
        }
    };

    const openEditModal = (contact: Contact) => {
        setEditingContact(contact);
        setNewContact({
            name: contact.name,
            title: contact.title,
            unit: contact.unit,
            phone: contact.phone,
            email: contact.email,
            tagsString: contact.tags?.join(', ') || "",
            is_shared: contact.is_shared
        });
        setIsModalOpen(true);
    };

    const handleShare = async (id: string) => {
        const confirmed = await confirm({
            title: "Rehberde Paylaş",
            message: "Bu kişiyi kurumsal rehberde paylaşmak istediğinize emin misiniz? Tüm ekip arkadaşlarınız görebilecektir.",
            confirmText: "Paylaş",
            variant: "info"
        });
        if (!confirmed) return;

        try {
            await shareContact(id, user!.uid);
            toast.success("Paylaşım ayarları güncellendi.");
            loadContacts();
        } catch (error: any) {
            toast.error(error.message || "Paylaşma işlemi başarısız.");
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Kişiyi Sil",
            message: "Bu kişiyi silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            await deleteContact(id, user!.uid);
            toast.success("Kişi başarıyla silindi.");
            loadContacts();
        } catch (error: any) {
            toast.error(error.message || "Silme işlemi başarısız.");
        }
    };



    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const normalize = (s: string) => s.toLowerCase()
                .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
                .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
                .replace(/i̇/g, 'i'); // handle combining dot

            const normSearch = normalize(searchQuery);
            const normName = normalize(c.name);
            const normUnit = normalize(c.unit || "");
            const normTitle = normalize(c.title || "");
            
            const matchesSearch = normName.includes(normSearch) || 
                normUnit.includes(normSearch) || 
                normTitle.includes(normSearch) || 
                c.tags?.some((t: string) => normalize(t).includes(normSearch));
            
            const normCategory = normalize(c.category || c.tags?.[0] || "");
            
            let matchesRole = false;
            if (selectedRole === "Tümü") matchesRole = true;
            else if (selectedRole === "Favoriler") matchesRole = favorites.includes(c.id);
            else matchesRole = normCategory === normalize(selectedRole);
                 
            return matchesSearch && matchesRole;
        });
    }, [contacts, searchQuery, selectedRole, favorites]);

    const sortedContacts = useMemo(() => {
        return [...filteredContacts].sort((a, b) => {
            const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;

            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }

            return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
        });
    }, [filteredContacts]);

    const roleOptions = useMemo(() => [
        "Tümü",
        "Favoriler",
        ...Array.from(new Set(contacts.map(contact => contact.category).filter((value): value is string => Boolean(value))))
    ], [contacts]);

    const groupedContacts = useMemo(() => {
        return sortedContacts.reduce<Record<string, Contact[]>>((groups, contact) => {
            const groupKey = contact.category || "Diğer";
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(contact);
            return groups;
        }, {});
    }, [sortedContacts]);

    const orderedGroupNames = useMemo(() => {
        return Array.from(new Set(sortedContacts.map(contact => contact.category || "Diğer")));
    }, [sortedContacts]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 font-outfit">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Kurumsal Rehber</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {activeTab === "corporate" ? "Bakanlık Rehberi" : "Kişisel Rehberim"}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        {activeTab === "corporate" 
                            ? "Tüm ekip ile paylaşılan kurumsal iletişim bilgileri." 
                            : "Sadece sizin görebildiğiniz özel rehberiniz."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 justify-start md:justify-end">
                    <div className="flex bg-muted p-1 rounded-xl shadow-inner">
                        <button
                            onClick={() => setActiveTab("personal")}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "personal" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}
                        >
                            Kişisel
                        </button>
                        <button
                            onClick={() => setActiveTab("corporate")}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "corporate" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}
                        >
                            Kurumsal
                        </button>
                    </div>
                    


                    <Button onClick={() => {
                        setEditingContact(null);
                        setNewContact({ name: "", title: "", unit: "", phone: "", email: "", tagsString: "", is_shared: false });
                        setIsModalOpen(true);
                    }} className="h-11 rounded-xl shadow-lg shadow-primary/20">
                        <Plus size={20} className="mr-2" /> Yeni Kişi
                    </Button>
                </div>
            </div>

            <div className="flex flex-col space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white border border-border rounded-2xl px-5 py-4 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/10 transition-all border-slate-200">
                        <Search size={20} className="text-slate-400 mr-3" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="İsim, birim, ünvan veya etiket ile ara..."
                            className="bg-transparent border-none outline-none text-base w-full font-outfit text-slate-700 placeholder:text-slate-400"
                        />
                    </div>
                    <Button variant="outline" className="h-14 px-8 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50">Kayıt Sayısı: {sortedContacts.length}</Button>
                </div>

                {/* Role Filter Chips */}
                <div className="flex flex-wrap gap-2 pb-2">
                    {roleOptions.map((role) => (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                                selectedRole === role 
                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105" 
                                : "bg-white border-slate-100 text-slate-500 hover:border-primary/30 hover:text-primary"
                            }`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bekleyen Kişi Davetleri */}
            {activeTab === "personal" && invitations.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mb-8 font-inter">
                    <div className="flex items-center gap-2 px-1 text-indigo-600">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black tracking-widest font-outfit">Bekleyen Rehber Kayıtları ({invitations.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex flex-col justify-between group hover:bg-indigo-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-lg tracking-widest">Paylaşılan Kişi</span>
                                        <User size={14} className="text-indigo-500" />
                                    </div>
                                    <h4 className="font-bold text-foreground dark:text-slate-100 text-sm mb-1">{inv.name}</h4>
                                    <p className="text-[10px] text-slate-500 font-medium mb-4 italic flex items-center gap-1">
                                        {inv.title} - {inv.unit}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => handleAcceptInvitation(inv.id)} 
                                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-10 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-200/50 transition-all active:scale-95"
                                >
                                    Kişiyi Kabul Et ve Kaydet
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {globalLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Rehber yükleniyor...</p>
                </div>
            ) : sortedContacts.length > 0 ? (
                activeTab === "corporate" ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {orderedGroupNames.map((groupName) => (
                            <section key={groupName} className="space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{groupName}</h2>
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
                                            {groupedContacts[groupName]?.length || 0} kayıt
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                                    {(groupedContacts[groupName] || []).map(contact => (
                                            <ContactCard
                                                key={contact.id}
                                                contact={contact}
                                                isFavorite={favorites.includes(contact.id)}
                                                onToggleFavorite={() => toggleFavorite(contact.id)}
                                                isOwner={contact.owner_id === user?.uid || contact.is_shared}
                                                onEdit={() => openEditModal(contact)}
                                                onShare={() => setShareContactItem(contact)}
                                                onShareCorporate={() => handleShare(contact.id)}
                                                onDelete={() => handleDelete(contact.id)}
                                                onChat={() => {
                                                    if (!user) return;
                                                    const targetId = contact.uid || contact.id;
                                                    const roomId = ["dm", ...[user.uid, targetId].sort()].join("_");
                                                    openChat(roomId, contact.name, "dm", targetId);
                                                }}
                                            />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {sortedContacts.map(contact => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                isFavorite={favorites.includes(contact.id)}
                                onToggleFavorite={() => toggleFavorite(contact.id)}
                                isOwner={contact.owner_id === user?.uid || contact.is_shared}
                                onEdit={() => openEditModal(contact)}
                                onShare={() => setShareContactItem(contact)}
                                onShareCorporate={() => handleShare(contact.id)}
                                onDelete={() => handleDelete(contact.id)}
                                onChat={() => {
                                    if (!user) return;
                                    const targetId = contact.uid || contact.id;
                                    const roomId = ["dm", ...[user.uid, targetId].sort()].join("_");
                                    openChat(roomId, contact.name, "dm", targetId);
                                }}
                            />

                        ))}
                    </div>
                )
            ) : (
                <Card className="p-16 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-2">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <User size={40} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-primary font-outfit">Sonuç bulunamadı</h3>
                        <p className="text-muted-foreground mt-1 max-w-sm">
                            Aradığınız kriterlere uygun bir kişi bulunamadı veya henüz kayıt eklenmemiş.
                        </p>
                    </div>
                </Card>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingContact(null);
                }}
                title={editingContact ? "Kişiyi Düzenle" : "Yeni Kişi Ekle"}
            >
                <form onSubmit={editingContact ? handleUpdateContact : handleCreateContact} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Ad Soyad</label>
                        <input 
                            required
                            className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                            placeholder="Örn: Ahmet Yılmaz"
                            value={newContact.name}
                            onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">Ünvan</label>
                            <input 
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="Örn: Başmüfettiş"
                                value={newContact.title}
                                onChange={(e) => setNewContact({...newContact, title: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">Birim</label>
                            <input 
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="Örn: Denetim Bşk."
                                value={newContact.unit}
                                onChange={(e) => setNewContact({...newContact, unit: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">Telefon</label>
                            <input 
                                required
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="05xx xxx xx xx"
                                value={newContact.phone}
                                onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">E-Posta</label>
                            <input 
                                type="email"
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="eposta@gsb.gov.tr"
                                value={newContact.email}
                                onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest">Etiketler (Virgül ile ayırın)</label>
                        <div className="relative">
                            <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input 
                                className="w-full pl-11 pr-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="Örn: Müfettiş, Ankara, KYK"
                                value={newContact.tagsString}
                                onChange={(e) => setNewContact({...newContact, tagsString: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 py-2">
                        <input 
                            type="checkbox"
                            id="shareCheck"
                            checked={newContact.is_shared}
                            onChange={(e) => setNewContact({...newContact, is_shared: e.target.checked})}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <label htmlFor="shareCheck" className="text-sm font-medium text-secondary">Doğrudan bakanlık rehberinde paylaş</label>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setIsModalOpen(false)}>İptal</Button>
                        <Button type="submit" className="flex-1 h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20">Kaydet</Button>
                    </div>
                </form>
            </Modal>
            
            {shareContactItem && (
                <ShareModal
                    isOpen={!!shareContactItem}
                    onClose={() => setShareContactItem(null)}
                    title="Kişiyi Paylaş"
                    sharedWith={(shareContactItem as any).pending_collaborators || []}
                    onShare={handleShareUpdate}
                />
            )}
        </div>
    );
}

function ContactCard({ contact, isOwner, isFavorite, onToggleFavorite, onEdit, onShare, onShareCorporate, onDelete, onChat }: { contact: Contact, isOwner: boolean, isFavorite?: boolean, onToggleFavorite?: () => void, onEdit: () => void, onShare: () => void, onShareCorporate: () => void, onDelete: () => void, onChat: () => void }) {

    return (
        <Card className="p-5 relative group overflow-hidden border border-border hover:border-primary/50 transition-all shadow-sm hover:shadow-md h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all transform group-hover:scale-105 duration-300 ${!contact.is_shared ? 'bg-indigo-500/10 text-indigo-600' : 'bg-primary/10 text-primary'}`}>
                    {!contact.is_shared ? <User size={24} /> : <Building2 size={24} />}
                </div>
                {isOwner && (
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={onToggleFavorite} title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"} className="text-amber-500 hover:bg-amber-50">
                            <Star size={18} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-amber-500" : "text-slate-400"} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onEdit} title="Kişiyi Düzenle" className="text-amber-500 hover:bg-amber-50">
                            <Edit2 size={18} />
                        </Button>
                        {!contact.is_shared && (
                            <>
                                <Button variant="ghost" size="icon" onClick={onShare} title="Kişilerle Paylaş" className="text-indigo-600 hover:bg-indigo-50">
                                    <Share2 size={18} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={onShareCorporate} title="Kurumsal Rehberde Paylaş" className="text-emerald-600 hover:bg-emerald-50">
                                    <Building2 size={18} />
                                </Button>
                            </>
                        )}
                        <Button variant="ghost" size="icon" onClick={onDelete} title="Kişiyi Sil" className="text-red-500 hover:bg-red-50">
                            <Trash2 size={18} />
                        </Button>
                    </div>
                )}
                {!isOwner && onToggleFavorite && (
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" onClick={onToggleFavorite} title={isFavorite ? "Favorilerden Çıkar" : "Favorilere Ekle"} className="text-amber-500 hover:bg-amber-50">
                            <Star size={18} fill={isFavorite ? "currentColor" : "none"} className={isFavorite ? "text-amber-500" : "text-slate-400"} />
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-5 flex-1">
                <div>
                    <h4 className="font-bold text-lg text-secondary group-hover:text-primary transition-colors font-outfit">{contact.name}</h4>
                    <p className="text-xs font-bold text-indigo-600 tracking-widest mt-1">{contact.title}</p>
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5 font-medium">
                        <MapPin size={14} className="text-secondary" /> {contact.unit}
                    </p>
                </div>

                {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {contact.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-secondary tracking-tighter">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="space-y-3 pt-5 border-t border-border/50">
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-sm text-primary font-bold hover:text-indigo-600 transition-colors">
                        <Phone size={18} className="text-secondary" /> {contact.phone}
                    </a>
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-sm text-primary font-bold hover:text-indigo-600 transition-colors">
                        <Mail size={18} className="text-secondary" /> {contact.email}
                    </a>
                </div>
                
                <Button 
                    onClick={onChat}
                    className="w-full mt-4 rounded-xl bg-slate-900 hover:bg-black text-white py-6 shadow-lg shadow-slate-200"
                >
                    <MessageSquare size={18} className="mr-2" /> Sohbet Başlat
                </Button>
            </div>

            
            {!contact.is_shared && (
                <div className="absolute top-0 right-0 px-2 py-1 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-tighter">
                    Kişisel
                </div>
            )}
        </Card>
    );
}
