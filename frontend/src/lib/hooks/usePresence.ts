import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { WS_URL } from '../config';

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    let retryCount = 0;

    const connect = () => {
      // Use the correct websocket endpoint from backend
      const wsUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
      user.getIdToken().then((token) => {
        ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(token)}&name=${encodeURIComponent(user.displayName || user.email || 'User')}&room_id=global`);

        ws.onopen = () => {
          if (isMounted) {
            console.log("Presence Hook: Connected");
            retryCount = 0;
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          console.log(`Presence Hook: Disconnected, retrying in ${delay/1000}s...`);
          reconnectTimer = setTimeout(connect, delay);
          retryCount += 1;
        };

        ws.onerror = (err) => {
          if (isMounted) console.error("Presence Hook WS error:", err);
          ws?.close();
        };
      }).catch((err) => {
        if (isMounted) console.error("Presence Hook token error:", err);
      });
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
