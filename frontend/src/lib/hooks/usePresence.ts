import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { API_URL } from '../config';

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      // Use the existing chat websocket endpoint but with a 'global' room
      // This registers the user in the backend's global_online_users
      const wsUrl = API_URL.replace('http', 'ws');
      ws = new WebSocket(`${wsUrl}/collaboration/chat?uid=${user.uid}&name=${encodeURIComponent(user.displayName || user.email || 'User')}&room_id=global`);

      ws.onopen = () => {
        console.log("Presence: Connected");
      };

      ws.onclose = () => {
        console.log("Presence: Disconnected, reconnecting...");
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("Presence WS error:", err);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [user]);
}
