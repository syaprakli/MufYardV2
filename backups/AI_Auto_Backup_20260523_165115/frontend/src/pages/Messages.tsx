import { useState, useEffect } from 'react';
import { Search, MessageSquare, Shield, ChevronRight, ChevronLeft, User } from 'lucide-react';
import FloatingChat from '../components/FloatingChat';

import { useAuth } from '../lib/hooks/useAuth';
import { usePresence } from '../lib/context/PresenceContext';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { fetchAllProfiles, type Profile } from '../lib/api/profiles';
import { fetchInspectors } from '../lib/api/inspectors';

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
  const { onlineUsers, unreadMessages, markAsRead } = usePresence();
  const [contacts, setContacts] = useState<UnifiedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<UnifiedContact & { isOnline: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const itemsPerPage = 8;

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const onlineUids = onlineUsers.map(u => u.uid);

  // Arama veya filtre değiştiğinde sayfa 1'e dön
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  // Real-time DM bildirimi: Yeni mesaj geldiğinde kişi listesinde güncelleme tetikle
  const [lastDmEvent, setLastDmEvent] = useState<number>(0);
  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      if (!data || !data.room_id?.startsWith('dm_')) return;
      // Force re-render to update unread badges instantly
      setLastDmEvent(Date.now());
    };
    window.addEventListener('mufyard:new_message', handler);
    return () => window.removeEventListener('mufyard:new_message', handler);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      let profiles: Profile[] = [];
      let directory: any[] = [];

      try {
        profiles = await fetchAllProfiles();
      } catch (err) {
        console.warn("Profiller yüklenemedi, tekrar deneniyor...", err);
        // Kısa gecikme sonrası bir kez daha dene (Railway cold start için)
        await new Promise(r => setTimeout(r, 3000));
        try {
          profiles = await fetchAllProfiles();
        } catch (err2) {
          console.error("Profiller yine yüklenemedi:", err2);
          toast.error("Kullanıcı listesi alınamadı.");
        }
      }

      try {
        directory = await fetchInspectors();
      } catch (err) {
        console.warn("Rehber verisi alınamadı, sadece kayıtlı kullanıcılar gösteriliyor.");
      }
      
      const unified: UnifiedContact[] = [];

      // Kayıtlı profilleri ekle ve rehber bilgisiyle zenginleştir.
      const myUid = user?.uid;
      const myEmail = user?.email?.toLowerCase().trim();

      profiles.forEach(profile => {
        const pUid = profile.uid;
        const pEmail = profile.email?.toLowerCase().trim();
        
        const isMe = !!((pUid && pUid === myUid) || (pEmail && pEmail === myEmail));
        if (isMe) return;
        
        const dirEntry = directory.find(d => {
            const dEmail = d.email?.toLowerCase().trim();
            return dEmail && dEmail === pEmail;
        });
        
        unified.push({
          uid: profile.uid,
          full_name: profile.full_name,
          title: profile.title || dirEntry?.title || 'Müfettiş',
          email: profile.email || '',
          avatar_url: profile.avatar_url || null,
          isRegistered: true,
          isMe: isMe,
          directoryId: dirEntry?.id || null
        });
      });

      // Sadece kayıtlı (profili olan) kullanıcılar gösterilir.
      // Rehber-only kullanıcılar Mesajlar listesine dahil edilmez.

      // Listeyi alfabetik sırala
      unified.sort((a, b) => a.full_name.localeCompare(b.full_name));

      // Son güvenlik filtresi: Kendini listede görme
      const finalContacts = unified.filter(c => {
        const cUid = c.uid;
        const cEmail = c.email?.toLowerCase().trim();
        return (cUid !== myUid) && (cEmail !== myEmail);
      });

      setContacts(finalContacts);
    } catch (error) {
      console.error("Kullanıcılar yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = (contact: UnifiedContact & { isOnline: boolean }) => {
    if (!user) return;
    if (!contact.uid) {
      toast.error(`${contact.full_name} henüz sisteme kayıt olmamış.`);
      return;
    }
    setSelectedContact(contact);
    
    // Mesajları okundu olarak işaretle
    const roomId = ["dm", ...[user.uid, contact.uid!].sort()].join("_");
    markAsRead(roomId);
  };

  const filteredContacts = (contacts.map(c => ({
    ...c,
    isOnline: c.uid ? onlineUids.includes(c.uid) : false
  }))).filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'online') return matchesSearch && c.isOnline;
    if (filterStatus === 'offline') return matchesSearch && !c.isOnline;
    return matchesSearch;
  }).sort((a, b) => {
    // Okunmamış mesajı olanlar en üstte
    const roomA = ["dm", ...[user?.uid, a.uid].filter(Boolean).sort()].join("_");
    const roomB = ["dm", ...[user?.uid, b.uid].filter(Boolean).sort()].join("_");
    const unreadA = unreadMessages[roomA] || 0;
    const unreadB = unreadMessages[roomB] || 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    // Online olanlar sonra
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    // Alfabetik
    return a.full_name.localeCompare(b.full_name);
  });
  // lastDmEvent bağımlılığı: re-render tetikleyici (kullanılmasa bile referans gerekli)
  void lastDmEvent;

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

      {/* Mobil: Kişi seçildiğinde tam ekran chat */}
      {selectedContact && (
        <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <FloatingChat
            inline
            roomId={["dm", ...[user!.uid, selectedContact.uid!].sort()].join("_")}
            title={selectedContact.full_name}
            type="dm"
            isOnline={selectedContact.isOnline}
            recipientId={selectedContact.uid!}
            onClose={() => setSelectedContact(null)}
          />

        </div>
      )}

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
              onClick={() => setFilterStatus('offline')}
              className={cn(
                "flex-1 min-w-[60px] py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                filterStatus === 'offline' ? "bg-card text-slate-600 dark:text-slate-300 shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              Çevrimdışı
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
                          !contact.isRegistered && "opacity-60 cursor-not-allowed grayscale-[0.5]",
                          selectedContact?.uid === contact.uid && "bg-primary/5 dark:bg-primary/10 border-l-2 border-primary"
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
                          {(() => {
                             const roomId = ["dm", ...[user?.uid, contact.uid].filter(Boolean).sort()].join("_");
                             const count = unreadMessages[roomId];
                             return count > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                                  {count}
                                </span>
                             );
                          })()}
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

        {/* Main: Inline Chat or Empty State */}
        <div className="hidden md:flex md:col-span-8 flex-col h-full">
          {selectedContact ? (
            <FloatingChat
              inline
              roomId={["dm", ...[user!.uid, selectedContact.uid!].sort()].join("_")}
              title={selectedContact.full_name}
              type="dm"
              isOnline={selectedContact.isOnline}
              recipientId={selectedContact.uid!}
              onClose={() => setSelectedContact(null)}
            />

          ) : (
            <div className="flex-1 bg-card/50 border border-slate-200 dark:border-slate-800 border-dashed rounded-3xl flex flex-col items-center justify-center text-center p-12 space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center text-slate-300 dark:text-slate-600">
                <MessageSquare size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-outfit">Sohbet Başlatın</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm text-sm font-medium">
                  Sol taraftaki listeden bir ekip arkadaşınızı seçerek özel bir yazışma başlatabilirsiniz. Kişi çevrimdışı olsa bile mesajınız iletilir.
                </p>
              </div>
              <div className="pt-4 grid grid-cols-2 gap-4 w-full max-w-md">
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 text-left">
                  <div className="text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1">Online</div>
                  <p className="text-slate-600 dark:text-slate-400 text-[10px] font-bold leading-relaxed">Yeşil ışık yanan kişiler şu an aktif ve anlık mesaj alabilir.</p>
                </div>
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 text-left">
                  <div className="text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-1">Offline</div>
                  <p className="text-slate-600 dark:text-slate-400 text-[10px] font-bold leading-relaxed">Gri ışıklı kişilere mesaj yazabilirsin, online olunca iletilir.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
