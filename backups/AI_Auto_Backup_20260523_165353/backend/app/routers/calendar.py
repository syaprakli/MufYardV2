import os
import json
import asyncio
import base64
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel
from typing import List, Any, Optional
from google_auth_oauthlib.flow import InstalledAppFlow
from app.services.google_service import GoogleCalendarService, SCOPES
from app.lib.firebase_admin import db

router = APIRouter(tags=["calendar"])


# ── Calendar Notes Schemas ─────────────────────────────────────────────────────

class CalendarNoteCreate(BaseModel):
    uid: str
    date_key: str   # format: "YYYY-M-D"
    text: str
    time: str       # e.g. "14:30"

class CalendarNoteResponse(BaseModel):
    id: str
    owner_id: str
    date_key: str
    text: str
    time: str
    created_at: Optional[str] = None


# ── Calendar Notes Endpoints ───────────────────────────────────────────────────

@router.get("/notes", response_model=List[CalendarNoteResponse])
async def get_calendar_notes(uid: str = Query(...)):
    """Fetch all calendar notes for a given user."""
    try:
        query = db.collection("calendar_notes").where("owner_id", "==", uid)
        docs = await asyncio.to_thread(query.stream)
        result = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            if "created_at" in data and hasattr(data["created_at"], "isoformat"):
                data["created_at"] = data["created_at"].isoformat()
            result.append(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notes", response_model=CalendarNoteResponse)
async def create_calendar_note(note: CalendarNoteCreate):
    """Create a new calendar note for a user."""
    try:
        data = {
            "owner_id": note.uid,
            "date_key": note.date_key,
            "text": note.text,
            "time": note.time,
            "created_at": datetime.utcnow(),
        }
        doc_ref = await asyncio.to_thread(db.collection("calendar_notes").add, data)
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        result = new_doc.to_dict()
        result["id"] = doc_ref[1].id
        if "created_at" in result and hasattr(result["created_at"], "isoformat"):
            result["created_at"] = result["created_at"].isoformat()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/notes/{note_id}")
async def delete_calendar_note(note_id: str, uid: str = Query(...)):
    """Delete a calendar note, verifying ownership."""
    try:
        doc_ref = db.collection("calendar_notes").document(note_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Not bulunamadı.")
        if doc.to_dict().get("owner_id") != uid:
            raise HTTPException(status_code=403, detail="Bu notu silme yetkiniz yok.")
        await asyncio.to_thread(doc_ref.delete)
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── OAuth Helpers ──────────────────────────────────────────────────────────────

def _popup_result_page(frontend_url: str, query: str) -> HTMLResponse:
        target = f"{frontend_url}/calendar?{query}"
        ok = "synced=true" in query
        html = f"""
        <!doctype html>
        <html>
            <head><meta charset=\"utf-8\"><title>MufYard OAuth</title></head>
            <body style=\"font-family:Segoe UI,Arial,sans-serif;padding:24px\">
                <p id=\"msg\">{('Bağlantı tamamlandı, pencere kapatılıyor...' if ok else 'Bağlantı tamamlanamadı, pencere kapatılıyor...')}</p>
                <button id=\"btn\" style=\"display:none;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#0f172a;color:#fff;cursor:pointer\">Pencereyi Kapat</button>
                <script>
                    (function() {{
                        var target = {json.dumps(target)};
                        var payload = {{ type: 'mufyard_google_oauth_result', ok: {str(ok).lower()}, query: {json.dumps(query)} }};
                        var closed = false;
                        function tryClose() {{
                            try {{ window.close(); }} catch (e) {{}}
                        }}
                        try {{
                            if (window.opener && !window.opener.closed) {{
                                try {{ window.opener.postMessage(payload, '*'); }} catch (e) {{}}
                                tryClose();
                                setTimeout(tryClose, 120);
                                setTimeout(tryClose, 300);
                                closed = true;
                            }}
                        }} catch (e) {{}}

                        if (!closed) {{
                            // Popup-opener bağı yoksa klasik web fallback
                            window.location.href = target;
                        }}

                        // Bazı gömülü tarayıcılar close'u engeller; fallback göster.
                        setTimeout(function() {{
                            var msg = document.getElementById('msg');
                            var btn = document.getElementById('btn');
                            if (msg) msg.textContent = 'Pencere kapanmadı. Kapatmak için tıklayın.';
                            if (btn) {{
                                btn.style.display = 'inline-block';
                                btn.onclick = function() {{ tryClose(); }};
                            }}
                        }}, 900);
                    }})();
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html)

@router.get("/auth-url")
async def get_auth_url(uid: str = Query(...), return_url: str | None = Query(default=None)):
    """Generates the Google OAuth2 authorization URL for a specific user."""
    if not os.path.exists('credentials.json'):
        raise HTTPException(status_code=500, detail="credentials.json file missing on server.")
    
    flow = await asyncio.to_thread(
        InstalledAppFlow.from_client_secrets_file,
        'credentials.json',
        scopes=SCOPES
    )
    # Use 'state' to pass the UID through the OAuth flow
    # In a real app, this should be an absolute URL
    backend_url = os.getenv("VITE_API_URL", "http://localhost:8000").rstrip("/")
    flow.redirect_uri = f"{backend_url}/api/calendar/callback"
    
    state_payload = {
        "uid": uid,
        "return_url": return_url
    }
    encoded_state = base64.urlsafe_b64encode(json.dumps(state_payload).encode("utf-8")).decode("utf-8")

    auth_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        state=encoded_state,
        prompt='consent'
    )
    return {"url": auth_url}

@router.get("/callback")
async def oauth_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None)
):
    """Handles the redirect from Google, exchanges code for tokens, and saves to the user profile."""
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # User izin ekranında reddederse Google `error=access_denied` ile döner.
    if error:
        return _popup_result_page(frontend_url, f"error={error}")

    if not code or not state:
        return _popup_result_page(frontend_url, "error=auth_failed")

    uid = state
    frontend_from_state = None
    try:
        decoded = base64.urlsafe_b64decode(state.encode("utf-8")).decode("utf-8")
        payload = json.loads(decoded)
        uid = payload.get("uid", state)
        frontend_from_state = payload.get("return_url")
    except Exception:
        # Backward compatibility: old state was plain uid
        uid = state

    frontend_url = (frontend_from_state or frontend_url or "http://localhost:3000").rstrip("/")
    backend_url = os.getenv("VITE_API_URL", "http://localhost:8000").rstrip("/")
    redirect_uri = f"{backend_url}/api/calendar/callback"
    
    try:
        cal_service = GoogleCalendarService(uid)
        await cal_service.authenticate(code=code, redirect_uri=redirect_uri)
        
        # Popup akışında ana pencereye dön ve popup'ı kapat.
        return _popup_result_page(frontend_url, "synced=true")
    except Exception as e:
        print(f"Callback error: {e}")
        return _popup_result_page(frontend_url, "error=auth_failed")

@router.get("/events")
async def get_google_events(uid: str = Query(...), max_results: int = Query(20, ge=1)):
    """Fetches upcoming events from the user's Google Calendar."""
    try:
        cal_service = GoogleCalendarService(uid)
        events = await cal_service.get_upcoming_events(max_results=max_results)
        return events
    except Exception as e:
        print(f"Error fetching Google events for {uid}: {e}")
        return []

@router.get("/status")
async def get_calendar_status(uid: str = Query(...)):
    """Checks if the user has a linked Google token in Firestore."""
    from app.lib.firebase_admin import db
    
    doc_ref = db.collection('profiles').document(uid).collection('calendar_tokens').document('google')
    doc = await asyncio.to_thread(doc_ref.get)
    
    return {
        "connected": doc.exists,
        "credentials_configured": os.path.exists('credentials.json')
    }
