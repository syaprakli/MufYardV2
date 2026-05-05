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
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [wsConnected, setWsConnected] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);
    const pingTimer = useRef<any>(null);
    const pongTimer = useRef<any>(null);
    const retryCountRef = useRef(0);
    const activeNameRef = useRef<string>('Kullanıcı');
    const connectRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (user?.uid) {
            activeNameRef.current = resolvePresenceName(user);
            import('../api/profiles').then(api => {
                api.fetchProfile(user.uid, user.email || undefined).then(p => {
                    activeNameRef.current = resolvePresenceName(user, p.full_name);
                }).catch(() => {});
            });
        }
    }, [user]);

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
                // REST fallback sessiz çalışır; WS varsa zaten presence akacak.
            }
        };

        syncOnlineUsers();
        const timer = setInterval(syncOnlineUsers, 10000);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [user?.uid]);

    useEffect(() => {
        const connect = () => {
            if (!user?.uid) return;
            // Zaten açık bağlantı varsa kapatma — sadece CLOSED ise aç
            if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

            clearTimeout(retryTimer.current);

            try {
                const activeName = activeNameRef.current || resolvePresenceName(user);
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                const wsUrl = `${baseWsUrl}/ws?uid=${encodeURIComponent(user.uid)}&name=${encodeURIComponent(activeName)}&room_id=global`;

                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    setWsConnected(true);
                    retryCountRef.current = 0;
                    clearInterval(pingTimer.current);
                    // Her 20sn ping gönder; 25sn içinde pong gelmezse zombie → kapat ve yeniden bağlan
                    pingTimer.current = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                            clearTimeout(pongTimer.current);
                            pongTimer.current = setTimeout(() => {
                                // Pong gelmedi: Railway zombie bağlantı
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
                        if (data.type === 'presence' && Array.isArray(data.users)) {
                            setOnlineUsers(normalizeOnlineUsers(data.users));
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
                        } else if (data.content || data.sender_name) {
                            setMessages(prev => {
                                if (prev.some(m => m.id === data.id)) return prev;
                                return [...prev, {
                                    id: data.id || Date.now().toString(),
                                    text: data.content || '',
                                    author_id: data.sender_id,
                                    author_name: data.sender_name || 'Kullanıcı',
                                    timestamp: data.timestamp || new Date().toISOString(),
                                    attachments: data.attachment ? [data.attachment] : []
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
                    clearTimeout(pongTimer.current);
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
            clearTimeout(pongTimer.current);
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
                author_name: activeNameRef.current || resolvePresenceName(user),
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
