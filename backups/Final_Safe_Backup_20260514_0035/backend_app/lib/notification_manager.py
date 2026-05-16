from typing import List, Dict, Any
from fastapi import WebSocket
import json

class NotificationManager:
    def __init__(self):
        # dictionary of user_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def notify_user(self, user_id: str, message: Dict[str, Any]):
        if user_id in self.active_connections:
            # Pydantic models need to be serialized or converted to dict
            # We assume message is already a serializable dict here
            msg_str = json.dumps(message, default=str)
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(msg_str)
                except Exception:
                    # Connection might be dead
                    pass

# Singleton instance
notification_manager = NotificationManager()
