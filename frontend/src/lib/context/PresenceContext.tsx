import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WS_URL, API_URL } from '../config';

import { fetchOnlineUsers } from '../api/online';
import { toast } from 'react-hot-toast';
import { useChat } from './ChatContext';
import { fetchGlobalMessages } from '../api/collaboration';


interface OnlineUser {
    uid: string;
    name: string;
}

interface Message {
    id: string;
    text: string;
    author_id: string;
    author_name: string;
    timestamp: string;
    attachments?: any[];
}

interface PresenceContextType {
    onlineUsers: OnlineUser[];
    wsConnected: boolean;
    isUserOnline: (uid: string) => boolean;
    messages: Message[];
    unreadMessages: Record<string, number>;
    markAsRead: (roomId: string) => void;
    sendMessage: (text: string, attachments?: any[]) => string;
    clearGlobalMessages: () => Promise<void>;
    clearLocalMessages: () => void;
}


const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

function normalizeOnlineUsers(users: OnlineUser[]) {
    const seen = new Set<string>();
    return users.filter((user) => {
        if (!user?.uid || seen.has(user.uid)) return false;
        seen.add(user.uid);
        return true;
    });
}

function resolvePresenceName(user: any, profileName?: string) {
    const normalizedProfile = (profileName || '').trim();
    if (normalizedProfile && normalizedProfile !== 'Müfettiş' && normalizedProfile !== 'Kullanıcı') {
        return normalizedProfile;
    }
    const displayName = (user?.displayName || '').trim();
    if (displayName && displayName !== 'Müfettiş' && displayName !== 'Kullanıcı') {
        return displayName;
    }
    const emailPrefix = (user?.email || '').split('@')[0]?.trim();
    return emailPrefix || user?.email || 'Kullanıcı';
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const { openChat } = useChat();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
    
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);
    const pingTimer = useRef<any>(null);
    const pongTimer = useRef<any>(null);
    const retryCountRef = useRef(0);
    const activeNameRef = useRef<string>('Kullanıcı');

    // Reset messages when user changes to avoid ghost messages
    useEffect(() => {
        setMessages([]);
    }, [user?.uid]);

    useEffect(() => {
        if (user?.uid) {
            activeNameRef.current = profile?.full_name || resolvePresenceName(user);
        }
    }, [user, profile]);

    // Sync Online Users via REST fallback
    useEffect(() => {
        if (!user?.uid) {
            setOnlineUsers([]);
            return;
        }

        let cancelled = false;
        const syncOnlineUsers = async () => {
            try {
                const data = await fetchOnlineUsers();
                if (!cancelled && Array.isArray(data)) {
                    setOnlineUsers(normalizeOnlineUsers(data));
                }
            } catch {
                // REST fallback silently fails
            }
        };

        syncOnlineUsers();

        const timer = setInterval(syncOnlineUsers, 15000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [user?.uid]);

    // Fetch Global Message History
    useEffect(() => {
        if (!user?.uid) return;

        const loadHistory = async () => {
            try {
                const history = await fetchGlobalMessages(50);
                if (Array.isArray(history)) {

                    const normalized = history.map((m: any) => ({
                        id: m.id,
                        text: m.text || m.content || '',
                        author_id: m.author_id,
                        author_name: m.author_name,
                        author_role: m.author_role || 'Müfettiş',
                        timestamp: m.timestamp,
                        attachments: m.attachments || []
                    }));
                    setMessages(normalized);
                }
            } catch (err) {
                console.error("Global history fetch error:", err);
            }
        };

        loadHistory();
    }, [user?.uid]);


    // WebSocket Connection Logic
    useEffect(() => {
        const connect = () => {
            if (!user?.uid) return;
            if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

            clearTimeout(retryTimer.current);

            try {
                const activeName = activeNameRef.current || resolvePresenceName(user);
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                // Force room_id=global for all users in the presence provider
                const wsUrl = `${baseWsUrl}/ws?uid=${encodeURIComponent(user.uid)}&name=${encodeURIComponent(activeName)}&room_id=global`;

                console.log("Connecting to WS:", wsUrl);
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("WS Connected successfully");
                    setWsConnected(true);
                    retryCountRef.current = 0;
                    clearInterval(pingTimer.current);
                    pingTimer.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                            clearTimeout(pongTimer.current);
                            pongTimer.current = setTimeout(() => {
                                console.warn("Pong timeout, closing connection");
                                ws.close();
                            }, 5000);
                        }
                    }, 20000);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'pong') {
                            clearTimeout(pongTimer.current);
                            return;
                        }

                        // Handle Presence Updates
                        if (data.type === 'presence' && Array.isArray(data.users)) {
                            setOnlineUsers(normalizeOnlineUsers(data.users));
                            return;
                        }

                        // Handle Messages (Universal Logic)
                        const msgContent = data.content || data.text || data.message || "";
                        const msgAttachments = data.attachments || (data.attachment ? [data.attachment] : []);
                        const msgRoomId = data.room_id || 'global';
                        
                        // Metin VEYA ek varsa işle
                        if ((msgContent && typeof msgContent === 'string') || msgAttachments.length > 0) {
                            // Backend artık tüm mesajlara room_id ekliyor.
                            if (msgRoomId.startsWith('dm_')) {
                                // DM ise diğer bileşenlerin (FloatingChat gibi) yakalaması için bir event fırlat
                                // Data içindeki content/text alanlarını her ihtimale karşı senkronla
                                data.content = msgContent;
                                data.text = msgContent;
                                window.dispatchEvent(new CustomEvent('mufyard:new_message', { detail: data }));
                                
                                // Okunmamış mesaj sayısını artır (Eğer gönderen ben değilsem)
                                const senderId = data.sender_id || data.author_id;
                                if (senderId !== user?.uid) {
                                    setUnreadMessages(prev => ({
                                        ...prev,
                                        [msgRoomId]: (prev[msgRoomId] || 0) + 1
                                    }));

                                    // Toast bildirimi göster
                                    toast.success(`${data.sender_name || data.author_name || 'Bir Müfettiş'}: ${msgContent || 'Bir dosya gönderdi'}`, {
                                        icon: '💬',
                                        duration: 4000,
                                        position: 'top-center'
                                    });

                                    // SOHBET KUTUSUNU OTOMATİK AÇ (Kullanıcının isteği üzerine)
                                    openChat(msgRoomId, data.sender_name || data.author_name, 'dm', senderId);
                            }
                            return;
                        }

                        // Handle Message Updates (Edits)
                        if (data.type === 'update_message') {
                            const updatedMsg = data.message || data;
                            setMessages(prev => prev.map(m => m.id === data.message_id || m.id === updatedMsg.id ? { 
                                ...m, 
                                text: updatedMsg.text || updatedMsg.content || m.text 
                            } : m));
                            
                            // Ayrıca DM ise FloatingChat'e bildir (Event üzerinden)
                            if (data.room_id?.startsWith('dm_')) {
                                window.dispatchEvent(new CustomEvent('mufyard:message_updated', { detail: data }));
                            }
                            return;
                        }

                        // Handle Message Deletions
                        if (data.type === 'delete_message') {
                            setMessages(prev => prev.filter(m => m.id !== data.message_id));
                            
                            // Ayrıca DM ise FloatingChat'e bildir (Event üzerinden)
                            if (data.room_id?.startsWith('dm_')) {
                                window.dispatchEvent(new CustomEvent('mufyard:message_deleted', { detail: data }));
                            }
                            return;
                        }

                        // Handle Clear Messages
                        if (data.type === 'clear_messages') {
                            if (data.room_id === 'global') {
                                setMessages([]);
                            } else if (data.room_id?.startsWith('dm_')) {
                                window.dispatchEvent(new CustomEvent('mufyard:messages_cleared', { detail: data }));
                            }
                            return;
                        }

                        // Global mesaj ise listeye ekle (Canlı Müzakere)
                            const newMsg: Message = {
                                id: data.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                                text: msgContent,
                                author_id: data.author_id || data.sender_id,
                                author_name: data.author_name || data.sender_name || 'Müfettiş',
                                timestamp: data.timestamp || new Date().toISOString(),
                                attachments: msgAttachments
                            };

                            setMessages(prev => {
                                // ID kontrolü ile mükerrer mesajı önle
                                if (prev.some(m => m.id === newMsg.id)) return prev;
                                return [...prev, newMsg];
                            });
                        }

                    } catch (err) {
                        console.error('WS Message parsing error:', err);
                    }
                };

                ws.onclose = () => {
                    console.log("WS Closed, retrying...");
                    setWsConnected(false);
                    clearInterval(pingTimer.current);
                    clearTimeout(pongTimer.current);
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
                    retryCountRef.current += 1;
                    retryTimer.current = setTimeout(connect, delay);
                };

                ws.onerror = (err) => {
                    console.error("WS Socket error:", err);
                    ws.close();
                };
            } catch (err) {
                console.error("WS Connection error:", err);
                setWsConnected(false);
                retryTimer.current = setTimeout(connect, 3000);
            }
        };

        if (user?.uid) {
            connect();
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            clearTimeout(retryTimer.current);
            clearInterval(pingTimer.current);
            clearTimeout(pongTimer.current);
        };
    }, [user?.uid]);

    const isUserOnline = useCallback((uid: string) => {
        return onlineUsers.some(u => u.uid === uid);
    }, [onlineUsers]);

    const markAsRead = useCallback((roomId: string) => {
        setUnreadMessages(prev => {
            if (!prev[roomId]) return prev;
            const next = { ...prev };
            delete next[roomId];
            return next;
        });
    }, []);

    const sendMessage = useCallback((content: string, attachments: any[] = []): string => {
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'message',
                room_id: 'global', // Explicitly set for public space
                id: msgId,
                content, // Use content to match DM schema
                text: content, // Fallback for legacy
                attachments,
                author_id: user?.uid,
                author_name: activeNameRef.current || resolvePresenceName(user),
                timestamp: new Date().toISOString()
            };
            wsRef.current.send(JSON.stringify(payload));
        } else {
            console.warn("WS not open, message not sent");
        }
        return msgId;
    }, [user?.uid]);


    const clearGlobalMessages = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/collaboration/messages?uid=${user?.uid}&role=${profile?.role || 'user'}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setMessages([]);
                toast.success("Sohbet geçmişi temizlendi.");
            }
        } catch (err) {
            console.error("Clear messages error:", err);
            toast.error("Sohbet temizlenemedi.");
        }
    }, [user?.uid, profile?.role]);

    const clearLocalMessages = useCallback(() => {
        setMessages([]);
        toast.success("Görünüm temizlendi.");
    }, []);


    return (
        <PresenceContext.Provider value={{ 
            onlineUsers, wsConnected, isUserOnline, messages, unreadMessages, markAsRead, 
            sendMessage, clearGlobalMessages, clearLocalMessages
        }}>
            {children}
        </PresenceContext.Provider>
    );

}

export function usePresence() {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        return {
            onlineUsers: [],
            wsConnected: false,
            isUserOnline: () => false,
            messages: [],
            unreadMessages: {},
            markAsRead: () => {},
            sendMessage: () => "",
            clearGlobalMessages: async () => {},
            clearLocalMessages: () => {}
        } as PresenceContextType;

    }
    return context;
}
