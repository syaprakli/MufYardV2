import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
    type Notification,
    fetchNotifications, 
    markAsRead as apiMarkAsRead,
    markAllRead as apiMarkAllRead,
    deleteNotification as apiDeleteNotification,
    deleteAllNotifications as apiDeleteAll
} from '../api/notifications';

import { WS_URL } from '../config';
import { toast } from 'react-hot-toast';
import { auth } from '../firebase';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
    refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [wsConnected, setWsConnected] = useState(false);

    const seenNotifIdsRef = useRef<Set<string>>(new Set());
    const isFirstLoadRef = useRef(true);
    const notificationsRef = useRef(notifications);

    useEffect(() => {
        notificationsRef.current = notifications;
    }, [notifications]);

    const refresh = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const data = await fetchNotifications(user.uid);
            
            if (isFirstLoadRef.current) {
                const ids = new Set<string>();
                data.forEach((n: any) => ids.add(n.id));
                seenNotifIdsRef.current = ids;
                isFirstLoadRef.current = false;
                setNotifications(data);
            } else {
                const newNotifications = data.filter((n: any) => !seenNotifIdsRef.current.has(n.id));
                
                if (newNotifications.length > 0) {
                    newNotifications.forEach((n: any) => seenNotifIdsRef.current.add(n.id));
                    
                    newNotifications.forEach((newNotif: any) => {
                        if (!newNotif.read) {
                            if (newNotif.type === 'collaboration' && newNotif.chat_room_id) {
                                const senderName = newNotif.title.replace('Yeni Mesaj: ', '');
                                const senderId = newNotif.chat_room_id.replace('dm_', '').split('_').find((id: string) => id !== user.uid) || '';
                                
                                window.dispatchEvent(new CustomEvent('mufyard:new_message', {
                                    detail: {
                                        id: newNotif.id,
                                        room_id: newNotif.chat_room_id,
                                        sender_id: senderId,
                                        sender_name: senderName,
                                        content: newNotif.message,
                                        text: newNotif.message,
                                        timestamp: newNotif.created_at || new Date().toISOString()
                                    }
                                }));
                                
                                toast.success(`${senderName}: ${newNotif.message}`, {
                                    icon: '💬',
                                    duration: 4000,
                                    position: 'top-center'
                                });
                            } else {
                                toast.success(newNotif.title, {
                                    icon: '🔔',
                                    duration: 5000,
                                });
                            }
                        }
                    });
                }
                setNotifications(data);
            }
        } catch (error) {
            console.error('Bildirimler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Polling fallback when WebSocket is disconnected (e.g. corporate network)
    useEffect(() => {
        if (!user?.uid) return;
        
        let interval: any = null;
        if (!wsConnected) {
            // Poll every 10 seconds for real-time responsiveness when WS is blocked/failed
            interval = setInterval(() => {
                refresh();
            }, 10000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [wsConnected, user?.uid, refresh]);

    // Handle marking chat notifications read when a chat is viewed/read
    useEffect(() => {
        const handleChatRead = async (e: any) => {
            const roomId = e.detail?.roomId;
            if (!roomId) return;
            
            const unreadForRoom = notificationsRef.current.filter(n => n.chat_room_id === roomId && !n.read);
            for (const notif of unreadForRoom) {
                try {
                    await apiMarkAsRead(notif.id);
                } catch (error) {
                    console.error('Okundu işaretleme hatası:', error);
                }
            }
            
            if (unreadForRoom.length > 0) {
                setNotifications(prev => 
                    prev.map(n => n.chat_room_id === roomId ? { ...n, read: true } : n)
                );
            }
        };
        window.addEventListener('mufyard:chat_read', handleChatRead as any);
        return () => {
            window.removeEventListener('mufyard:chat_read', handleChatRead as any);
        };
    }, []);

    // WebSocket Connection
    useEffect(() => {
        if (!user?.uid) {
            setWsConnected(false);
            return;
        }

        let socket: WebSocket | null = null;
        let retryCount = 0;
        let retryTimer: any = null;

        const connect = async () => {
            if (!user?.uid) return;

            let token = '';
            try {
                token = await auth.currentUser?.getIdToken?.() || '';
            } catch {
                token = '';
            }

            let wsUrl = '';
            if (token) {
                wsUrl = `${WS_URL}/api/notifications/ws/${user.uid}?token=${encodeURIComponent(token)}`;
            }

            if (!wsUrl) {
                return;
            }

            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("Notification WS: Connected");
                setWsConnected(true);
                retryCount = 0;
            };

            socket.onmessage = (event) => {
                try {
                    const newNotif = JSON.parse(event.data);
                    
                    // Add to seen list to prevent duplicate alerts if polled later
                    seenNotifIdsRef.current.add(newNotif.id);
                    
                    setNotifications(prev => [newNotif, ...prev]);
                    
                    if (newNotif.type === 'dm' && newNotif.chat_room_id) {
                        return;
                    }
                    
                    toast.success(newNotif.title, {
                        icon: '🔔',
                        duration: 5000,
                    });
                } catch (error) {
                    console.error('WS mesaj hatası:', error);
                }
            };

            socket.onerror = (error) => {
                console.error('Notification WS Error:', error);
                setWsConnected(false);
                socket?.close();
            };

            socket.onclose = () => {
                setWsConnected(false);
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                console.log(`Notification WS: Disconnected, retrying in ${delay/1000}s...`);
                retryTimer = setTimeout(() => {
                    void connect();
                }, delay);
                retryCount += 1;
            };
        };

        void connect();

        return () => {
            if (socket) {
                socket.onclose = null;
                socket.onerror = null;
                socket.onmessage = null;
                socket.close();
            }
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [user?.uid]);

    const markAsRead = async (id: string) => {
        try {
            const success = await apiMarkAsRead(id);
            if (success) {
                setNotifications(prev => 
                    prev.map(n => n.id === id ? { ...n, read: true } : n)
                );
            }
        } catch (error) {
            console.error('Okundu işaretleme hatası:', error);
        }
    };

    const markAllAsRead = async () => {
        if (!user?.uid) return;
        try {
            const success = await apiMarkAllRead(user.uid);
            if (success) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }
        } catch (error) {
            console.error('Toplu okundu işaretleme hatası:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const success = await apiDeleteNotification(id);
            if (success) {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }
        } catch (error) {
            console.error('Bildirim silme hatası:', error);
        }
    };

    const clearAll = async () => {
        if (!user?.uid) return;
        try {
            const success = await apiDeleteAll(user.uid);
            if (success) {
                setNotifications([]);
            }
        } catch (error) {
            console.error('Tümünü silme hatası:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAll,
            refresh
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
