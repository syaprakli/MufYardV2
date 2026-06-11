import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { fetchGlobalMessages, sendGlobalMessage } from '../api/collaboration';
import { fetchOnlineUsers } from '../api/online';
import { API_URL, WS_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useChat } from './ChatContext';
import { getAuthHeaders } from '../api/utils';

interface OnlineUser {
    uid: string;
    name: string;
}

interface Message {
    id: string;
    text: string;
    author_id: string;
    author_name: string;
    author_role?: string;
    timestamp: string;
    attachments?: any[];
}

interface PresenceContextType {
    onlineUsers: OnlineUser[];
    wsConnected: boolean;
    restConnected: boolean;
    isUserOnline: (uid: string) => boolean;
    messages: Message[];
    unreadMessages: Record<string, number>;
    markAsRead: (roomId: string) => void;
    sendMessage: (content: string, attachments?: any[]) => string;
    clearGlobalMessages: () => Promise<void>;
    clearLocalMessages: () => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

function safeParse(raw: string) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function normalizeOnlineUsers(users: any[]): OnlineUser[] {
    return (users || [])
        .map((user) => ({
            uid: user.uid || user.user_id || user.id || '',
            name: user.name || user.author_name || user.display_name || 'Kullanıcı',
        }))
        .filter((user) => user.uid);
}

function resolvePresenceName(user: any): string {
    const displayName = (user?.displayName || '').trim();
    if (displayName && displayName !== 'Müfettiş' && displayName !== 'Kullanıcı') {
        return displayName;
    }
    const emailPrefix = user?.email?.split('@')[0]?.trim();
    return emailPrefix || user?.email || 'Kullanıcı';
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const { openChat } = useChat();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [restConnected, setRestConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
    
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);
    const pingTimer = useRef<any>(null);
    const pongTimer = useRef<any>(null);
    const retryCountRef = useRef(0);
    const activeNameRef = useRef<string>('Kullanıcı');

    const pollingTimer = useRef<any>(null);
    const pollingIntervalRef = useRef(5000);
    const lastPolledMessageId = useRef<string | null>(null);
    const toastShownRef = useRef(false);
    const [connectionFailed, setConnectionFailed] = useState(false);


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
            setRestConnected(false);
            return;
        }

        let cancelled = false;
        const syncOnlineUsers = async () => {
            try {
                const data = await fetchOnlineUsers();
                const rawUsers = Array.isArray(data)
                    ? data
                    : Array.isArray((data as any)?.users)
                        ? (data as any).users
                        : [];

                if (!cancelled) {
                    setOnlineUsers(normalizeOnlineUsers(rawUsers));
                    setRestConnected(true);
                }
            } catch {
                if (!cancelled) {
                    setRestConnected(false);
                }
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

    // Poll Global Messages (REST Fallback)
    const pollGlobalMessages = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const history = await fetchGlobalMessages(25);
            if (Array.isArray(history) && history.length > 0) {
                const normalized = history.map((m: any) => ({
                    id: m.id,
                    text: m.text || m.content || '',
                    author_id: m.author_id,
                    author_name: m.author_name,
                    author_role: m.author_role || 'Müfettiş',
                    timestamp: m.timestamp,
                    attachments: m.attachments || []
                }));
                
                const lastMsg = normalized[normalized.length - 1];
                if (lastPolledMessageId.current && lastMsg && lastMsg.id !== lastPolledMessageId.current) {
                    pollingIntervalRef.current = 5000;
                } else {
                    pollingIntervalRef.current = Math.min(pollingIntervalRef.current * 1.5, 20000);
                }
                if (lastMsg) {
                    lastPolledMessageId.current = lastMsg.id;
                }
                
                setMessages(prev => {
                    const existingIds = new Set(prev.map(m => m.id));
                    const newMsgs = normalized.filter(m => !existingIds.has(m.id));
                    if (newMsgs.length === 0) return prev;
                    return [...prev, ...newMsgs];
                });
            }
        } catch (err) {
            console.error("Error polling global messages:", err);
        }
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            setConnectionFailed(false);
            return;
        }

        if (wsConnected) {
            setConnectionFailed(false);
            return;
        }

        const timer = setTimeout(() => {
            setConnectionFailed(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, [wsConnected, user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            clearTimeout(pollingTimer.current);
            return;
        }

        if (!wsConnected) {
            if (connectionFailed && !toastShownRef.current) {
                toast.error("Canlı bağlantı kurulamadı. Arka plan sorgulama (HTTP Polling) moduna geçildi.", {
                    id: 'ws-fallback-warning',
                    duration: 4000,
                });
                toastShownRef.current = true;
            }

            pollGlobalMessages();

            const runPolling = () => {
                pollingTimer.current = setTimeout(async () => {
                    await pollGlobalMessages();
                    runPolling();
                }, pollingIntervalRef.current);
            };
            runPolling();
        } else {
            clearTimeout(pollingTimer.current);
            toastShownRef.current = false;
        }

        return () => {
            clearTimeout(pollingTimer.current);
        };
    }, [wsConnected, connectionFailed, user?.uid, pollGlobalMessages]);

    // WebSocket Connection Logic
    useEffect(() => {
        if (!user?.uid) return;

        const scheduleReconnect = () => {
            clearTimeout(retryTimer.current);
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
            retryCountRef.current += 1;
            retryTimer.current = setTimeout(connect, delay);
        };

        const handleMessage = (data: any) => {
            if (!data) return;

            if (data.type === 'presence' && Array.isArray(data.users)) {
                setOnlineUsers(normalizeOnlineUsers(data.users));
                return;
            }

            const msgContent = data.content || data.text || data.message || '';
            const msgAttachments = data.attachments || (data.attachment ? [data.attachment] : []);
            const msgRoomId = data.room_id || 'global';

            if ((msgContent && typeof msgContent === 'string') || msgAttachments.length > 0) {
                if (msgRoomId.startsWith('dm_')) {
                    data.content = msgContent;
                    data.text = msgContent;
                    window.dispatchEvent(new CustomEvent('mufyard:new_message', { detail: data }));

                    const senderId = data.sender_id || data.author_id;
                    if (senderId !== user?.uid) {
                        setUnreadMessages(prev => ({
                            ...prev,
                            [msgRoomId]: (prev[msgRoomId] || 0) + 1
                        }));

                        toast.success(`${data.sender_name || data.author_name || 'Bir Müfettiş'}: ${msgContent || 'Bir dosya gönderdi'}`, {
                            icon: '💬',
                            duration: 4000,
                            position: 'top-center'
                        });

                        openChat(msgRoomId, data.sender_name || data.author_name, 'dm', senderId);
                    }
                    return;
                }

                const newMsg: Message = {
                    id: data.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                    text: msgContent,
                    author_id: data.author_id || data.sender_id,
                    author_name: data.author_name || data.sender_name || 'Müfettiş',
                    author_role: data.author_role || 'Müfettiş',
                    timestamp: data.timestamp || new Date().toISOString(),
                    attachments: msgAttachments,
                };

                setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
                return;
            }

            if (data.type === 'update_message') {
                const updatedMsg = data.message || data;
                setMessages(prev => prev.map(m => m.id === data.message_id || m.id === updatedMsg.id
                    ? { ...m, text: updatedMsg.text || updatedMsg.content || m.text }
                    : m));
                if (data.room_id?.startsWith('dm_')) {
                    window.dispatchEvent(new CustomEvent('mufyard:message_updated', { detail: data }));
                }
                return;
            }

            if (data.type === 'delete_message') {
                setMessages(prev => prev.filter(m => m.id !== data.message_id));
                if (data.room_id?.startsWith('dm_')) {
                    window.dispatchEvent(new CustomEvent('mufyard:message_deleted', { detail: data }));
                }
                return;
            }

            if (data.type === 'clear_messages') {
                if (data.room_id === 'global') {
                    setMessages([]);
                } else if (data.room_id?.startsWith('dm_')) {
                    window.dispatchEvent(new CustomEvent('mufyard:messages_cleared', { detail: data }));
                }
            }
        };

        const connect = () => {
            if (!user?.uid) return;
            if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

            clearTimeout(retryTimer.current);

            const activeName = activeNameRef.current || resolvePresenceName(user);
            const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;

            user.getIdToken().then((token) => {
                const wsUrl = `${baseWsUrl}/ws?token=${encodeURIComponent(token)}&name=${encodeURIComponent(activeName)}&room_id=global`;
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
                    const data = safeParse(event.data);
                    if (data?.type === 'pong') {
                        clearTimeout(pongTimer.current);
                        return;
                    }
                    handleMessage(data);
                };

                ws.onclose = () => {
                    console.log("WS Closed, retrying...");
                    setWsConnected(false);
                    clearInterval(pingTimer.current);
                    clearTimeout(pongTimer.current);
                    scheduleReconnect();
                };

                ws.onerror = (err) => {
                    console.error("WS Socket error:", err);
                    ws.close();
                };
            }).catch((err) => {
                console.error("WS token error:", err);
                setWsConnected(false);
                scheduleReconnect();
            });
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
        const senderName = activeNameRef.current || resolvePresenceName(user);
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'message',
                room_id: 'global', // Explicitly set for public space
                id: msgId,
                content, // Use content to match DM schema
                text: content, // Fallback for legacy
                attachments,
                author_id: user?.uid,
                author_name: senderName,
                timestamp: new Date().toISOString()
            };
            wsRef.current.send(JSON.stringify(payload));
        } else {
            console.warn("WS not open, fallback to REST API");
            
            // Optimistic UI updates
            const newMsg: Message = {
                id: msgId,
                text: content,
                author_id: user?.uid || '',
                author_name: senderName,
                author_role: 'Müfettiş',
                timestamp: new Date().toISOString(),
                attachments
            };
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
            
            sendGlobalMessage(content, senderName).catch((err) => {
                console.error("Failed to send global message via REST:", err);
                toast.error("Mesaj gönderilemedi.");
            });
        }
        return msgId;
    }, [user, user?.uid]);


    const clearGlobalMessages = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/collaboration/messages`, {
                headers,
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
            onlineUsers, wsConnected, restConnected, isUserOnline, messages, unreadMessages, markAsRead, 
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
            restConnected: false,
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
