import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import json
import asyncio
from app.config import get_settings

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
        # Proper CSP for Electron apps: allow local resources, unsafe-inline for dev (remove in production)
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

app = FastAPI(title="MufYard V-2.0 API")
settings = get_settings()

@app.on_event("startup")
async def startup_event():
    # Startup performansı için ağır Excel senkronizasyonu opsiyonel hale getirildi.
    if settings.STARTUP_SYNC_ENABLED:
        print("Sistem başlatılıyor... Veri senkronizasyonu arka planda başlatıldı.")
        asyncio.create_task(ContactService.sync_from_rdb_rehber_v6())
        asyncio.create_task(InspectorService.sync_from_excel())
    else:
        print("Sistem başlatılıyor... Startup senkronizasyonu devre dışı.")

# Mount static files for media uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Mount Raporlar directory for file management
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Raporlar")
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/Raporlar", StaticFiles(directory=REPORTS_DIR), name="Raporlar")

# Mount Mevzuat directory for file management
MEVZUAT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Mevzuat")
if not os.path.exists(MEVZUAT_DIR):
    os.makedirs(MEVZUAT_DIR, exist_ok=True)
app.mount("/Mevzuat", StaticFiles(directory=MEVZUAT_DIR), name="Mevzuat")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, specify the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add CSP Middleware (must be added after CORS for proper order)
app.add_middleware(CSPMiddleware)

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
    return {"message": "MufYard V-2.0 API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
