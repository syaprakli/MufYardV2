import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
    isUserOnline: (uid: string) => boolean;
    messages: Message[];
    sendMessage: (text: string, attachments?: any[]) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);
    const retryCountRef = useRef(0);
    const [profileName, setProfileName] = useState<string | null>(null);

    useEffect(() => {
        if (user?.uid) {
            import('../api/profiles').then(api => {
                api.fetchProfile(user.uid, user.email || undefined).then(p => {
                    if (p.full_name && p.full_name !== "Kullanıcı") {
                        setProfileName(p.full_name);
                    }
                });
            });
        }
    }, [user]);

    useEffect(() => {
        const connect = () => {
            if (!user?.uid) return;

            try {
                const activeName = profileName || user.displayName || 'Müfettiş';
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                const wsUrl = `${baseWsUrl}/ws?uid=${user.uid}&name=${encodeURIComponent(activeName)}&room_id=global`;
                
                console.log("Presence: Connecting to", wsUrl);
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("Global Presence & Chat: Connected");
                    retryCountRef.current = 0; // Reset retry count on success
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'presence' && Array.isArray(data.users)) {
                            setOnlineUsers(data.users);
                        } else if (data.text) {
                            // Incoming chat message
                            setMessages(prev => {
                                // Prevent duplicates if same message received multiple times
                                if (prev.some(m => m.id === data.id)) return prev;
                                return [...prev, {
                                    id: data.id || Date.now().toString(),
                                    text: data.text,
                                    author_id: data.author_id,
                                    author_name: data.author_name || "Müfettiş",
                                    timestamp: data.timestamp || new Date().toISOString(),
                                    attachments: data.attachments || []
                                }];
                            });
                        }
                    } catch (err) {
                        console.error("Presence message error:", err);
                    }
                };

                ws.onclose = () => {
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
                    console.log(`Global Presence: Disconnected, retrying in ${delay/1000}s...`);
                    retryTimer.current = setTimeout(connect, delay);
                    retryCountRef.current += 1;
                };

                ws.onerror = (err) => {
                    console.error("Presence WS Error", err);
                    ws.close();
                };
            } catch (err) {
                console.error("Presence connection error:", err);
                retryTimer.current = setTimeout(connect, 10000);
            }
        };

        if (user?.uid) {
            connect();
        }

        return () => {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (retryTimer.current) {
                clearTimeout(retryTimer.current);
            }
        };
    }, [user?.uid, user?.displayName]);

    const isUserOnline = (uid: string) => {
        return onlineUsers.some(u => u.uid === uid);
    };

    const sendMessage = (text: string, attachments: any[] = []) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'message',
                text,
                attachments,
                author_id: user?.uid,
                author_name: user?.displayName || "Müfettiş",
                timestamp: new Date().toISOString()
            }));
        } else {
            console.warn("WS not open, cannot send message");
        }
    };

    return (
        <PresenceContext.Provider value={{ onlineUsers, isUserOnline, messages, sendMessage }}>
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
