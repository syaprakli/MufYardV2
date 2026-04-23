import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Minus, MessageSquare, Send, Paperclip, Smile, Image as ImageIcon, Search, FileText, Trash2 } from 'lucide-react';
import { WS_URL } from '../lib/config';
import { useAuth } from '../lib/hooks/useAuth';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';

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
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function FloatingChat({ roomId, title, onClose, type = 'dm' }: FloatingChatProps) {
  const { user } = useAuth();
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
          // room_id: dm_uid1_uid2 formatında
          const parts = roomId.split('_');
          const otherUid = parts[1] === user.uid ? parts[2] : parts[1];
          const res = await fetch(`http://localhost:8000/api/collaboration/dm/history?uid1=${user.uid}&uid2=${otherUid}`);
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
    const baseWs = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
    const socketUrl = `${baseWs}/api/collaboration/chat?uid=${user.uid}&name=${encodeURIComponent(user.displayName || user.email || 'Müfettiş')}&room_id=${roomId}`;
    ws.current = new WebSocket(socketUrl);
    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'presence') return;
      
      if (data.type === 'delete_message') {
        setMessages(prev => prev.filter(m => m.id !== data.message_id));
        return;
      }

      if (data.sender_id === user?.uid) return; // skip own echo
      setMessages(prev => [...prev, {
        id: data.id || Math.random().toString(36).substr(2, 9),
        sender_id: data.sender_id,
        sender_name: data.sender_name,
        content: data.content || '',
        timestamp: data.timestamp || new Date().toISOString(),
        attachment: data.attachment,
      }]);
      audioRef.current?.play().catch(() => {});
    };
    return () => { ws.current?.close(); };
  }, [roomId, user]);

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
        sender_id: msg.sender_id,
        sender_name: msg.sender_name,
        content: msg.content,
        attachment: msg.attachment,
      }));
    }
  }, []);

  const sendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const senderName = user?.displayName || user?.email?.split('@')[0] || 'Müfettiş';
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
      const res = await fetch(`http://localhost:8000/api/collaboration/dm/${roomId}/${messageId}?uid=${user.uid}`, {
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
      <a href={att.url} download={att.name} className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${isOwn ? 'border-white/20 text-white/90 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
        <FileText size={14} />
        <span className="truncate max-w-[140px]">{att.name}</span>
        <span className="opacity-50 shrink-0">{att.size ? `${(att.size / 1024).toFixed(0)} KB` : ''}</span>
      </a>
    );
  };

  // ── minimized ─────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div onClick={() => setIsMinimized(false)} className="w-64 bg-slate-900 text-white p-3 rounded-t-xl cursor-pointer flex items-center justify-between shadow-2xl hover:bg-slate-800 transition-all border-b-4 border-primary">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs font-bold truncate max-w-[140px] uppercase tracking-wider">{title}</span>
        </div>
        <X size={14} className="hover:text-red-400" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      </div>
    );
  }

  // ── full window ───────────────────────────────────────────────────────
  return (
    <div className="relative w-80 bg-white border border-slate-200 rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-5 duration-300" style={{ height: 420 }}>

      {/* Header */}
      <div className="bg-slate-900 p-3 rounded-t-2xl flex items-center justify-between text-white border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest truncate max-w-[160px]">{title}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
              {type === 'audit' ? 'Denetim Odası' : type === 'dm' ? 'Özel Mesaj' : 'Genel Sohbet'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/10 rounded transition-colors"><Minus size={14} /></button>
          <button onClick={onClose} className="p-1 hover:bg-red-500 rounded transition-colors"><X size={14} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <div className="p-3 bg-slate-100 rounded-full"><MessageSquare size={24} className="opacity-20" /></div>
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
              {!isOwn && <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 ml-1">{msg.sender_name}</span>}
              <div className={`group relative max-w-[85%] ${msg.content ? 'p-3' : 'p-1'} rounded-2xl text-xs font-medium shadow-sm leading-relaxed ${isOwn ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                {msg.content && <span>{msg.content}</span>}
                {msg.attachment && renderAttachment(msg.attachment, isOwn)}
                
                {isOwn && type === 'dm' && (
                  <button 
                    onClick={() => deleteMessage(msg.id)}
                    className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
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
        <div className="absolute bottom-[72px] right-0 z-[9999]" style={{ width: 320 }}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.LIGHT} width={320} height={360} searchPlaceholder="Emoji ara..." />
        </div>
      )}

      {/* GIF Picker */}
      {showGif && (
        <div className="absolute bottom-[72px] right-0 z-[9999] w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              autoFocus
              value={gifQuery}
              onChange={e => handleGifSearch(e.target.value)}
              placeholder="GIF ara..."
              className="flex-1 text-xs outline-none font-medium bg-transparent"
            />
            <button onClick={() => setShowGif(false)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
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
        <form onSubmit={sendMessage} className="p-2 bg-white border-t border-slate-100 flex items-center gap-1.5 rounded-b-2xl">
          {/* Dosya */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <button type="button" onClick={() => { setShowEmoji(false); setShowGif(false); fileInputRef.current?.click(); }} title="Dosya ekle" className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-50">
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
            className="flex-1 bg-slate-50 border-none outline-none text-xs p-2.5 rounded-xl font-medium focus:ring-2 focus:ring-primary/5 transition-all"
          />

          <button type="submit" disabled={!input.trim()} className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
