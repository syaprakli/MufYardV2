import { API_URL } from '../config';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'task_invite' | 'task_accepted' | 'general' | 'audit' | 'contact' | 'system' | 'collaboration' | 'task';
    task_id?: string;
    chat_room_id?: string;
    read: boolean;
    created_at: string;
}

export const fetchNotifications = async (userId: string, limit: number = 50): Promise<Notification[]> => {
    const response = await fetch(`${API_URL}/notifications/?user_id=${userId}&limit=${limit}`);
    if (!response.ok) throw new Error('Bildirimler yüklenemedi');
    return response.json();
};

export const markAsRead = async (notificationId: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
    });
    return response.ok;
};

export const markAllRead = async (userId: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}/notifications/all/read/${userId}`, {
        method: 'PATCH',
    });
    return response.ok;
};

export const deleteNotification = async (notificationId: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
    });
    return response.ok;
};

export const deleteAllNotifications = async (userId: string): Promise<boolean> => {
    const response = await fetch(`${API_URL}/notifications/all/${userId}`, {
        method: 'DELETE',
    });
    return response.ok;
};
