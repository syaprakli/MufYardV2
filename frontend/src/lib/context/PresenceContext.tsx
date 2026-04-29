import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WS_URL } from '../config';

interface OnlineUser {
    uid: string;
    name: string;
}

interface PresenceContextType {
    onlineUsers: OnlineUser[];
    isUserOnline: (uid: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const retryTimer = useRef<any>(null);

    useEffect(() => {
        const connect = () => {
            if (!user?.uid) return;

            try {
                // Ensure WS_URL doesn't have trailing slash for the path join
                const baseWsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
                const wsUrl = `${baseWsUrl}/api/collaboration/chat?uid=${user.uid}&name=${encodeURIComponent(user.displayName || 'Müfettiş')}&room_id=global`;
                
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("Global Presence: Connected");
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'presence' && Array.isArray(data.users)) {
                            setOnlineUsers(data.users);
                        }
                    } catch (err) {
                        console.error("Presence message error:", err);
                    }
                };

                ws.onclose = () => {
                    console.log("Global Presence: Disconnected, retrying...");
                    retryTimer.current = setTimeout(connect, 5000);
                };

                ws.onerror = () => {
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

    return (
        <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
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
