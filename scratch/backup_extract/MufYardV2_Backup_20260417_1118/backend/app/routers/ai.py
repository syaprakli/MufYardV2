from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.services.ai_service import AIService
from app.lib.auth import get_current_user, require_roles
import os
import re
import logging
import traceback

logger = logging.getLogger("ai_router")

router = APIRouter(tags=["ai"])
ai_service = AIService()

# Profil üzerinden kullanıcının AI ayarlarını almak için
from app.lib.firebase_admin import db as _db
from app.services.ai_service import _get_user_ai_settings


def _normalize_gemini_error(err: Exception) -> tuple[int, str]:
    raw = str(err) or "Bilinmeyen hata"
    low = raw.lower()

    # Quota / rate limit hatalari
    if "quota" in low or "rate limit" in low or "429" in low:
        retry_hint = ""
        m = re.search(r"retry in\s+([0-9]+(?:\.[0-9]+)?)s", low)
        if m:
            retry_hint = f" Yaklasik {int(float(m.group(1)))} sn sonra tekrar deneyin."
        return 429, (
            "Gemini kullanim kotasi asildi. Google AI Studio'da plan/billing ayarlarinizi kontrol edin "
            "veya kotanin yenilenmesini bekleyin." + retry_hint
        )

    # Anahtar / yetki hatalari
    if ("api key" in low and ("invalid" in low or "permission" in low or "unauthorized" in low)) or "403" in low:
        return 401, "API anahtari gecersiz veya bu proje/model icin yetkisi yok."

    # Model erisim hatasi
    if "model" in low and "not found" in low:
        return 400, "Secilen model bu API anahtari/proje icin kullanilamiyor. Ayarlardan farkli model secin."

    # Gecici servis/network hatalari
    if "timed out" in low or "deadline" in low or "unavailable" in low:
        return 503, "Gemini servisine su an ulasilamiyor. Biraz sonra tekrar deneyin."

    return 500, "AI servisi su an yanit veremiyor. Lutfen tekrar deneyin."

# .env dosyasının yolu
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")


class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    message: str
    context: str = ""
    history: Optional[List[ChatMessage]] = None

class ChatResponse(BaseModel):
    response: str
    actions: Optional[List[dict]] = None

class SetKeyRequest(BaseModel):
    gemini_api_key: str
    gemini_model: str = "gemini-2.0-flash"

class GenerateReportRequest(BaseModel):
    audit_id: str
    instructions: str = ""
    section: Optional[str] = None  # giris, tespitler, tenkit, sonuc, tamamini

class AnalyzeLegislationRequest(BaseModel):
    query: str
    legislation_id: Optional[str] = None


@router.get("/my-settings")
async def get_my_ai_settings(
    current_user: dict = Depends(get_current_user),
):
    """Kullanıcının kendi AI ayarlarını döndürür (key maskelenmiş)."""
    key, model = await _get_user_ai_settings(current_user["uid"])
    masked = ""
    if key:
        masked = key[:6] + "*" * max(0, len(key) - 10) + key[-4:] if len(key) > 10 else "****"
    return {"has_key": bool(key), "masked_key": masked, "gemini_model": model}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        history = None
        if request.history:
            history = [{"role": m.role, "text": m.text} for m in request.history]
        result = await ai_service.chat(
            request.message,
            history=history,
            context_type=request.context,
            user=current_user,
        )
        return {
            "response": result.get("text", ""),
            "actions": result.get("actions") or None,
        }
    except ValueError as e:
        logger.error(f"[AI CHAT] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[AI CHAT] Exception type={type(e).__name__}: {e}")
        logger.error(f"[AI CHAT] Traceback:\n{traceback.format_exc()}")
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=message)


@router.post("/generate-report")
async def generate_report(
    request: GenerateReportRequest,
    current_user: dict = Depends(get_current_user),
):
    """AI ile denetim raporu taslağı oluşturur."""
    try:
        html = await ai_service.generate_report(
            audit_id=request.audit_id,
            instructions=request.instructions,
            section=request.section,
            user=current_user,
        )
        return {"html": html}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=message)


@router.post("/analyze-legislation")
async def analyze_legislation(
    request: AnalyzeLegislationRequest,
    current_user: dict = Depends(get_current_user),
):
    """Mevzuat analizi yapar."""
    try:
        result = await ai_service.analyze_legislation(
            query=request.query,
            legislation_id=request.legislation_id,
            user=current_user,
        )
        return {"response": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=message)

@router.post("/set-key")
async def set_gemini_key(
    request: SetKeyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Kullanıcının kendi Gemini API anahtarını profiline kaydeder."""
    import asyncio as _aio
    try:
        key = request.gemini_api_key.strip()
        if not key:
            raise HTTPException(status_code=400, detail="API key boş olamaz.")

        model_val = request.gemini_model.strip() or "gemini-2.0-flash"
        uid = current_user["uid"]

        doc_ref = _db.collection("profiles").document(uid)
        await _aio.to_thread(doc_ref.update, {
            "gemini_api_key": key,
            "gemini_model": model_val,
        })

        return {"status": "success", "message": "API anahtarınız kaydedildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-connection")
async def test_gemini_connection(
    current_user: dict = Depends(get_current_user),
):
    """Kullanıcının kendi Gemini API anahtarını test eder."""
    try:
        import google.generativeai as genai
        key, model_name = await _get_user_ai_settings(current_user["uid"])
        if not key:
            return {"connected": False, "message": "Henüz API anahtarı girilmemiş. Ayarlardan anahtarınızı kaydedin."}
        genai.configure(api_key=key)
        model = genai.GenerativeModel(model_name)
        resp = await model.generate_content_async("Merhaba, sadece 'OK' yaz.")
        if resp and resp.text:
            return {"connected": True, "message": "Bağlantı başarılı."}
        return {"connected": False, "message": "Yanıt alınamadı."}
    except Exception as e:
        status_code, message = _normalize_gemini_error(e)
        return {"connected": False, "message": message, "code": status_code}
