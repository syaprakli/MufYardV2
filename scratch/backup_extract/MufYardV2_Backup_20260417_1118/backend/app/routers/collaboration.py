from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from typing import List, Dict, Optional, Any
from app.services.collaboration_service import CollaborationService
from app.schemas.messaging import MessageCreate, MessageResponse
from app.schemas.post import PostCreate, PostResponse, PostUpdate, CommentUpdate

router = APIRouter(prefix="", tags=["collaboration"])

# --- PERSISTENT MESSAGING (CHAT) ---

@router.get("/messages", response_model=List[MessageResponse])
async def get_message_history(limit: int = 50):
    try:
        return await CollaborationService.get_messages(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    if await CollaborationService.delete_message(message_id):
        return {"status": "success", "message": "Mesaj silindi."}
    raise HTTPException(status_code=404, detail="Mesaj bulunamadı.")

# --- FORUM / PUBLIC FEED ---

@router.get("/posts", response_model=List[PostResponse])
async def get_public_posts(category: Optional[str] = Query(None), user_id: Optional[str] = Query(None)):
    try:
        return await CollaborationService.get_posts(category, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/posts", response_model=PostResponse)
async def create_public_post(post: PostCreate):
    try:
        return await CollaborationService.create_post(post)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_name: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = {}
        self.rooms[room_id][websocket] = {"uid": user_id, "name": user_name}
        await self.broadcast_presence(room_id)

    async def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms and websocket in self.rooms[room_id]:
            del self.rooms[room_id][websocket]
            if not self.rooms[room_id]:
                del self.rooms[room_id]
            else:
                await self.broadcast_presence(room_id)

    async def broadcast_presence(self, room_id: str):
        if room_id not in self.rooms:
            return
            
        users = []
        seen_uids = set()
        for info in self.rooms[room_id].values():
            if info["uid"] not in seen_uids:
                users.append({"uid": info["uid"], "name": info["name"]})
                seen_uids.add(info["uid"])
        
        import json
        presence_msg = json.dumps({"type": "presence", "users": users})
        for connection in self.rooms[room_id].keys():
            try:
                await connection.send_text(presence_msg)
            except Exception:
                pass

    async def broadcast(self, room_id: str, message: str):
        if room_id not in self.rooms:
            return
            
        for connection in self.rooms[room_id].keys():
            try:
                await connection.send_text(message)
            except Exception:
                pass

chat_manager = ChatConnectionManager()

@router.websocket("/chat")
async def chat_endpoint(websocket: WebSocket):
    uid = websocket.query_params.get("uid", "guest")
    name = websocket.query_params.get("name", "Müfettiş")
    room_id = websocket.query_params.get("room_id", "global")
    
    await chat_manager.connect(websocket, room_id, uid, name)
    try:
        while True:
            data = await websocket.receive_text()
            # If it's the global room, we still save it for a bit? 
            # No, user said "non-persistent" so we just broadcast.
            await chat_manager.broadcast(room_id, data)
    except WebSocketDisconnect:
        await chat_manager.disconnect(websocket, room_id)


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
async def add_collaboration_category(category: Dict[str, str]):
    success = await CollaborationService.add_category(category.get('name'))
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Kategori eklenemedi.")
