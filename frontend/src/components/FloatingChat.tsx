import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Minus, MessageSquare, Send, Paperclip, Smile, Image as ImageIcon, Search, FileText, Trash2, Edit3 } from 'lucide-react';
import { WS_URL, API_URL } from '../lib/config';
import { useAuth } from '../lib/hooks/useAuth';
import { useTheme } from "../lib/context/ThemeContext";
import EmojiPicker, { type EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { toast } from 'react-hot-toast';

// ─── TENOR GIF API v1 (resmi demo key, kayıt gerektirmez) ───────────────────
const TENOR_KEY = 'LIVDSRZULELA';
const TENOR_BASE = 'https://g.tenor.com/v1';

interface GifResult { id: string; url: string; preview: string; }

async function searchGifs(query: string): Promise<GifResult[]> {
  try {
    const url = `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=12`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => {
      const media = r.media?.[0] || {};
      return { id: r.id, url: media.gif?.url || '', preview: media.tinygif?.url || media.gif?.url || '' };
    });
  } catch { return []; }
}

async function trendingGifs(): Promise<GifResult[]> {
  try {
    const url = `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=12`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => {
      const media = r.media?.[0] || {};
      return { id: r.id, url: media.gif?.url || '', preview: media.tinygif?.url || media.gif?.url || '' };
    });
  } catch { return []; }
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface Attachment { type: 'file' | 'gif'; name?: string; url: string; mime?: string; size?: number; }

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  attachment?: Attachment;
}

interface FloatingChatProps {
  roomId: string;
  title: string;
  onClose: () => void;
  type?: 'dm' | 'audit' | 'global';
  inline?: boolean;
  isOnline?: boolean;
}

function getDirectRoomUserIds(roomId: string, currentUid: string) {
  const normalized = roomId.startsWith('dm_') ? roomId.slice(3) : roomId;
  const parts = normalized.split('_');
  if (parts.length === 2) {
    return parts;
  }
  const otherUid = parts.find(part => part !== currentUid);
  return [currentUid, otherUid || currentUid];
}

function normalizeRoomId(roomId: string, type: FloatingChatProps['type']) {
  if (type !== 'dm') {
    return roomId;
  }

  const normalized = roomId.startsWith('dm_') ? roomId.slice(3) : roomId;
  const parts = normalized.split('_').filter(Boolean).sort();
  return parts.length >= 2 ? `dm_${parts.join('_')}` : `dm_${normalized}`;
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function FloatingChat({ roomId, title, onClose, type = 'dm', inline = false, isOnline }: FloatingChatProps) {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = (theme as string) === "dark";
  const normalizedRoomId = normalizeRoomId(roomId, type);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // panel states
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── sound ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // Zil sesi
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
  }, []);

  // ── history ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (type === 'dm' && user) {
      const fetchHistory = async () => {
        try {
          const [uid1, uid2] = getDirectRoomUserIds(roomId, user.uid);
          const otherUid = uid1 === user.uid ? uid2 : uid1;
          const res = await fetch(`${API_URL}/collaboration/dm/history?uid1=${user.uid}&uid2=${otherUid}`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data.map((m: any) => ({
              id: m.id,
              sender_id: m.sender_id,
              sender_name: m.sender_name,
              content: m.content,
              timestamp: m.timestamp,
              attachment: m.attachment
            })));
          }
        } catch (e) {
          console.error("Geçmiş yüklenemedi:", e);
        }
      };
      fetchHistory();
    }
  }, [roomId, type, user]);

  // ── websocket ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    
    let retryCount = 0;
    let retryTimer: any = null;

    const connect = () => {
      if (!user) return;
      const baseWs = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
      const senderName = profile?.full_name || user.displayName || user.email?.split('@')[0] || user.email || 'Kullanıcı';

      const socketUrl = `${baseWs}/ws?uid=${user.uid}&name=${encodeURIComponent(senderName)}&room_id=${normalizedRoomId}`;
      
      ws.current = new WebSocket(socketUrl);

      // Heartbeat interval
      let pingInterval: any = null;

      ws.current.onopen = () => {
        setIsConnected(true);
        retryCount = 0;
        
        // Start heartbeat
        pingInterval = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        if (pingInterval) clearInterval(pingInterval);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        console.log(`Chat WS [${roomId}]: Disconnected, retrying in ${delay/1000}s...`);
        retryTimer = setTimeout(connect, delay);
        retryCount += 1;
      };

      ws.current.onerror = (err) => {
        console.error(`Chat WS [${roomId}] error:`, err);
        ws.current?.close();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence') return;
          
          if (data.type === 'delete_message') {
            setMessages(prev => prev.filter(m => m.id !== data.message_id));
            return;
          }

          if (data.type === 'update_message' && data.message) {
            const updated = data.message;
            setMessages(prev => prev.map((m) => (
              m.id === updated.id
                ? {
                    ...m,
                    content: updated.content || m.content,
                    timestamp: updated.timestamp || m.timestamp,
                  }
                : m
            )));
            return;
          }

          if (data.type === 'clear_messages' && data.uid) {
            setMessages(prev => prev.filter(m => m.sender_id !== data.uid));
            return;
          }

          if (data.sender_id === user?.uid) return; // skip own echo
          
          // ODA FİLTRELEME: Eğer mesaj bu odaya ait değilse (veya global ise) DM penceresine ekleme
          if (data.room_id && data.room_id !== normalizedRoomId) return;
          if (!data.room_id && roomId !== 'global') return; // room_id yoksa ve biz global değilsek güvenli tarafta kal

          setMessages(prev => [...prev, {
            id: data.id || Math.random().toString(36).substr(2, 9),
            sender_id: data.sender_id,
            sender_name: data.sender_name,
            content: data.content || '',
            timestamp: data.timestamp || new Date().toISOString(),
            attachment: data.attachment,
          }]);
          audioRef.current?.play().catch(() => {});
        } catch (e) {
          console.error("Chat WS message error:", e);
        }
      };
    };

    connect();
    
    // Global socket'ten gelen DM mesajlarını yakala (Dispatcher Event)
    const handleGlobalMessage = (e: any) => {
        const data = e.detail;
        if (data && data.room_id === normalizedRoomId) {
            // Temizleme mesajı geldiyse ve bensem ekranı temizle
            if (data.type === 'clear_messages' && data.uid === user?.uid) {
                setMessages([]);
                return;
            }

            if (data.sender_id === user?.uid) return;
            
            setMessages(prev => {
                if (prev.some(m => m.id === data.id)) return prev;
                const newMsg: Message = {
                    id: data.id || Math.random().toString(36).substr(2, 9),
                    sender_id: data.sender_id,
                    sender_name: data.sender_name,
                    content: data.content || '',
                    timestamp: data.timestamp || new Date().toISOString(),
                    attachment: data.attachment,
                };
                return [...prev, newMsg];
            });
            audioRef.current?.play().catch(() => {});
        }
    };

    window.addEventListener('mufyard:new_message', handleGlobalMessage as any);

    return () => { 
      window.removeEventListener('mufyard:new_message', handleGlobalMessage as any);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.onmessage = null;
        ws.current.close();
      }
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [normalizedRoomId, roomId, user, profile?.full_name, type]);

  // ── auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isMinimized]);

  // ── GIF trending on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!showGif) return;
    if (gifs.length === 0) {
      setGifLoading(true);
      trendingGifs().then(r => { setGifs(r); setGifLoading(false); });
    }
  }, [showGif]);

  // ── GIF search debounce ────────────────────────────────────────────────
  const handleGifSearch = (q: string) => {
    setGifQuery(q);
    if (gifSearchTimer.current) clearTimeout(gifSearchTimer.current);
    if (!q.trim()) {
      setGifLoading(true);
      trendingGifs().then(r => { setGifs(r); setGifLoading(false); });
      return;
    }
    gifSearchTimer.current = setTimeout(async () => {
      setGifLoading(true);
      const r = await searchGifs(q);
      setGifs(r);
      setGifLoading(false);
    }, 400);
  };

  // ── send helpers ───────────────────────────────────────────────────────
  const pushMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'message',
        room_id: normalizedRoomId,
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        content: msg.content,
        attachment: msg.attachment,
      }));
    }
  }, [normalizedRoomId]);

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const senderName = profile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Müfettiş';
    pushMessage({ id: `local_${Date.now()}`, sender_id: user?.uid || '', sender_name: senderName, content: input.trim(), timestamp: new Date().toISOString() });
    setInput('');
    setShowEmoji(false);
  };

  const sendGif = (gif: GifResult) => {
    const senderName = user?.displayName || user?.email?.split('@')[0] || 'Müfettiş';
    pushMessage({ id: `local_${Date.now()}`, sender_id: user?.uid || '', sender_name: senderName, content: '', timestamp: new Date().toISOString(), attachment: { type: 'gif', url: gif.url } });
    setShowGif(false);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInput(prev => prev + emojiData.emoji);
    setShowEmoji(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const senderName = user?.displayName || user?.email?.split('@')[0] || 'Müfettiş';
      pushMessage({
        id: `local_${Date.now()}`,
        sender_id: user?.uid || '',
        sender_name: senderName,
        content: '',
        timestamp: new Date().toISOString(),
        attachment: { type: 'file', name: file.name, url: reader.result as string, mime: file.type, size: file.size },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/collaboration/dm/${roomId}/${messageId}?uid=${user.uid}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } else {
        toast.error("Mesaj silinemedi.");
      }
    } catch (e) {
      console.error("Silme hatası:", e);
    }
  };

  const startEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditText(msg.content || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const saveEditMessage = async (messageId: string) => {
    const trimmed = editText.trim();
    if (!trimmed || !user) return;
    try {
      const res = await fetch(`${API_URL}/collaboration/dm/${roomId}/${messageId}?uid=${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      if (!res.ok) {
        toast.error('Mesaj düzenlenemedi.');
        return;
      }
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: trimmed } : m)));
      cancelEditMessage();
    } catch (e) {
      console.error('Düzenleme hatası:', e);
      toast.error('Mesaj düzenlenemedi.');
    }
  };

  const clearMyMessages = async () => {
    if (!user || type !== 'dm') return;
    try {
      const encodedRoomId = encodeURIComponent(roomId);
      const res = await fetch(`${API_URL}/collaboration/dm/${encodedRoomId}/clear?uid=${encodeURIComponent(user.uid)}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Sohbet temizlenemedi.');
        return;
      }
      setMessages([]); // TÜMÜNÜ SİL (Backend benden temizle mantığı ile çalışıyor, sadece benim fetchlerimde gelmeyecek)
      toast.success('Sohbet sizin için temizlendi.');
    } catch (e) {
      console.error('Sohbet temizleme hatası:', e);
      toast.error('Sohbet temizlenemedi.');
    }
  };

  // ── render helpers ────────────────────────────────────────────────────
  const renderAttachment = (att: Attachment, isOwn: boolean) => {
    if (att.type === 'gif') {
      return <img src={att.url} alt="GIF" className="max-w-[200px] rounded-xl mt-1" />;
    }
    const isImage = att.mime?.startsWith('image/');
    if (isImage) {
      return (
        <div className="mt-1">
          <img src={att.url} alt={att.name} className="max-w-[200px] rounded-xl" />
          <p className="text-[9px] font-bold opacity-60 mt-0.5 truncate max-w-[200px]">{att.name}</p>
        </div>
      );
    }
    return (
      <a href={att.url} download={att.name} className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${isOwn ? 'border-white/20 text-white/90 hover:bg-white/10' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
        <FileText size={14} />
        <span className="truncate max-w-[140px]">{att.name}</span>
        <span className="opacity-50 shrink-0">{att.size ? `${(att.size / 1024).toFixed(0)} KB` : ''}</span>
      </a>
    );
  };

  // ── minimized ─────────────────────────────────────────────────────────
  if (isMinimized) {
    // Kişinin baş harflerini al
    const getInitials = (name: string) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    };
    const initials = getInitials(title);
    
    return (
      <div className="relative group">
        <div 
          onClick={() => setIsMinimized(false)} 
          className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all border-2 border-white"
          title={title}
        >
          <span className="text-xs font-black tracking-tight">{initials}</span>
        </div>
        {/* Bağlantı durumu noktası */}
        <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {/* Kapatma butonu */}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-sm"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  // ── full window ───────────────────────────────────────────────────────
  return (
    <div className={inline
      ? "relative w-full h-full bg-card border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col overflow-hidden"
      : "relative w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-5 duration-300"
    } style={inline ? undefined : { height: 420 }}>

      {/* Header */}
      <div className="bg-slate-900 p-3 flex items-center justify-between text-white border-b border-white/10 shrink-0" style={inline ? { borderRadius: 'calc(1.5rem - 1px) calc(1.5rem - 1px) 0 0' } : { borderRadius: '1rem 1rem 0 0' }}>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
          {inline && isOnline !== undefined && (
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
          )}
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest truncate max-w-[160px]">{title}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
              {inline && isOnline !== undefined
                ? (isOnline ? 'Şu an Online' : 'Çevrimdışı — Mesaj iletilecek')
                : type === 'audit' ? 'Denetim Odası' : type === 'dm' ? 'Özel Mesaj' : 'Genel Sohbet'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {type === 'dm' && (
            <button
              onClick={clearMyMessages}
              className="px-2 py-1 text-[10px] font-bold rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Kendi mesajlarınızı temizler"
            >
              Sohbeti Temizle
            </button>
          )}
          {!inline && <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/10 rounded transition-colors"><Minus size={14} /></button>}
          <button onClick={onClose} className="p-1 hover:bg-red-500 rounded transition-colors"><X size={14} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc] dark:bg-slate-950/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 space-y-2">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full"><MessageSquare size={24} className="opacity-20" /></div>
            <p className="text-[10px] font-bold uppercase tracking-widest italic">Oturum Başladı</p>
            <p className="text-[9px] font-medium leading-relaxed opacity-60">
              {type === 'dm' ? 'Mesajlarınız buluta kaydedilir.' : 'Mesajlar bu oturum özelindedir.'}
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.uid;
          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {!isOwn && <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-1 ml-1">{msg.sender_name}</span>}
              <div className={`group relative max-w-[85%] ${msg.content ? 'p-3' : 'p-1'} rounded-2xl text-xs font-medium shadow-sm leading-relaxed ${isOwn ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'}`}>
                {editingMessageId === msg.id ? (
                  <div className="space-y-2 min-w-[220px]">
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded-lg px-2 py-1 text-xs text-slate-900"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelEditMessage} className="px-2 py-1 text-[10px] rounded bg-white/20">Vazgeç</button>
                      <button type="button" onClick={() => saveEditMessage(msg.id)} className="px-2 py-1 text-[10px] rounded bg-white text-primary">Kaydet</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.content && <span>{msg.content}</span>}
                    {msg.attachment && renderAttachment(msg.attachment, isOwn)}
                  </>
                )}
                
                {isOwn && type === 'dm' && editingMessageId !== msg.id && (
                  <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => startEditMessage(msg)}
                      className="p-1.5 text-slate-300 hover:text-blue-500"
                      title="Düzenle"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      onClick={() => deleteMessage(msg.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500"
                      title="Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[8px] font-bold text-slate-300 mt-1 uppercase">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Emoji Picker */}
      {showEmoji && (
        <div className="absolute bottom-[72px] right-2 z-30" style={{ width: 320, maxWidth: "calc(100% - 16px)" }}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT} width={320} height={360} searchPlaceholder="Emoji ara..." />
        </div>
      )}

      {/* GIF Picker */}
      {showGif && (
        <div className="absolute bottom-[72px] right-2 z-30 w-80 max-w-[calc(100%-16px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={gifQuery}
              onChange={e => handleGifSearch(e.target.value)}
              placeholder="GIF ara..."
              className="flex-1 text-xs outline-none font-medium bg-transparent"
            />
            <button onClick={() => setShowGif(false)} className="text-slate-400 dark:text-slate-500 hover:text-red-500"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2 max-h-56 overflow-y-auto">
            {gifLoading && (
              <div className="col-span-3 flex items-center justify-center py-8 text-slate-400 text-xs">Yükleniyor...</div>
            )}
            {!gifLoading && gifs.length === 0 && (
              <div className="col-span-3 flex items-center justify-center py-8 text-slate-400 text-xs">Sonuç bulunamadı</div>
            )}
            {!gifLoading && gifs.map(gif => (
              <button key={gif.id} onClick={() => sendGif(gif)} className="rounded-lg overflow-hidden hover:scale-105 transition-transform">
                <img src={gif.preview} alt="gif" className="w-full h-20 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 relative">
        <form onSubmit={sendMessage} className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 rounded-b-2xl">
          {/* Dosya */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <button type="button" onClick={() => { setShowEmoji(false); setShowGif(false); fileInputRef.current?.click(); }} title="Dosya ekle" className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
            <Paperclip size={16} />
          </button>

          {/* Emoji */}
          <button type="button" onClick={() => { setShowGif(false); setShowEmoji(v => !v); }} title="Emoji" className={`p-2 transition-colors rounded-lg hover:bg-slate-50 ${showEmoji ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
            <Smile size={16} />
          </button>

          {/* GIF */}
          <button type="button" onClick={() => { setShowEmoji(false); setShowGif(v => !v); }} title="GIF" className={`p-2 transition-colors rounded-lg hover:bg-slate-50 ${showGif ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}>
            <ImageIcon size={16} />
          </button>

          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { setShowEmoji(false); setShowGif(false); }}
            placeholder="Mesajınızı yazın..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border-none outline-none text-xs p-2.5 rounded-xl font-medium focus:ring-2 focus:ring-primary/5 dark:text-slate-100 transition-all placeholder:text-slate-400"
          />

          <button type="submit" disabled={!input.trim()} className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
