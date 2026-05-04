import { Search, MapPin, Phone, Mail, User, Building2, Plus, Share2, Trash2, Loader2, Tag, Shield, ChevronRight, Edit2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect } from "react";
import { fetchContacts, createContact, shareContact, deleteContact, uploadAndSyncContacts, updateContact, type Contact } from "../lib/api/contacts";
import { FileSpreadsheet, MessageSquare } from "lucide-react";
import { useChat } from "../lib/context/ChatContext";
import { useAuth } from "../lib/hooks/useAuth";


export default function Contacts() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<"corporate" | "personal">("personal");
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("Tümü");
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

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
        loadContacts();
    }, [activeTab]);

    const loadContacts = async () => {
        try {
            setLoading(true);
            const data = await fetchContacts(activeTab, user?.uid);
            setContacts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Rehber yüklenemedi:", error);
            setContacts([]);
            toast.error("İletişim bilgileri şu an yüklenemiyor.");
        } finally {
            setLoading(false);
        }
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
            toast.error("Lütfen sadece Excel (.xlsx, .xls) dosyası yükleyin.");
            return;
        }

        try {
            setSyncing(true);
            const res = await uploadAndSyncContacts(file);
            toast.success(res.message || "Rehber başarıyla güncellendi.");
            loadContacts();
        } catch (error: any) {
            console.error("Yükleme hatası:", error);
            toast.error(error.message || "Excel yüklenirken bir hata oluştu.");
        } finally {
            setSyncing(false);
            if (e.target) e.target.value = "";
        }
    };

    const filteredContacts = contacts.filter(c => {
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
            c.tags?.some(t => normalize(t).includes(normSearch));
        
        const normCategory = normalize(c.category || c.tags?.[0] || "");
        const matchesRole = selectedRole === "Tümü" || normCategory === normalize(selectedRole);
             
        return matchesSearch && matchesRole;
    });

    const sortedContacts = [...filteredContacts].sort((a, b) => {
        const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });
    });

    const roleOptions = [
        "Tümü",
        ...Array.from(new Set(contacts.map(contact => contact.category).filter((value): value is string => Boolean(value))))
    ];

    const groupedContacts = sortedContacts.reduce<Record<string, Contact[]>>((groups, contact) => {
        const groupKey = contact.category || "Diğer";
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(contact);
        return groups;
    }, {});

    const orderedGroupNames = Array.from(new Set(sortedContacts.map(contact => contact.category || "Diğer")));

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
                    
                    {activeTab === "corporate" && (
                        <>
                            <input
                                type="file"
                                id="excel-upload"
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                disabled={syncing}
                            />
                            <Button 
                                variant="outline" 
                                onClick={() => document.getElementById('excel-upload')?.click()}
                                disabled={syncing}
                                className="h-11 max-w-full px-3 sm:px-4 rounded-xl border-dashed border-2 hover:border-primary transition-all whitespace-normal sm:whitespace-nowrap text-xs sm:text-sm leading-tight"
                            >
                                {syncing ? (
                                    <Loader2 size={18} className="mr-2 animate-spin" />
                                ) : (
                                    <FileSpreadsheet size={18} className="mr-2 text-emerald-600" />
                                )}
                                {syncing ? "Senkronize Ediliyor..." : "Yeni Liste Yükle (xlsx)"}
                            </Button>
                        </>
                    )}

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

            {loading ? (
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
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {(groupedContacts[groupName] || []).map(contact => (
                                        <ContactCard
                                            key={contact.id}
                                            contact={contact}
                                            isOwner={contact.owner_id === user?.uid || contact.is_shared}
                                            onEdit={() => openEditModal(contact)}
                                            onShare={() => handleShare(contact.id)}
                                            onDelete={() => handleDelete(contact.id)}
                                            onChat={() => {
                                                if (!user) return;
                                                // Her kişi için benzersiz oda: kendi uid + kişinin Firestore doc id (sabit, eşsiz)
                                                const roomId = ["dm", ...[user.uid, contact.id].sort()].join("_");
                                                openChat(roomId, contact.name, "dm");
                                            }}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {sortedContacts.map(contact => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                isOwner={contact.owner_id === user?.uid || contact.is_shared}
                                onEdit={() => openEditModal(contact)}
                                onShare={() => handleShare(contact.id)}
                                onDelete={() => handleDelete(contact.id)}
                                onChat={() => {
                                    if (!user) return;
                                    const roomId = ["dm", ...[user.uid, contact.id].sort()].join("_");
                                    openChat(roomId, contact.name, "dm");
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
                                required
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-outfit"
                                placeholder="Örn: Başmüfettiş"
                                value={newContact.title}
                                onChange={(e) => setNewContact({...newContact, title: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase tracking-widest">Birim</label>
                            <input 
                                required
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
                                required
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
        </div>
    );
}

function ContactCard({ contact, isOwner, onEdit, onShare, onDelete, onChat }: { contact: Contact, isOwner: boolean, onEdit: () => void, onShare: () => void, onDelete: () => void, onChat: () => void }) {

    return (
        <Card className="p-6 relative group overflow-hidden border border-border hover:border-primary/50 transition-all shadow-sm hover:shadow-md h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all transform group-hover:scale-105 duration-300 ${!contact.is_shared ? 'bg-indigo-500/10 text-indigo-600' : 'bg-primary/10 text-primary'}`}>
                    {!contact.is_shared ? <User size={28} /> : <Building2 size={28} />}
                </div>
                {isOwner && (
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={onEdit} title="Kişiyi Düzenle" className="text-amber-500 hover:bg-amber-50">
                            <Edit2 size={18} />
                        </Button>
                        {!contact.is_shared && (
                            <Button variant="ghost" size="icon" onClick={onShare} title="Kurumsal Rehberde Paylaş" className="text-indigo-600 hover:bg-indigo-50">
                                <Share2 size={18} />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={onDelete} title="Kişiyi Sil" className="text-red-500 hover:bg-red-50">
                            <Trash2 size={18} />
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-5 flex-1">
                <div>
                    <h4 className="font-bold text-xl text-secondary group-hover:text-primary transition-colors font-outfit">{contact.name}</h4>
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
