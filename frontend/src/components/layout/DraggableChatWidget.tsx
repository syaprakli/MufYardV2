import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, GripHorizontal, Music, Link as LinkIcon, Play, Pause, Disc } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/hooks/useAuth';
import { usePresence } from '../../lib/context/PresenceContext';
import { toast } from 'react-hot-toast';

export function DraggableChatWidget() {
    const { user } = useAuth();
    const { onlineUsers, messages: globalMessages, sendMessage: sendGlobalMessage, radioState, sendRadioCommand } = usePresence();
    const [isMinimized, setIsMinimized] = useState(true);
    const [newMessage, setNewMessage] = useState("");
    const [radioUrl, setRadioUrl] = useState("");
    const [showDjPanel, setShowDjPanel] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Sync Audio with Radio State
    useEffect(() => {
        if (!audioRef.current) {
            // Oracle IP from screenshot: 144.24.167.114
            audioRef.current = new Audio("http://144.24.167.114:8000/live");
            audioRef.current.crossOrigin = "anonymous";
        }
        
        if (radioState.playing) {
            audioRef.current.play().catch(() => {
                console.log("Autoplay blocked - User interaction needed");
            });
        } else {
            audioRef.current.pause();
        }
    }, [radioState.playing]);

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
                        style={{ height: '480px' }}
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
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setShowDjPanel(!showDjPanel)}
                                    className={cn(
                                        "p-2 rounded-full transition-all",
                                        showDjPanel ? "bg-white/20 text-white" : "hover:bg-white/10 text-blue-100"
                                    )}
                                    title="DJ Kabini"
                                >
                                    <Music size={16} className={cn(radioState.playing && "animate-bounce")} />
                                </button>
                                <button onClick={() => setIsMinimized(true)} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* DJ Kabini Panel */}
                        <AnimatePresence>
                            {showDjPanel && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-indigo-900/5 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/30 overflow-hidden"
                                >
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600", radioState.playing && "animate-spin-slow")}>
                                                <Disc size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Şu An Çalıyor</p>
                                                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 truncate">{radioState.title}</p>
                                                {radioState.dj_name && <p className="text-[9px] text-slate-500">DJ: {radioState.dj_name}</p>}
                                            </div>
                                            <button 
                                                onClick={() => sendRadioCommand(radioState.url, radioState.title, !radioState.playing)}
                                                className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all"
                                            >
                                                {radioState.playing ? <Pause size={16} /> : <Play size={16} />}
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input 
                                                    type="text"
                                                    placeholder="Şarkı/Video linki yapıştır..."
                                                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    value={radioUrl}
                                                    onChange={(e) => setRadioUrl(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            if (radioUrl.trim()) {
                                                                sendRadioCommand(radioUrl.trim(), "Yeni Şarkı Yükleniyor...", true);
                                                                setRadioUrl("");
                                                                toast.success("DJ Yayına Geçti!");
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    if (radioUrl.trim()) {
                                                        sendRadioCommand(radioUrl.trim(), "Yeni Şarkı Yükleniyor...", true);
                                                        setRadioUrl("");
                                                        toast.success("DJ Yayına Geçti!");
                                                    }
                                                }}
                                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-wider hover:bg-indigo-50 transition-all"
                                            >
                                                ÇAL
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
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
                                    return (
                                        <div key={msg.id || idx} className={cn("flex flex-col max-w-[85%]", isMine ? "items-end ml-auto" : "items-start")}>
                                            <span className="text-[9px] font-bold text-slate-400 mb-1 px-1">{msg.author_name}</span>
                                            <div className={cn(
                                                "px-4 py-2.5 text-[13px] font-medium shadow-sm",
                                                isMine 
                                                    ? "bg-blue-600 text-white rounded-2xl rounded-br-sm" 
                                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm"
                                            )}>
                                                {msg.text}
                                                {msg.attachments?.map((at:any, i:number) => (
                                                    <img key={i} src={at.url} className="mt-2 rounded-xl w-full" alt="attachment" />
                                                ))}
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
                {isMinimized ? <MessageSquare size={24} className={onlineUsers.length > 0 ? "animate-pulse" : ""} /> : <X size={24} />}
                {isMinimized && onlineUsers.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[10px] font-black">
                        {onlineUsers.length}
                    </span>
                )}
            </button>
        </motion.div>
    );
}
