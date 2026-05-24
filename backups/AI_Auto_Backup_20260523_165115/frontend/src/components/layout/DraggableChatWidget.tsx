import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, GripHorizontal, ChevronDown, ChevronUp, Edit3, Trash2, Loader2 } from 'lucide-react';
import { cn, getUserColor } from '../../lib/utils';
import { useAuth } from '../../lib/hooks/useAuth';
import { usePresence } from '../../lib/context/PresenceContext';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../lib/config';

export function DraggableChatWidget() {
    const { user } = useAuth();
    const { onlineUsers, messages: globalMessages, sendMessage: sendGlobalMessage, clearLocalMessages } = usePresence();
    const [isMinimized, setIsMinimized] = useState(true);
    const [newMessage, setNewMessage] = useState("");
    const [editingMessage, setEditingMessage] = useState<{id: string, text: string} | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const { profile } = useAuth();

    // Scroll to bottom
    useEffect(() => {
        if (!isMinimized) {
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [globalMessages, isMinimized]);

    const handleSendChat = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !user) return;

        sendGlobalMessage(newMessage);
        setNewMessage("");
    };

    const handleEditMessage = async (id: string, text: string) => {
        try {
            const res = await fetch(`${API_URL}/collaboration/messages/${id}?uid=${user?.uid}&role=${profile?.role || 'user'}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                setEditingMessage(null);
                toast.success("Mesaj güncellendi.");
            }
        } catch {
            toast.error("Güncellenemedi.");
        }
    };

    const handleDeleteMessage = async (id: string) => {
        if (!window.confirm("Bu mesajı silmek istediğinize emin misiniz?")) return;
        setIsDeleting(id);
        try {
            const res = await fetch(`${API_URL}/collaboration/messages/${id}?uid=${user?.uid}&role=${profile?.role || 'user'}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success("Mesaj silindi.");
            }
        } catch {
            toast.error("Silinemedi.");
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <motion.div
            drag
            dragMomentum={false}
            className="fixed z-[9998] flex flex-col items-center group cursor-grab active:cursor-grabbing"
            style={{ right: '2rem', bottom: '7rem' }} // Varsayılan konum
            title="Tutup istediğiniz yere sürükleyebilirsiniz"
        >
            {/* Sürükleme İpucu */}
            <div className={cn(
                "mb-2 p-1.5 rounded-full bg-slate-800 text-slate-400 shadow-xl transition-all duration-300",
                "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none"
            )}>
                <GripHorizontal size={14} />
            </div>

            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="absolute bottom-[4.5rem] right-0 w-[340px] sm:w-[380px] bg-card border border-border rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.3)] flex flex-col overflow-hidden"
                        style={{ height: '520px' }}
                        onPointerDown={(e) => e.stopPropagation()} // Sürüklenmeyi engelle
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-wider">Canlı Müzakere</h3>
                                    <p className="text-[10px] font-bold text-blue-100 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                        {onlineUsers.length} kişi aktif
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={clearLocalMessages}
                                    className="p-2 hover:bg-white/10 rounded-full transition-all text-white/70 hover:text-white" 
                                    title="Sohbeti Temizle (Kendi Sayfan)"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button onClick={() => setIsMinimized(true)} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition-all" title="Gizle">
                                    <ChevronDown size={16} />
                                </button>
                                <button onClick={() => setIsMinimized(true)} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
                            <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-black rounded-lg">
                                    Mesajlar kaydedilmez (Uçtan Uca Geçici)
                                </span>
                            </div>

                            {globalMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                    <MessageSquare size={40} className="opacity-20" />
                                    <p className="text-xs font-bold">Müzakereye ilk mesajı siz yazın.</p>
                                </div>
                            ) : (
                                globalMessages.map((msg, idx) => {
                                    const isMine = msg.author_id === user?.uid;
                                    const isAdmin = profile?.role === 'admin';
                                    const isEditing = editingMessage?.id === msg.id;

                                    return (
                                        <div key={msg.id || idx} className={cn("flex flex-col max-w-[90%] group/item", isMine ? "items-end ml-auto" : "items-start")}>
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                {!isMine && <span className="text-[9px] font-bold text-slate-400">{msg.author_name}</span>}
                                                {(isMine || isAdmin) && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        {isMine && !isEditing && (
                                                            <button 
                                                                onClick={() => setEditingMessage({ id: msg.id, text: msg.text })}
                                                                className="text-slate-400 hover:text-blue-500 transition-colors"
                                                            >
                                                                <Edit3 size={10} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors"
                                                            disabled={isDeleting === msg.id}
                                                        >
                                                            {isDeleting === msg.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                                        </button>
                                                    </div>
                                                )}
                                                {isMine && <span className="text-[9px] font-bold text-slate-300">Siz</span>}
                                            </div>
                                            
                                            <div className={cn(
                                                "px-4 py-2.5 text-[13px] font-medium shadow-sm transition-all",
                                                isMine 
                                                    ? "bg-blue-600 text-white rounded-2xl rounded-tr-none" 
                                                    : cn(getUserColor(msg.author_id), "text-white rounded-2xl rounded-tl-none")
                                            )}>
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-2 min-w-[200px]">
                                                        <textarea 
                                                            autoFocus
                                                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white text-[12px] outline-none focus:border-white/40"
                                                            value={editingMessage.text}
                                                            onChange={e => setEditingMessage({...editingMessage, text: e.target.value})}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setEditingMessage(null)} className="text-[10px] font-black text-white/60 hover:text-white">İPTAL</button>
                                                            <button onClick={() => handleEditMessage(msg.id, editingMessage.text)} className="text-[10px] font-black text-blue-200 hover:text-white">KAYDET</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {msg.text}
                                                        {msg.attachments?.map((at:any, i:number) => (
                                                            <img key={i} src={at.url} className="mt-2 rounded-xl w-full" alt="attachment" />
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendChat} className="p-3 bg-card border-t border-border flex gap-2">
                            <input
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Mesaj yazın..."
                                className="flex-1 bg-muted rounded-2xl px-4 py-3 text-xs font-bold outline-none border border-transparent focus:border-blue-500/30 transition-all"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                <Send size={18} className="ml-1" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Bubble Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                }}
                onPointerDown={(e) => e.stopPropagation()} // Butona tıklarken sürüklenmeyi engelle
                className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95 relative"
            >
                {isMinimized ? <ChevronUp size={26} /> : <X size={24} />}
                {isMinimized && onlineUsers.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[10px] font-black">
                        {onlineUsers.length}
                    </span>
                )}
            </button>
        </motion.div>
    );
}
