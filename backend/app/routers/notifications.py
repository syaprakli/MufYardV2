from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Query
from typing import List, Dict, Any, Optional
from app.services.notification_service import NotificationService
import json
import asyncio
from firebase_admin import auth as firebase_auth

from app.lib.auth import get_current_user
from app.lib.firebase_admin import db, is_mock

from app.lib.notification_manager import notification_manager as manager

router = APIRouter(tags=["notifications"])


async def _get_notification_owner(notification_id: str) -> Optional[str]:
    doc_ref = db.collection("notifications").document(notification_id)
    doc = await asyncio.to_thread(doc_ref.get)
    if not doc.exists:
        return None
    return (doc.to_dict() or {}).get("user_id")


def _is_admin_or_moderator(current_user: Dict[str, Any]) -> bool:
    return (current_user.get("role") or "user").strip().lower() in ["admin", "moderator"]


async def _authenticate_notification_ws_identity(websocket: WebSocket, requested_user_id: str) -> str:
    token = websocket.query_params.get("token")
    if token:
        try:
            decoded = None
            for attempt in range(3):
                try:
                    decoded = await asyncio.to_thread(lambda: firebase_auth.verify_id_token(token, clock_skew_seconds=60))
                    break
                except Exception as e:
                    err_str = str(e).lower()
                    if "too early" in err_str or "clock" in err_str or "time" in err_str:
                        if attempt < 2:
                            await asyncio.sleep(1.0)
                            continue
                    raise e

            if not decoded:
                await websocket.close(code=1008)
                raise WebSocketDisconnect(code=1008)

            uid = decoded.get("uid")
            if not uid or uid != requested_user_id:
                await websocket.close(code=1008)
                raise WebSocketDisconnect(code=1008)
            return uid
        except Exception:
            await websocket.close(code=1008)
            raise WebSocketDisconnect(code=1008)

    if is_mock:
        fallback_uid = websocket.query_params.get("uid")
        if fallback_uid and fallback_uid == requested_user_id:
            return fallback_uid

    await websocket.close(code=1008)
    raise WebSocketDisconnect(code=1008)


# --- REST ENDPOINTS ---


@router.get("/")
async def get_notifications(
    user_id: Optional[str] = Query(default=None),
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        resolved_user_id = user_id or current_user.get("uid")
        if resolved_user_id != current_user.get("uid") and not _is_admin_or_moderator(current_user):
            raise HTTPException(status_code=403, detail="Bu bildirimlere erişim yetkiniz yok.")
        return await NotificationService.get_user_notifications(resolved_user_id, limit)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Bildirimler alınırken bir hata oluştu.")

@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    owner_id = await _get_notification_owner(notification_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")
    if owner_id != current_user.get("uid") and not _is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")

    success = await NotificationService.mark_as_read(notification_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    owner_id = await _get_notification_owner(notification_id)
    if owner_id is None:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")
    if owner_id != current_user.get("uid") and not _is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")

    success = await NotificationService.delete_notification(notification_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Bildirim bulunamadı.")

@router.delete("/all/{user_id}")
async def delete_all_notifications(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    if user_id != current_user.get("uid") and not _is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
    count = await NotificationService.delete_all(user_id)
    return {"status": "success", "deleted_count": count}

@router.patch("/all/read/{user_id}")
async def mark_all_read(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    if user_id != current_user.get("uid") and not _is_admin_or_moderator(current_user):
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
    count = await NotificationService.mark_all_as_read(user_id)
    return {"status": "success", "updated_count": count}

# --- WEBSOCKET ENDPOINT ---

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    resolved_uid = await _authenticate_notification_ws_identity(websocket, user_id)
    await websocket.accept()
    await manager.connect(websocket, resolved_uid)
    try:
        while True:
            # Keep connection alive and listen for any incoming messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, resolved_uid)
    except Exception as e:
        print(f"WebSocket error for user {resolved_uid}: {e}")
        manager.disconnect(websocket, resolved_uid)
