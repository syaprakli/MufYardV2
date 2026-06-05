from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from app.services.ai_service import AIService
from app.lib.auth import get_current_user, require_roles
from app.config import BASE_DIR
import os
import re
import logging
import traceback

logger = logging.getLogger("ai_router")

router = APIRouter(tags=["ai"])
ai_service = AIService()
class SearchResult(BaseModel):
    id: str
    name: str
    type: str
    score: float

class AISearchRequest(BaseModel):
    query: str

from app.lib.auth import get_current_user

@router.post("/search", response_model=List[SearchResult])
async def ai_search(
    req: AISearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    AI destekli dosya/folder arama. Şimdilik sadece isimlerde basit benzerlik, ileride içerik ve embedding ile genişletilebilir.
    """
    from app.lib.folder_manager import FolderManager
    import difflib
    all_items = await asyncio.to_thread(FolderManager.get_tree)
    results = []
    user_id = current_user.get("uid")
    for item in all_items:
        # Sadece okuma izni olanlar
        if item["type"] == "folder" or FolderManager.check_permission(item["id"], user_id, "read"):
            # Basit string benzerliği (daha sonra embedding ile geliştirilebilir)
            score = difflib.SequenceMatcher(None, req.query.lower(), item["name"].lower()).ratio()
            if score > 0.3:
                results.append({
                    "id": item["id"],
                    "name": item["name"],
                    "type": item["type"],
                    "score": score
                })
    # Skora göre sırala
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:20]

# Profil üzerinden kullanıcının AI ayarlarını almak için
from app.lib.firebase_admin import db as _db
from app.services.ai_service import _get_user_ai_settings
from app.lib.local_settings import get_local_ai_settings, save_local_ai_settings


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

    return 500, "MODEL HATASI: AI şu an yanıt veremiyor. Lütfen bu mesajı kopyalayıp bana iletin."

# .env dosyasının yolu
ENV_PATH = os.path.join(BASE_DIR, ".env")


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
    """Kullanıcının kendi AI ayarlarını döndürür (key maskelenmiş). Yerel önceliklidir."""
    # Önce yerel ayarlara bak
    local_settings = get_local_ai_settings()
    key = local_settings.get("gemini_api_key")
    model = local_settings.get("gemini_model")
    
    # Yerelde yoksa Firestore'dan çekmeyi deneme
    has_premium_ai = False
    if not key:
        try:
            # Firestore'dan çek (5 değer döner: key, model, temp, prompt, is_premium)
            key, firebase_model, _, _, has_premium_ai = await _get_user_ai_settings(current_user["uid"])
            if not model:
                model = firebase_model
        except Exception as e:
            logger.warning(f"Firestore AI ayarları çekilemedi: {e}")
            key, model = None, None

    masked = ""
    if key:
        masked = key[:6] + "*" * max(0, len(key) - 10) + key[-4:] if len(key) > 10 else "****"
    
    return {
        "has_key": bool(key), 
        "masked_key": masked, 
        "gemini_model": model or "gemini-2.0-flash",
        "has_premium_ai": has_premium_ai
    }


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
        message = f"HATA DETAYI: {type(e).__name__} - {str(e)} | Lütfen bu mesajı kopyalayıp bana ilet."
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
    """Kullanıcının kendi Gemini API anahtarını YEREL dosyaya kaydeder."""
    import asyncio as _aio
    try:
        key = request.gemini_api_key.strip()
        if not key:
            raise HTTPException(status_code=400, detail="API key boş olamaz.")

        model_val = request.gemini_model.strip() or "gemini-2.0-flash"
        
        # 1. Yerel dosyaya kaydet (Öncelikli ve Güvenli)
        success = save_local_ai_settings({
            "gemini_api_key": key,
            "gemini_model": model_val
        })
        
        if not success:
            raise HTTPException(status_code=500, detail="Yerel ayarlar kaydedilemedi.")

        # 2. Firestore'u sadece model bilgisi için isteğe bağlı güncelle (opsiyonel)
        # Ama anahtarı artık Firestore'a göndermiyoruz (GÜVENLİK)
        uid = current_user["uid"]
        doc_ref = _db.collection("profiles").document(uid)
        await _aio.to_thread(doc_ref.update, {
            "gemini_model": model_val,
            "ai_model": model_val
        })

        return {"status": "success", "message": "API anahtarınız bilgisayarınıza (yerel) kaydedildi."}
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
        from app.config import get_settings
        settings = get_settings()
        
        key, model_name, _, _, is_premium = await _get_user_ai_settings(current_user["uid"])
        
        # Premium anahtarı kontrolü
        if not key:
            if is_premium and settings.GEMINI_API_KEY:
                key = settings.GEMINI_API_KEY
                logger.info(f"Testing connection for premium user {current_user['uid']} using system key.")
            else:
                return {"connected": False, "message": "Henüz API anahtarı girilmemiş. Ayarlar sayfasına gidip kendi anahtarınızı girin veya sistem yetkisi isteyin."}
            
        genai.configure(api_key=key)
        
        # Google SDK models/ prefix'i ve slug formatı bekler
        model_slug = (model_name or "gemini-2.0-flash").lower().strip().replace(" ", "-")
        
        # Mapping (AIService ile aynı olmalı)
        model_mapping = {
            "gemini-3.1-pro": "gemini-1.5-pro",
            "gemini-2.5-flash": "gemini-2.0-flash",
            "gemini-test-model": "gemini-2.0-flash"
        }
        if model_slug in model_mapping:
            model_slug = model_mapping[model_slug]

        full_model_name = model_slug if model_slug.startswith("models/") else f"models/{model_slug}"
            
        logger.info(f"[AI TEST] Testing connection with model: {full_model_name}")
        model = genai.GenerativeModel(full_model_name)
        resp = await model.generate_content_async("Merhaba, sadece 'OK' yaz.")
        if resp and resp.text:
            return {"connected": True, "message": "Bağlantı başarılı."}
        return {"connected": False, "message": "Yanıt alınamadı."}
    except Exception as e:
        logger.error(f"[AI TEST] Connection test failed for user {current_user.get('uid')}: {e}")
        logger.error(traceback.format_exc())
        status_code, message = _normalize_gemini_error(e)
        message = f"HATA DETAYI: {type(e).__name__} - {str(e)}"
        return {"connected": False, "message": message, "code": status_code}

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Ses dosyasını (audio/webm veya audio/wav) alır, Gemini API ile Türkçe metne dönüştürür.
    """
    import shutil
    import tempfile
    import google.generativeai as genai
    from app.config import get_settings
    
    api_key, model_name, _, _, is_premium = await _get_user_ai_settings(current_user["uid"])
    
    if not api_key:
        settings_val = get_settings()
        if is_premium and settings_val.GEMINI_API_KEY:
            api_key = settings_val.GEMINI_API_KEY
        else:
            raise HTTPException(
                status_code=400, 
                detail="Henüz bir Gemini API anahtarı tanımlanmamış. Ayarlar sayfasından kendi anahtarınızı girin."
            )

    suffix = os.path.splitext(file.filename)[1] or ".webm"
    mime_type = file.content_type or "audio/webm"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        try:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ses dosyası kaydedilemedi: {e}")

    try:
        genai.configure(api_key=api_key)
        
        logger.info(f"[TRANSCRIBE] Uploading audio file: {temp_path} ({mime_type})")
        audio_file = genai.upload_file(path=temp_path, mime_type=mime_type)
        
        # Ses deşifre için flash modeli mükemmel çalışır.
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        prompt = (
            "Sana bir ses dosyası veriyorum. Bu ses dosyasında konuşulanları BİREBİR Türkçe metin olarak deşifre (transcribe) et. "
            "Ekstra yorum ekleme, sadece konuşulanları yaz."
        )
        
        response = model.generate_content([audio_file, prompt])
        
        try:
            audio_file.delete()
        except Exception as del_err:
            logger.warning(f"[TRANSCRIBE] Google file deletion failed: {del_err}")
            
        transcription = response.text.strip() if response and response.text else ""
        return {"text": transcription}
        
    except Exception as e:
        logger.error(f"[TRANSCRIBE] Transcription failed: {e}")
        logger.error(traceback.format_exc())
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=f"Ses deşifre edilemedi: {message}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

class ProofreadRequest(BaseModel):
    text: str

@router.post("/proofread")
async def proofread_text(
    req: ProofreadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Rapor metnini AI ile Türkçe dil bilgisi ve imla kontrolünden geçirir.
    """
    try:
        return await ai_service.proofread(req.text, current_user)
    except ValueError as e:
        logger.error(f"[AI PROOFREAD] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[AI PROOFREAD] Exception type={type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=message)

class SuggestLegislationRequest(BaseModel):
    text: str

@router.post("/suggest-legislation")
async def suggest_legislation_endpoint(
    req: SuggestLegislationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Yazılan rapora göre GSB mevzuat önerileri ve referansları getirir.
    """
    try:
        recommendations = await ai_service.suggest_legislation(req.text, current_user)
        return {"recommendations": recommendations}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[AI LEGISLATION SUGGEST] Exception: {e}")
        status_code, message = _normalize_gemini_error(e)
        raise HTTPException(status_code=status_code, detail=message)


