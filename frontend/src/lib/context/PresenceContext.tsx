import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WS_URL } from '../config';
import { fetchOnlineUsers } from '../api/online';

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
    sendMessage: (text: string, attachments?: any[]) => string;
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
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    
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
                        const msgText = data.text || data.content;
                        if (msgText) {
                            const isDM = data.room_id?.startsWith('dm_');
                            
                            if (isDM) {
                                // DM ise diğer bileşenlerin (FloatingChat gibi) yakalaması için bir event fırlat
                                window.dispatchEvent(new CustomEvent('mufyard:new_message', { detail: data }));
                                return;
                            }

                            // Global mesaj ise listeye ekle
                            const newMsg: Message = {
                                id: data.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                                text: msgText,
                                author_id: data.author_id || data.sender_id,
                                author_name: data.author_name || data.sender_name || 'Müfettiş',
                                timestamp: data.timestamp || new Date().toISOString(),
                                attachments: data.attachments || (data.attachment ? [data.attachment] : [])
                            };

                            setMessages(prev => {
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

    const sendMessage = useCallback((text: string, attachments: any[] = []): string => {
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const payload = {
                type: 'message',
                id: msgId,
                text,
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

    return (
        <PresenceContext.Provider value={{ onlineUsers, wsConnected, isUserOnline, messages, sendMessage }}>
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
            sendMessage: () => ""
        } as PresenceContextType;
    }
    return context;
}
