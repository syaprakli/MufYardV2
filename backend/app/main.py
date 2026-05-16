import os
import json
import asyncio
import logging
import shutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings, BASE_DIR, DATA_DIR

# --- KARAKUTU (LOG) SİSTEMİ ---
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR, exist_ok=True)

log_file = os.path.join(DATA_DIR, "backend_logs.txt")

# Hem dosyaya hem konsola (Railway logları için) yaz
log_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

file_handler = logging.FileHandler(log_file, encoding='utf-8')
file_handler.setFormatter(log_format)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(log_format)

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, stream_handler]
)
logger = logging.getLogger(__name__)
logger.info("--- MufYARD Arka Plan Servisi Başlatılıyor ---")
logger.info(f"BASE_DIR: {BASE_DIR}")
logger.info(f"DATA_DIR: {DATA_DIR}")
# ------------------------------

from app.routers import (
    dashboard, audit, tasks, contacts, 
    inspectors, profiles, legislation, 
    notes, ai_knowledge, backup, files,
    calendar, notifications, ai, collaboration, feedback, online, settings as settings_router, licenses
)

from app.services.contact_service import ContactService
from app.services.inspector_service import InspectorService

# Content Security Policy Middleware for Electron
class CSPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        return response

settings = get_settings()
app = FastAPI(title=settings.APP_NAME)

@app.get("/")
async def root():
    return {
        "message": "MufYARD API is running",
        "status": "healthy",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.1-antigravity", "timestamp": asyncio.get_event_loop().time()}

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Startup süreci başladı (MINIMAL MODE)...")
        # Tüm ağır işleri devre dışı bıraktık
        logger.info("Ağır senkronizasyon görevleri geçici olarak devre dışı.")
        
        # Sadece kritik dosyaları kontrol et ama bir şey yapma
        if not os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
             logger.warning("Firebase anahtarı yok, Mock DB kullanılabilir.")
             
    except Exception as e:
        logger.error(f"KRİTİK STARTUP HATASI: {e}")

async def sync_bundled_content():
    """Bundled folder'ları DATA_DIR içine kopyalar (eğer DATA_DIR farklı ve hedef boşsa)."""
    if os.path.abspath(BASE_DIR) == os.path.abspath(DATA_DIR):
        logger.info("BASE_DIR ve DATA_DIR aynı, senkronizasyon atlanıyor.")
        return

    folders_to_sync = ["Mevzuat", "Raporlar", "uploads"]
    
    def _sync_logic():
        for folder in folders_to_sync:
            source = os.path.join(BASE_DIR, folder)
            destination = os.path.join(DATA_DIR, folder)
            
            if not os.path.exists(source):
                continue
                
            try:
                should_copy = False
                if not os.path.exists(destination):
                    should_copy = True
                else:
                    # Klasör boş mu bak
                    if not os.listdir(destination):
                        should_copy = True
                
                if should_copy:
                    logger.info(f"Senkronizasyon başlatıldı: {folder} -> {destination}")
                    if os.path.exists(destination):
                        # Klasör mevcut ama boş, içindekileri kopyala
                        for item in os.listdir(source):
                            s = os.path.join(source, item)
                            d = os.path.join(destination, item)
                            if os.path.isdir(s):
                                if not os.path.exists(d):
                                    shutil.copytree(s, d)
                            else:
                                if not os.path.exists(d):
                                    shutil.copy2(s, d)
                    else:
                        shutil.copytree(source, destination)
                    logger.info(f"Senkronizasyon tamamlandı: {folder}")
            except Exception as e:
                logger.error(f"Senkronizasyon hatası ({folder}): {e}")

    await asyncio.to_thread(_sync_logic)

# Mount static files
def mount_static_dir(path_name, route_path):
    dir_path = os.path.join(DATA_DIR, path_name)
    if not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
    app.mount(route_path, StaticFiles(directory=dir_path), name=path_name)

mount_static_dir("uploads", "/uploads")
mount_static_dir("Raporlar", "/Raporlar")
mount_static_dir("Mevzuat", "/Mevzuat")

# Middleware
_default_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "app://.",  # Electron
    "https://mufyardv2.web.app",
    "https://mufyardv2.firebaseapp.com",
]
_env_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS else []
_allowed_origins = list(set(_default_origins + _env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.add_middleware(CSPMiddleware) # Removed as it blocks local frontend connections

# Routers
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["Contacts"])
app.include_router(legislation.router, prefix="/api/legislation", tags=["Legislation"])
app.include_router(notes.router, prefix="/api/notes", tags=["Notes"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(licenses.router, prefix="/api/licenses", tags=["Licenses"])
app.include_router(inspectors.router, prefix="/api/inspectors", tags=["Inspectors"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(collaboration.router, prefix="/api/collaboration", tags=["Collaboration"])
app.include_router(ai_knowledge.router, prefix="/api/ai-knowledge", tags=["AI Knowledge"])
app.include_router(online.router, prefix="/api/online", tags=["Online"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])

# --- WEBSOCKET CHAT ENDPOINT ---
# Moved here to avoid 404 issues with router prefixes in production
from fastapi import WebSocket, WebSocketDisconnect, Query
from app.routers.collaboration import chat_manager, CollaborationService, DirectMessageCreate, NotificationService, NotificationCreate

@app.websocket("/ws")
async def websocket_chat_endpoint(websocket: WebSocket):
    uid = websocket.query_params.get("uid", "guest")
    name = websocket.query_params.get("name", "Müfettiş")
    room_id = websocket.query_params.get("room_id", "global")
    
    # DM Odası Normalizasyonu: dm_UID1_UID2 formatını alfabetik sırala
    if room_id.startswith("dm_"):
        parts = room_id.split("_")
        if len(parts) >= 3:
            # "dm" öneki dışındaki parçaları sırala
            uids = sorted(parts[1:])
            room_id = f"dm_{'_'.join(uids)}"
            logger.info(f"DM Odası Normalize Edildi: {room_id}")

    await chat_manager.connect(websocket, room_id, uid, name)
    try:
        while True:
            try:
                raw_data = await websocket.receive_text()
                data = json.loads(raw_data)

                # Ping/pong heartbeat - Railway WS timeout'unu önler
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue
                
                # Mesaj içeriğini normalize et (Hem 'text' hem 'content' desteği)
                msg_text = data.get("text") or data.get("content") or ""
                msg_attachments = data.get("attachments", [])
                if not msg_attachments and data.get("attachment"):
                    msg_attachments = [data.get("attachment")]
                
                # Eğer DM odasıysa ve mesaj geliyorsa, veri tabanına kaydet
                is_dm = room_id.startswith("dm_")
                msg_type = data.get("type", "message")
                
                if msg_type == "message":
                    if is_dm:
                        logger.info(f"DM Mesajı alınıyor: {uid} -> {room_id}")
                        
                        # Alıcıyı bul (En sağlam yöntem: client'ın gönderdiği recipient_id)
                        recipient_id = data.get("recipient_id")
                        
                        # Fallback: room_id'den ayıkla
                        if not recipient_id:
                            parts = room_id.split("_")
                            if len(parts) >= 3:
                                recipient_id = parts[1] if parts[2] == uid else parts[2]
                        
                        if not recipient_id:
                            logger.error(f"Alıcı bulunamadı! Room: {room_id}, UID: {uid}")
                            continue

                        # Servis üzerinden kaydet (persistent)
                        dm_create = DirectMessageCreate(
                            recipient_id=recipient_id,
                            content=msg_text,
                            attachment=msg_attachments[0] if msg_attachments else None
                        )
                        new_db_msg = await CollaborationService.save_private_message(uid, name, dm_create)
                        
                        # Bildirim gönder (async)
                        notif = NotificationCreate(
                            user_id=recipient_id,
                            title=f"Yeni Mesaj: {name}",
                            message=msg_text[:100],
                            type="dm",
                            chat_room_id=room_id
                        )
                        asyncio.create_task(NotificationService.create_notification(notif))
                        
                        # Mesaj verisini zenginleştir
                        data["id"] = new_db_msg["id"]
                        data["timestamp"] = new_db_msg["timestamp"]
                        data["room_id"] = room_id
                        data["content"] = msg_text
                        data["text"] = msg_text
                        data["sender_id"] = uid
                        data["sender_name"] = name
                        raw_data = json.dumps(data)
                        
                        # 1. Mevcut odaya bas (FloatingChat)
                        await chat_manager.broadcast(room_id, raw_data)
                        
                        # 2. Alıcının TÜM diğer bağlantılarına bas (Bildirim ve diğer sekmeler)
                        await chat_manager.send_to_user(recipient_id, raw_data)
                        
                        # 3. GÖNDERENİN diğer bağlantılarına da bas (Diğer sekmeler senkron kalsın)
                        await chat_manager.send_to_user(uid, raw_data)
                        
                        logger.info(f"DM İletimi tamamlandı: {uid} -> {recipient_id}")
                    else:
                        # Global mesaj (Canlı Müzakere): Veritabanına kaydet
                        logger.info(f"Global Mesaj alınıyor: {uid} -> {room_id}")
                        from app.schemas.messaging import MessageCreate
                        global_msg = MessageCreate(
                            text=msg_text,
                            author_id=uid,
                            author_name=name,
                            author_role="Müfettiş"
                        )
                        new_db_msg = await CollaborationService.save_message(global_msg)
                        
                        # Veriyi zenginleştir
                        data["id"] = new_db_msg["id"]
                        data["timestamp"] = new_db_msg["timestamp"].isoformat() if hasattr(new_db_msg["timestamp"], "isoformat") else new_db_msg["timestamp"]
                        data["author_id"] = uid
                        data["author_name"] = name
                        data["text"] = msg_text
                        data["content"] = msg_text
                        data["room_id"] = "global"
                        raw_data = json.dumps(data)
                        
                        # Herkese yayınla
                        await chat_manager.broadcast(room_id, raw_data)
                        logger.info(f"Global Broadcast tamamlandı: {room_id}")
                    
                    continue
                
                # Diğer tipler için sadece broadcast
                await chat_manager.broadcast(room_id, raw_data)

            except Exception as e:
                if isinstance(e, WebSocketDisconnect):
                    raise e
                logger.error(f"WebSocket döngü hatası: {str(e)}")
                continue


    except WebSocketDisconnect:
        logger.info(f"WS Bağlantısı kesildi: {name} (Oda: {room_id})")
        await chat_manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"Chat WS Hatası: {e}")
        await chat_manager.disconnect(websocket, room_id)

# Health endpoints moved up for visibility

@app.get("/health/detail")
async def health_detail():
    from app.lib.firebase_admin import is_mock
    return {
        "status": "healthy",
        "firebase_mode": "mock" if is_mock else "real",
        "firebase_key": settings.FIREBASE_SERVICE_ACCOUNT_PATH,
        "base_dir": BASE_DIR,
        "data_dir": DATA_DIR
    }
