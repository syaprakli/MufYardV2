from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from typing import List, Dict, Optional, Any
from app.services.collaboration_service import CollaborationService
from app.schemas.messaging import MessageCreate, MessageResponse, DirectMessageCreate, DirectMessageResponse
from app.schemas.post import PostCreate, PostResponse, PostUpdate, CommentUpdate
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationCreate
import json

router = APIRouter(prefix="", tags=["collaboration"])

# --- PERSISTENT MESSAGING (CHAT) ---

@router.get("/messages", response_model=List[MessageResponse])
async def get_message_history(limit: int = 50):
    try:
        return await CollaborationService.get_messages(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/messages", response_model=MessageResponse)
async def save_global_message(message: MessageCreate):
    try:
        return await CollaborationService.save_message(message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, uid: str = Query(...), role: str = Query("user")):
    is_admin = (role or "").strip().lower() == "admin"
    if await CollaborationService.delete_message(message_id, uid, is_admin):
        return {"status": "success", "message": "Mesaj silindi."}
    raise HTTPException(status_code=403, detail="Mesaj silinemedi veya yetkiniz yok.")

@router.patch("/messages/{message_id}")
async def update_message(message_id: str, payload: Dict[str, Any], uid: str = Query(...), role: str = Query("user")):
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Mesaj metni boş olamaz.")

    is_admin = (role or "").strip().lower() == "admin"
    updated = await CollaborationService.update_message(message_id, text, uid, is_admin)
    if updated:
        return updated
    raise HTTPException(status_code=403, detail="Mesaj düzenlenemedi veya yetkiniz yok.")

@router.delete("/messages")
async def clear_messages(uid: str = Query(...), role: str = Query("user")):
    is_admin = (role or "").strip().lower() == "admin"
    deleted_count = await CollaborationService.clear_messages(uid, is_admin)
    return {"status": "success", "deleted": deleted_count, "scope": "all" if is_admin else "mine"}

# --- PRIVATE MESSAGING (DM) ---

@router.get("/dm/history", response_model=List[DirectMessageResponse])
async def get_dm_history(uid1: str, uid2: str, limit: int = 50):
    try:
        return await CollaborationService.get_private_messages(uid1, uid2, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dm/send", response_model=DirectMessageResponse)
async def send_dm(msg: DirectMessageCreate, uid: str, name: str):
    try:
        new_msg = await CollaborationService.save_private_message(uid, name, msg)
        
        # Alıcıyı bilgilendir
        notif = NotificationCreate(
            user_id=msg.recipient_id,
            title=f"Yeni Mesaj: {name}",
            message=msg.content[:100] + ("..." if len(msg.content) > 100 else ""),
            type="collaboration",
            chat_room_id="dm_" + "_".join(sorted([uid, msg.recipient_id]))
        )
        await NotificationService.create_notification(notif)
        
        return new_msg
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/dm/{room_id}/clear")
async def clear_dm(room_id: str, uid: str):
    deleted_count = await CollaborationService.clear_private_messages(room_id, uid)
    clear_event = json.dumps({
        "type": "clear_messages",
        "room_id": room_id,
        "uid": uid,
    })
    await chat_manager.broadcast(room_id, clear_event)
    return {"status": "success", "deleted": deleted_count}

@router.delete("/dm/{room_id}")
async def clear_dm_legacy(room_id: str, uid: str):
    return await clear_dm(room_id, uid)

@router.delete("/dm/{room_id}/{message_id}")
async def delete_dm(room_id: str, message_id: str, uid: str):
    success = await CollaborationService.delete_private_message(room_id, message_id, uid)
    if success:
        # WebSocket üzerinden diğer tarafa bildir
        delete_event = json.dumps({
            "type": "delete_message",
            "message_id": message_id,
            "room_id": room_id
        })
        await chat_manager.broadcast(room_id, delete_event)
        return {"status": "success"}
    raise HTTPException(status_code=403, detail="Mesaj silinemedi veya yetkiniz yok.")

@router.patch("/dm/{room_id}/{message_id}")
async def update_dm(room_id: str, message_id: str, payload: Dict[str, Any], uid: str):
    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Mesaj metni boş olamaz.")

    updated = await CollaborationService.update_private_message(room_id, message_id, uid, content)
    if not updated:
        raise HTTPException(status_code=403, detail="Mesaj düzenlenemedi veya yetkiniz yok.")

    update_event = json.dumps({
        "type": "update_message",
        "room_id": room_id,
        "message": updated,
    })
    await chat_manager.broadcast(room_id, update_event)
    return updated



# --- FORUM / PUBLIC FEED ---

@router.get("/posts", response_model=List[PostResponse])
async def get_public_posts(category: Optional[str] = Query(None), user_id: Optional[str] = Query(None)):
    try:
        return await CollaborationService.get_posts(category, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/posts", response_model=PostResponse)
async def create_public_post(post: PostCreate, role: str = Query("user")):
    try:
        is_admin = (role or "").strip().lower() in ["admin", "moderator"]
        return await CollaborationService.create_post(post, is_admin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/posts/{post_id}/approve")
async def approve_post(post_id: str, admin_name: str = Query(...)):
    success = await CollaborationService.approve_post(post_id, admin_name)
    if not success:
        raise HTTPException(status_code=404, detail="Paylaşım bulunamadı.")
    return {"status": "success"}

@router.post("/posts/{post_id}/reject")
async def reject_post(post_id: str):
    success = await CollaborationService.reject_post(post_id)
    if not success:
        raise HTTPException(status_code=404, detail="Paylaşım bulunamadı.")
    return {"status": "success"}

@router.delete("/posts/{post_id}")
async def delete_public_post(post_id: str):
    if await CollaborationService.delete_post(post_id):
        return {"status": "success", "message": "Paylaşım silindi."}
    raise HTTPException(status_code=404, detail="Paylaşım bulunamadı.")

@router.post("/posts/{post_id}/like")
async def like_public_post(post_id: str):
    result = await CollaborationService.toggle_like(post_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.get("/posts/{post_id}/comments")
async def get_post_comments(post_id: str):
    try:
        return await CollaborationService.get_comments(post_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/posts/{post_id}/comments")
async def add_post_comment(post_id: str, comment: Dict[str, Any]):
    try:
        return await CollaborationService.add_comment(post_id, comment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/posts/{post_id}")
async def update_public_post(post_id: str, post_update: PostUpdate):
    result = await CollaborationService.update_post(post_id, post_update)
    if result:
        return result
    raise HTTPException(status_code=404, detail="Paylaşım bulunamadı.")

@router.patch("/posts/{post_id}/comments/{comment_id}")
async def update_post_comment(post_id: str, comment_id: str, comment: Dict[str, Any]):
    # Note: Use comment.get('content') if it's passed as a dict
    content = comment.get('content')
    if not content:
        raise HTTPException(status_code=400, detail="İçerik boş olamaz.")
        
    result = await CollaborationService.update_comment(post_id, comment_id, content)
    if result:
        return result
    raise HTTPException(status_code=404, detail="Yorum bulunamadı.")

@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_post_comment(post_id: str, comment_id: str):
    if await CollaborationService.delete_comment(post_id, comment_id):
        return {"status": "success", "message": "Yorum silindi."}
    raise HTTPException(status_code=404, detail="Yorum bulunamadı.")

# --- WEBSOCKET LIVE SYNC ---

# --- WEBSOCKET LIVE SYNC (ROOM-BASED) ---

class ChatConnectionManager:
    def __init__(self):
        # dictionary of room_id -> {websocket -> user_info}
        self.rooms: Dict[str, Dict[WebSocket, Dict[str, str]]] = {}
        # Global presence: user_id -> set of active websockets (handling multiple tabs)
        self.global_online_users: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_name: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}

        self.rooms[room_id][websocket] = {"uid": user_id, "name": user_name}

        # Update global presence
        if user_id not in self.global_online_users:
            self.global_online_users[user_id] = set()
        self.global_online_users[user_id].add(websocket)

        await self.broadcast_presence(room_id)

    async def disconnect(self, websocket: WebSocket, room_id: str):
        # Remove from room
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            user_info = self.rooms[room_id][websocket]
            user_id = user_info["uid"]
            del self.rooms[room_id][websocket]
            
            # Remove from global presence
            if user_id in self.global_online_users:
                self.global_online_users[user_id].discard(websocket)
                if not self.global_online_users[user_id]:
                    del self.global_online_users[user_id]

            if not self.rooms[room_id]:
                del self.rooms[room_id]
            else:
                await self.broadcast_presence(room_id)

    async def broadcast_presence(self, room_id: str = None):
        # Tüm odalardaki benzersiz kullanıcıları topla
        all_users = []
        seen_uids = set()
        
        for room in self.rooms.values():
            for info in room.values():
                if info["uid"] not in seen_uids:
                    all_users.append({"uid": info["uid"], "name": info["name"]})
                    seen_uids.add(info["uid"])
        
        presence_msg = json.dumps({"type": "presence", "users": all_users})
        
        # Zombie WS'leri tespit et ve temizle
        dead: list = []
        for rid, room in self.rooms.items():
            for connection in list(room.keys()):
                try:
                    await connection.send_text(presence_msg)
                except Exception:
                    dead.append((rid, connection))
        
        # Ölü bağlantıları rooms ve global_online_users'dan sil
        changed = False
        for rid, ws in dead:
            if rid in self.rooms and ws in self.rooms[rid]:
                uid = self.rooms[rid][ws]["uid"]
                del self.rooms[rid][ws]
                if uid in self.global_online_users:
                    self.global_online_users[uid].discard(ws)
                    if not self.global_online_users[uid]:
                        del self.global_online_users[uid]
                if not self.rooms[rid]:
                    del self.rooms[rid]
                changed = True
        
        # Eğer zombie temizlendiyse güncel presence'ı tekrar yayınla
        if changed:
            await self.broadcast_presence()

    async def broadcast(self, room_id: str, message: str):
        if room_id not in self.rooms:
            return
            
        for connection in self.rooms[room_id].keys():
            try:
                await connection.send_text(message)
            except Exception:
                pass

    def get_online_uids(self) -> List[str]:
        return list(self.global_online_users.keys())

chat_manager = ChatConnectionManager()

@router.get("/online-users")
async def get_online_users():
    return chat_manager.get_online_uids()

# --- WEBSOCKET HANDLER MOVED TO main.py FOR STABILITY ---


# --- REPORT COLLABORATION ---

class DocumentConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast(self, message: bytes, sender: WebSocket, room_id: str):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                if connection != sender:
                    try:
                        await connection.send_bytes(message)
                    except Exception:
                        pass

doc_manager = DocumentConnectionManager()

@router.websocket("/report/{audit_id}")
async def report_collab_endpoint(websocket: WebSocket, audit_id: str):
    await doc_manager.connect(websocket, audit_id)
    try:
        while True:
            data = await websocket.receive_bytes()
            await doc_manager.broadcast(data, sender=websocket, room_id=audit_id)
    except WebSocketDisconnect:
        doc_manager.disconnect(websocket, audit_id)

# --- CATEGORY MANAGEMENT ---

@router.get("/categories", response_model=List[str])
async def get_collaboration_categories():
    return await CollaborationService.get_categories()

@router.post("/categories")
async def add_collaboration_category(payload: Dict[str, str]):
    if await CollaborationService.add_category(payload.get("name")):
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="Kategori eklenemedi.")

# --- PENDING COLLABORATION REQUESTS ---

@router.get("/pending-requests")
async def get_pending_collaboration_requests(uid: str = Query(...), email: Optional[str] = Query(None)):
    """Kullanıcının onay bekleyen tüm paylaşım isteklerini (Görev, Not, Rehber) getirir."""
    try:
        return await CollaborationService.get_pending_requests(uid, email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pending-requests/{resource_type}/{resource_id}/accept")
async def accept_collaboration_request(resource_type: str, resource_id: str, uid: str = Query(...)):
    """Paylaşım isteğini kabul eder."""
    success = await CollaborationService.accept_resource(resource_type, resource_id, uid)
    if success:
        return {"status": "success", "message": "Paylaşım kabul edildi."}
    raise HTTPException(status_code=400, detail="İşlem başarısız veya yetki yok.")

@router.post("/pending-requests/{resource_type}/{resource_id}/reject")
async def reject_collaboration_request(resource_type: str, resource_id: str, uid: str = Query(...)):
    """Paylaşım isteğini reddeder."""
    success = await CollaborationService.reject_resource(resource_type, resource_id, uid)
    if success:
        return {"status": "success", "message": "Paylaşım reddedildi."}
    raise HTTPException(status_code=400, detail="İşlem başarısız veya yetki yok.")
