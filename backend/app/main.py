import os
import json
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings, BASE_DIR, DATA_DIR

# --- KARAKUTU (LOG) SİSTEMİ ---
log_file = os.path.join(DATA_DIR, "backend_logs.txt")
logging.basicConfig(
    filename=log_file,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    encoding='utf-8'
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
