import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Minus, MessageSquare, Send, Paperclip, Smile, Image as ImageIcon, Search, FileText, Trash2, Edit3, Download } from 'lucide-react';
import { WS_URL, API_URL } from '../lib/config';
import { useAuth } from '../lib/hooks/useAuth';
import { usePresence } from '../lib/context/PresenceContext';
import { useTheme } from "../lib/context/ThemeContext";
import { isElectron } from '../lib/firebase';
import EmojiPicker, { type EmojiClickData, Theme as EmojiTheme } from 'emoji-picker-react';
import { toast } from 'react-hot-toast';
import { uploadFile } from '../lib/api/files';

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
  const { markAsRead } = usePresence();
  const { theme } = useTheme();
  const isDark = (theme as string) === "dark";
  const normalizedRoomId = normalizeRoomId(roomId, type);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasNew, setHasNew] = useState(false);
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
      markAsRead(normalizedRoomId);
    }
  }, [roomId, type, user, markAsRead, normalizedRoomId]);

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
          markAsRead(normalizedRoomId);
          audioRef.current?.play().catch(() => {});
          
          // Minimize ise "Yeni Mesaj" uyarısı ver
          if (isMinimized) {
            setHasNew(true);
          }
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
            markAsRead(normalizedRoomId);
            audioRef.current?.play().catch(() => {});

            // Minimize ise "Yeni Mesaj" uyarısı ver
            if (isMinimized) {
              setHasNew(true);
            }
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
  }, [normalizedRoomId, roomId, user, profile?.full_name, type, isMinimized]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading(`${file.name} yükleniyor...`);
    try {
      const result = await uploadFile(file, "chats");
      const senderName = profile?.full_name || user?.displayName || user?.email?.split('@')[0] || 'Müfettiş';
      pushMessage({
        id: `local_${Date.now()}`,
        sender_id: user?.uid || '',
        sender_name: senderName,
        content: '',
        timestamp: new Date().toISOString(),
        attachment: { 
          type: 'file', 
          name: file.name, 
          url: result.url, 
          mime: file.type, 
          size: file.size 
        },
      });
      toast.success("Dosya gönderildi", { id: loadingToast });
    } catch (err) {
      console.error("Dosya yükleme hatası:", err);
      toast.error("Dosya gönderilemedi.", { id: loadingToast });
    } finally {
      e.target.value = '';
    }
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
      setMessages([]);
      toast.success('Sohbet sizin için temizlendi.');
    } catch (e) {
      console.error('Sohbet temizleme hatası:', e);
      toast.error('Sohbet temizlenemedi.');
    }
  };

  const BACKEND_BASE_URL = API_URL.replace(/\/api\/?$/, '');

  const resolveAttachmentUrl = (url: string) => {
    if (!url) return '';
    const raw = String(url).trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return encodeURI(raw);
    return encodeURI(`${BACKEND_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`);
  };

  const saveAttachmentToDisk = async (att: Attachment) => {
    try {
      const resolvedUrl = resolveAttachmentUrl(att.url);
      const ipcRenderer = (window as any)?.require?.('electron')?.ipcRenderer;
      if (!ipcRenderer?.invoke) return false;
      const result = await ipcRenderer.invoke('download-file-with-dialog', {
        url: resolvedUrl,
        fileName: att.name || 'dosya'
      });
      if (result?.ok) {
        toast.success('Dosya kaydedildi.');
        return true;
      }
      if (!result?.canceled) toast.error(result?.error || 'Dosya kaydedilemedi.');
      return false;
    } catch {
      toast.error('Dosya kaydedilemedi.');
      return false;
    }
  };

  // ── render helpers ────────────────────────────────────────────────────
  const renderAttachment = (att: Attachment, isOwn: boolean) => {
    const resolvedUrl = resolveAttachmentUrl(att.url);
    if (att.type === 'gif') return <img src={resolvedUrl} alt="GIF" className="max-w-[200px] rounded-xl mt-1 shadow-sm" />;
    const isImage = att.mime?.startsWith('image/');
    if (isImage) {
      return (
        <div className="mt-1">
          <img src={resolvedUrl} alt={att.name} className="max-w-[200px] rounded-xl shadow-sm hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => window.open(resolvedUrl, '_blank')} />
          <p className="text-[9px] font-bold opacity-60 mt-1 truncate max-w-[200px]">{att.name}</p>
        </div>
      );
    }
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <a href={resolvedUrl} download={att.name} className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${isOwn ? 'border-white/20 text-white/90 hover:bg-white/10' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <FileText size={14} className={isOwn ? 'text-white/60' : 'text-slate-400'} />
          <span className="truncate max-w-[120px]">{att.name}</span>
          <span className="opacity-50 shrink-0">{att.size ? `${(att.size / 1024).toFixed(0)} KB` : ''}</span>
        </a>
        {isElectron && (
          <button type="button" onClick={() => saveAttachmentToDisk(att)} className={`px-2.5 py-2 rounded-xl border text-xs font-black transition-all ${isOwn ? 'border-white/20 text-white/90 hover:bg-white/10' : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="Kaydet">
            <Download size={13} />
          </button>
        )}
      </div>
    );
  };

  // ── minimized (Bottom Bar Style) ──────────────────────────────────────
  if (isMinimized) {
    return (
      <div 
        onClick={() => { setIsMinimized(false); setHasNew(false); }}
        className={`group flex items-center gap-3 w-[240px] h-10 px-4 bg-[#1E293B] text-white cursor-pointer transition-all duration-300 hover:bg-[#334155] border-t border-x border-white/10 shadow-[0_-4px_15px_rgba(0,0,0,0.1)] ${hasNew ? 'animate-pulse ring-2 ring-blue-500' : ''}`}
        style={{ borderRadius: '12px 12px 0 0' }}
      >
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
          {hasNew && <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping" />}
        </div>
        <span className="flex-1 text-[11px] font-black uppercase tracking-widest truncate">{title}</span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 hover:bg-red-500 rounded-lg transition-colors text-white/40 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // ── full window (Docked Style) ────────────────────────────────────────
  return (
    <div className={inline
      ? "relative w-full h-full bg-card border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col overflow-hidden"
      : "relative w-[320px] bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col animate-in slide-in-from-bottom-5 duration-300"
    } style={inline ? undefined : { height: 480 }}>

      {/* Header */}
      <div className="bg-[#1E293B] p-4 flex items-center justify-between text-white border-b border-white/10 shrink-0" style={inline ? { borderRadius: '23px 23px 0 0' } : { borderRadius: '23px 23px 0 0' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full border-2 border-[#1E293B] ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-400'}`} />
            {isOnline && <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20" />}
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-widest truncate max-w-[140px]">{title}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'} 
              <span className="w-1 h-1 bg-slate-600 rounded-full" /> 
              {type === 'dm' ? 'Özel' : type === 'audit' ? 'Denetim' : 'Genel'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {type === 'dm' && messages.length > 0 && (
            <button
              onClick={clearMyMessages}
              className="px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/10"
              title="Sohbeti temizle"
            >
              TEMİZLE
            </button>
          )}
          {!inline && (
            <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-white/50 hover:text-white">
              <Minus size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-red-500 rounded-xl transition-all text-white/50 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC] dark:bg-[#0F172A] no-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-[24px] flex items-center justify-center">
              <MessageSquare size={28} className="opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] italic opacity-40">Uçtan Uca Şifreli</p>
              <p className="text-[11px] font-bold leading-relaxed opacity-60">
                {type === 'dm' ? 'Güvenli mesajlaşma başlatıldı.' : 'Genel oda mesajları geçicidir.'}
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isOwn = msg.sender_id === user?.uid;
          const showName = !isOwn && (idx === 0 || messages[idx-1].sender_id !== msg.sender_id);
          
          return (
            <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} group/msg animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              {showName && (
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{msg.sender_name}</span>
              )}
              <div className={`relative max-w-[85%] ${msg.content ? 'px-4 py-3' : 'p-1'} rounded-[20px] text-[13px] font-medium shadow-sm transition-all ${isOwn 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-500/10' 
                : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-white/5 rounded-tl-none'}`}>
                
                {editingMessageId === msg.id ? (
                  <div className="space-y-3 min-w-[200px] p-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-xs bg-slate-50 text-slate-900 border-none outline-none focus:ring-2 ring-blue-500/20"
                      autoFocus
                      rows={2}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelEditMessage} className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">VAZGEÇ</button>
                      <button type="button" onClick={() => saveEditMessage(msg.id)} className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">KAYDET</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.content && <span className="leading-relaxed">{msg.content}</span>}
                    {msg.attachment && renderAttachment(msg.attachment, isOwn)}
                  </>
                )}
                
                {isOwn && type === 'dm' && editingMessageId !== msg.id && (
                  <div className="absolute -left-16 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all">
                    <button onClick={() => startEditMessage(msg)} className="p-2 text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-white/5"><Edit3 size={12} /></button>
                    <button onClick={() => deleteMessage(msg.id)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-white/5"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              <span className="text-[8px] font-bold text-slate-300 mt-1.5 uppercase tracking-tighter px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input Section */}
      <div className="shrink-0 p-4 bg-white dark:bg-[#0F172A] border-t border-slate-100 dark:border-white/5">
        {/* GIF / Emoji Panels (Relative to Input) */}
        {showEmoji && (
          <div className="absolute bottom-[80px] left-4 right-4 z-50">
            <div className="shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
              <EmojiPicker onEmojiClick={onEmojiClick} theme={isDark ? EmojiTheme.DARK : EmojiTheme.LIGHT} width="100%" height={320} skinTonesDisabled searchPlaceholder="Emoji ara..." />
            </div>
          </div>
        )}

        {showGif && (
          <div className="absolute bottom-[80px] left-4 right-4 z-50 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
              <Search size={14} className="text-slate-400" />
              <input autoFocus value={gifQuery} onChange={e => handleGifSearch(e.target.value)} placeholder="GIF ara..." className="flex-1 text-xs outline-none bg-transparent dark:text-white" />
              <button onClick={() => setShowGif(false)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-2 max-h-[240px] overflow-y-auto no-scrollbar bg-slate-50 dark:bg-[#0F172A]">
              {gifLoading ? (
                <div className="col-span-3 py-10 flex flex-col items-center gap-2"><Loader2 className="animate-spin text-primary" size={20} /><span className="text-[10px] font-bold text-slate-400">Yükleniyor</span></div>
              ) : gifs.map(gif => (
                <button key={gif.id} onClick={() => sendGif(gif)} className="rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all">
                  <img src={gif.preview} alt="gif" className="w-full h-16 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={sendMessage} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            <button type="button" onClick={() => { setShowEmoji(false); setShowGif(false); fileInputRef.current?.click(); }} className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all" title="Dosya"><Paperclip size={18} /></button>
            <button type="button" onClick={() => { setShowGif(false); setShowEmoji(v => !v); }} className={`p-2.5 rounded-xl transition-all ${showEmoji ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`} title="Emoji"><Smile size={18} /></button>
            <button type="button" onClick={() => { setShowEmoji(false); setShowGif(v => !v); }} className={`p-2.5 rounded-xl transition-all ${showGif ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`} title="GIF"><ImageIcon size={18} /></button>
            
            <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center px-4 h-11 border-2 border-transparent focus-within:border-blue-500/20 focus-within:bg-white dark:focus-within:bg-[#1E293B] transition-all">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => { setShowEmoji(false); setShowGif(false); }}
                placeholder="Mesajınızı yazın..."
                className="w-full bg-transparent border-none outline-none text-[13px] font-medium placeholder:text-slate-400 dark:text-white"
              />
            </div>
            
            <button type="submit" disabled={!input.trim()} className="h-11 w-11 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none">
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helper Icons ──────────────────────────────────────────────────────────
function Loader2(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props} className={cn("animate-spin", props.className)}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

