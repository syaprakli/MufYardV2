import { useState, useEffect } from 'react';
import { Search, MessageSquare, Shield, ChevronRight, ChevronLeft, User } from 'lucide-react';

import { useAuth } from '../lib/hooks/useAuth';
import { useChat } from '../lib/context/ChatContext';
import { usePresence } from '../lib/context/PresenceContext';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { fetchAllProfiles, deleteProfile as apiDeleteProfile } from '../lib/api/profiles';
import { fetchInspectors } from '../lib/api/inspectors';
import { useConfirm } from '../lib/context/ConfirmContext';
import { Trash2 } from 'lucide-react';

interface UnifiedContact {
  uid: string | null;
  full_name: string;
  title: string;
  email: string;
  avatar_url: string | null;
  isRegistered: boolean;
  isMe: boolean;
  isOnline?: boolean;
  directoryId?: string | null;
}

export default function Messages() {
  const { user } = useAuth();
  const { openChat } = useChat();
  const { onlineUsers } = usePresence();
  const confirm = useConfirm();
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [userRole, setUserRole] = useState('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'online' | 'offline'>('all');
  const itemsPerPage = 8;

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const onlineUids = onlineUsers.map(u => u.uid);

  // Arama veya filtre değiştiğinde sayfa 1'e dön
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [profiles, inspectors] = await Promise.all([
        fetchAllProfiles(),
        fetchInspectors()
      ]);
      
      // Set current user role
      if (user) {
        const myProfile = profiles.find(p => p.uid === user.uid);
        if (myProfile?.role) setUserRole(myProfile.role);
      }
      
      const unified: UnifiedContact[] = [];

      // 1. Her bir müfettişi listeye ekle
      inspectors.forEach(ins => {
        const insEmail = ins.email?.trim().toLowerCase();
        const userEmail = user?.email?.trim().toLowerCase();

        // Bu müfettiş için kayıtlı bir profil var mı? (email üzerinden)
        const profile = profiles.find(p => p.email?.trim().toLowerCase() === insEmail);
        
        const isMe = !!((profile?.uid === user?.uid) || (insEmail && userEmail && insEmail === userEmail));

        unified.push({
          uid: profile?.uid || (isMe ? user?.uid : null) || null,
          full_name: ins.name + (isMe ? " (Siz)" : ""), 
          title: ins.title || 'Müfettiş',
          email: ins.email || '',
          avatar_url: profile?.avatar_url || null,
          isRegistered: !!profile?.uid || isMe,
          isMe: isMe,
          directoryId: ins.id || null
        });
      });

      // 2. Listeyi alfabetik sırala
      unified.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setContacts(unified);
    } catch (error) {
      console.error("Kullanıcılar yüklenemedi:", error);
      toast.error("Kullanıcı listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (e: React.MouseEvent, contact: UnifiedContact) => {
    e.stopPropagation();
    
    const isRegistered = !!contact.uid;
    const inDirectory = !!contact.directoryId;

    const confirmed = await confirm({
      title: "Kullanıcıyı Sil",
      message: `${contact.full_name} kullanıcısını ${isRegistered ? "sistemden ve " : ""}rehberden tamamen silmek istediğinize emin misiniz?`,
      confirmText: "Sil",
      variant: "danger"
    });
    
    if (confirmed) {
      try {
        let successCount = 0;
        
        // 1. Profil sil (Kayıtlı ise)
        if (contact.uid) {
          const res = await apiDeleteProfile(contact.uid);
          if (res) successCount++;
        }

        // 2. Rehberden sil (Directory ID varsa)
        if (contact.directoryId) {
          const { deleteInspector } = await import('../lib/api/inspectors');
          await deleteInspector(contact.directoryId);
          successCount++;
        }

        if (successCount > 0) {
          toast.success("Kullanıcı başarıyla silindi.");
          fetchUsers();
        } else {
          toast.error("Silme işlemi başarısız.");
        }
      } catch (err) {
        toast.error("Hata oluştu.");
      }
    }
  };

  const handleStartChat = (contact: UnifiedContact) => {
    if (!user) return;
    if (!contact.uid) {
      toast.error(`${contact.full_name} henüz sisteme kayıt olmamış.`);
      return;
    }
    const roomId = ["dm", ...[user.uid, contact.uid].sort()].join("_");
    openChat(roomId, contact.full_name, "dm");
  };

  const filteredContacts = (contacts.map(c => ({
    ...c,
    isOnline: c.isMe ? true : (c.uid ? onlineUids.includes(c.uid) : false)
  }))).filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'active') return matchesSearch && c.isRegistered;
    if (filterStatus === 'inactive') return matchesSearch && !c.isRegistered;
    if (filterStatus === 'online') return matchesSearch && c.isOnline;
    if (filterStatus === 'offline') return matchesSearch && c.isRegistered && !c.isOnline;
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = filteredContacts.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 font-outfit">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            <Shield size={10} className="text-primary/60" />
            <span>MufYard Platform</span>
            <ChevronRight size={10} />
            <span className="text-primary opacity-80 uppercase tracking-widest">Mesajlar</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Özel Mesajlar</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Ekip arkadaşlarınızla güvenli ve özel yazışmalar yapın.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-[calc(100vh-280px)]">
        {/* Sidebar: User List */}
        <div className="md:col-span-4 flex flex-col space-y-4">
          <div className="bg-card/50 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 flex items-center shadow-sm focus-within:ring-4 focus-within:ring-primary/10 transition-all">
            <Search size={20} className="text-slate-400 mr-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ekip arkadaşı ara..."
              className="bg-transparent border-none outline-none text-base w-full font-outfit text-slate-700 dark:text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-sm">
            <button
              onClick={() => setFilterStatus('all')}
              className={cn(
                "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                filterStatus === 'all' ? "bg-card text-primary dark:text-primary-light shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Hepsi
            </button>
            <button
              onClick={() => setFilterStatus('online')}
              className={cn(
                "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                filterStatus === 'online' ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Online
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={cn(
                "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                filterStatus === 'active' ? "bg-card text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Kayıtlı
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={cn(
                "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                filterStatus === 'inactive' ? "bg-card text-slate-600 dark:text-slate-300 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              İnaktif
            </button>
          </div>

          <div className="flex-1 bg-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Ekip Arkadaşları</h3>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : paginatedContacts.length > 0 ? (
                <div className="flex flex-col h-full">
                  <div className="divide-y divide-slate-50 dark:divide-slate-800 flex-1">
                    {paginatedContacts.map((contact) => (
                      <button
                        key={contact.email}
                        onClick={() => handleStartChat(contact as any)}
                        className={cn(
                          "w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-left",
                          !contact.isRegistered && "opacity-60 cursor-not-allowed grayscale-[0.5]"
                        )}
                      >
                        <div className="relative">
                          {contact.avatar_url ? (
                            <img src={contact.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          ) : (
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                              contact.isOnline ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : 
                              contact.isRegistered ? "bg-primary/5 dark:bg-primary/20 text-primary dark:text-primary-light" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                            )}>
                              <User size={24} />
                            </div>
                          )}
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 transition-all duration-300",
                            contact.isOnline ? "bg-emerald-500 scale-110 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                            contact.isRegistered ? "bg-slate-300 dark:bg-slate-600" : "bg-slate-200 dark:bg-slate-700"
                          )} title={contact.isOnline ? "Şu an Online" : contact.isRegistered ? "Çevrimdışı (Kayıtlı)" : "Kayıt Olmamış"} />
                          
                          {contact.isOnline && (
                             <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary transition-colors">{contact.full_name}</h4>
                            {contact.isOnline ? (
                               <span className="text-[7px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 px-1 py-0.5 rounded uppercase tracking-tighter">Online</span>
                            ) : !contact.isRegistered && (
                               <span className="text-[7px] font-black bg-slate-100 dark:bg-slate-800 text-slate-400 px-1 py-0.5 rounded uppercase tracking-tighter">İnaktif</span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{contact.title}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {userRole === 'admin' && (contact.isRegistered || contact.directoryId) && (
                            <button 
                              onClick={(e) => handleDeleteProfile(e, contact as any)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Profili Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors translate-x-0 group-hover:translate-x-1" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Sayfa {currentPage} / {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft size={16} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight size={16} className="text-slate-600 dark:text-slate-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-xs font-bold uppercase tracking-widest">Kayıt Bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main: Empty State or Active Conversation (Not implemented here since we use FloatingChat) */}
        <div className="hidden md:flex md:col-span-8 bg-card/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-3xl flex-col items-center justify-center text-center p-12 space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center text-slate-300 dark:text-slate-600">
            <MessageSquare size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-outfit">Sohbet Başlatın</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm text-sm font-medium">
              Sol taraftaki listeden bir ekip arkadaşınızı seçerek özel bir yazışma başlatabilirsiniz. Mesajlarınız buluta kaydedilir ve güvenle saklanır.
            </p>
          </div>
          <div className="pt-4 grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 text-left">
              <div className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1">Gizlilik</div>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] font-bold leading-relaxed">Mesajlar uçtan uca şifreli olmasa da sadece taraflar erişebilir.</p>
            </div>
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-left">
              <div className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-1">Hız</div>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] font-bold leading-relaxed">Websocket teknolojisi ile anlık bildirim ve mesajlaşma.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
