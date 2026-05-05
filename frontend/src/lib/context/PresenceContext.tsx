import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WS_URL } from '../config';

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

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);
    const pingTimer = useRef<any>(null);
    const retryCountRef = useRef(0);
    const activeNameRef = useRef<string>('Müfettiş');
    const connectRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (user?.uid) {
            import('../api/profiles').then(api => {
                api.fetchProfile(user.uid, user.email || undefined).then(p => {
                    if (p.full_name && p.full_name !== "Kullanıcı") {
                        activeNameRef.current = p.full_name;
                    }
                }).catch(() => {});
            });
        }
    }, [user]);

    useEffect(() => {
        const connect = () => {
            if (!user?.uid) return;
            // Zaten açık bağlantı varsa kapatma — sadece CLOSED ise aç
            if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

            clearTimeout(retryTimer.current);

            try {
                const activeName = activeNameRef.current || user.displayName || 'Müfettiş';
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                const wsUrl = `${baseWsUrl}/ws?uid=${encodeURIComponent(user.uid)}&name=${encodeURIComponent(activeName)}&room_id=global`;

                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    setWsConnected(true);
                    retryCountRef.current = 0;
                    clearInterval(pingTimer.current);
                    // Her 20sn ping ile Railway timeout'unu önle
                    pingTimer.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                        }
                    }, 20000);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'pong') return;
                        if (data.type === 'presence' && Array.isArray(data.users)) {
                            setOnlineUsers(data.users);
                        } else if (data.text) {
                            setMessages(prev => {
                                if (prev.some(m => m.id === data.id)) return prev;
                                return [...prev, {
                                    id: data.id || Date.now().toString(),
                                    text: data.text,
                                    author_id: data.author_id,
                                    author_name: data.author_name || 'Müfettiş',
                                    timestamp: data.timestamp || new Date().toISOString(),
                                    attachments: data.attachments || []
                                }];
                            });
                        }
                    } catch (err) {
                        console.error('Presence message error:', err);
                    }
                };

                ws.onclose = () => {
                    setWsConnected(false);
                    clearInterval(pingTimer.current);
                    // Max 5sn'de bir yeniden dene (30sn'den kısaltıldı)
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
                    retryCountRef.current += 1;
                    retryTimer.current = setTimeout(connect, delay);
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch (err) {
                setWsConnected(false);
                retryTimer.current = setTimeout(connect, 3000);
            }
        };

        connectRef.current = connect;

        if (user?.uid) {
            connect();
        }

        // Sekme/pencere aktif olunca anında yeniden bağlan
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                retryCountRef.current = 0;
                connect();
            }
        };
        const handleFocus = () => {
            retryCountRef.current = 0;
            connect();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleFocus);
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            clearTimeout(retryTimer.current);
            clearInterval(pingTimer.current);
        };
    }, [user?.uid]);

    const isUserOnline = useCallback((uid: string) => {
        return onlineUsers.some(u => u.uid === uid);
    }, [onlineUsers]);

    const sendMessage = useCallback((text: string, attachments: any[] = []): string => {
        const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                id: msgId,
                text,
                attachments,
                author_id: user?.uid,
                author_name: activeNameRef.current || user?.displayName || 'Müfettiş',
                timestamp: new Date().toISOString()
            }));
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
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
}
