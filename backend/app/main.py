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
    ai, collaboration, notifications, calendar
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

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Startup süreci başladı...")
        
        # Kritik dosya kontrolleri
        files_to_check = {
            "Firebase Anahtarı": settings.FIREBASE_SERVICE_ACCOUNT_PATH,
            "Rehber Excel": os.path.join(BASE_DIR, "rehber.xlsx"),
            ".env Dosyası": os.path.join(BASE_DIR, ".env")
        }
        
        for name, path in files_to_check.items():
            if os.path.exists(path):
                logger.info(f"KONTROL: {name} bulundu -> {path}")
            else:
                logger.error(f"KONTROL: {name} BULUNAMADI! -> {path}")

        if settings.STARTUP_SYNC_ENABLED:
            try:
                logger.info("Otomatik senkronizasyon başlatılıyor...")
                asyncio.create_task(ContactService.sync_from_rdb_rehber_v6())
                asyncio.create_task(InspectorService.sync_from_excel())
                logger.info("Senkronizasyon görevleri arka plana atıldı.")
            except Exception as e:
                logger.error(f"Startup senkronizasyon hatası: {str(e)}")
        else:
            logger.info("Startup senkronizasyonu ayarlar gereği devre dışı.")

        # Bundled content sync to DATA_DIR (Background)
        asyncio.create_task(sync_bundled_content())
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(inspectors.router, prefix="/api/inspectors", tags=["Inspectors"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(collaboration.router, prefix="/api/collaboration", tags=["Collaboration"])
app.include_router(ai_knowledge.router, prefix="/api/ai-knowledge", tags=["AI Knowledge"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])

@app.get("/")
async def root():
    return {"message": "MufYARD API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.1-antigravity"}

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
