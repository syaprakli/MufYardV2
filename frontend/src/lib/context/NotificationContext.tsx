import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

    const refresh = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const data = await fetchNotifications(user.uid);
            setNotifications(data);
        } catch (error) {
            console.error('Bildirimler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // WebSocket Connection
    useEffect(() => {
        if (!user?.uid) return;

        let socket: WebSocket | null = null;
        let retryCount = 0;
        let retryTimer: any = null;

        const connect = () => {
            if (!user?.uid) return;
            
            socket = new WebSocket(`${WS_URL}/api/notifications/ws/${user.uid}`);

            socket.onopen = () => {
                console.log("Notification WS: Connected");
                retryCount = 0;
            };

            socket.onmessage = (event) => {
                try {
                    const newNotif = JSON.parse(event.data);
                    setNotifications(prev => [newNotif, ...prev]);
                    
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
                socket?.close();
            };

            socket.onclose = () => {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                console.log(`Notification WS: Disconnected, retrying in ${delay/1000}s...`);
                retryTimer = setTimeout(connect, delay);
                retryCount += 1;
            };
        };

        connect();

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
