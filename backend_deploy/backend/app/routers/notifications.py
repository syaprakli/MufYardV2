from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Optional
from app.services.notification_service import NotificationService
import json
import asyncio

from app.lib.notification_manager import notification_manager as manager

router = APIRouter(tags=["notifications"])


# --- REST ENDPOINTS ---


@router.get("/")
async def get_notifications(user_id: str, limit: int = 50):
    try:
        return await NotificationService.get_user_notifications(user_id, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    success = await NotificationService.mark_as_read(notification_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    success = await NotificationService.delete_notification(notification_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")

@router.delete("/all/{user_id}")
async def delete_all_notifications(user_id: str):
    count = await NotificationService.delete_all(user_id)
    return {"status": "success", "deleted_count": count}

@router.patch("/all/read/{user_id}")
async def mark_all_read(user_id: str):
    count = await NotificationService.mark_all_as_read(user_id)
    return {"status": "success", "updated_count": count}

# --- WEBSOCKET ENDPOINT ---

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and listen for any incoming messages
            data = await websocket.receive_text()
            # You can handle incoming messages here if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)
    try:
        while True:
            # We keep the connection open. 
            # We could handle client-to-server pings here if needed.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
