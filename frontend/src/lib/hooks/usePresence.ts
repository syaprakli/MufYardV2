import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { API_URL } from '../config';

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const connect = () => {
      // Use the existing chat websocket endpoint but with a 'global' room
      // This registers the user in the backend's global_online_users
      const wsUrl = API_URL.replace('http', 'ws');
      ws = new WebSocket(`${wsUrl}/collaboration/chat?uid=${user.uid}&name=${encodeURIComponent(user.displayName || user.email || 'User')}&room_id=global`);

      ws.onopen = () => {
        if (isMounted) console.log("Presence: Connected");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.log("Presence: Disconnected, reconnecting...");
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        if (isMounted) console.error("Presence WS error:", err);
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Önemi büyük: unmount olurken close eventini iptal et
        ws.close();
      }
    };
  }, [user]);
}
