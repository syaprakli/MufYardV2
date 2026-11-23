from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Dict, List, Optional
from app.services.profile_service import ProfileService
from app.lib.auth import get_current_user, require_founder_admin
import logging

logger = logging.getLogger(__name__)

from pydantic import BaseModel

class LicenseKeyPayload(BaseModel):
    key: Optional[str] = None
    license_key: Optional[str] = None

router = APIRouter(tags=["Licenses"])

@router.post("/activate")
async def activate_license(payload: LicenseKeyPayload, current_user: Dict[str, Any] = Depends(get_current_user)):
    uid = current_user.get("uid")
    license_key = payload.key or payload.license_key
    
    logger.info(f"--- LİSANS AKTİVASYON BAŞLADI --- (uid={uid})")
    
    if not uid or not license_key:
        logger.error("Eksik bilgi: UID veya Key yok.")
        raise HTTPException(status_code=400, detail="Lisans anahtarı gereklidir.")
        
    try:
        logger.info("ProfileService.activate_premium çağrılıyor...")
        success = await ProfileService.activate_premium(uid, license_key)
        logger.info(f"Aktivasyon sonucu: {success}")
        
        if not success:
            logger.warning("Aktivasyon başarısız: Geçersiz veya kullanılmış anahtar.")
            raise HTTPException(status_code=400, detail="Geçersiz veya kullanılmış lisans anahtarı.")
            
        logger.info("--- LİSANS AKTİVASYON BAŞARIYLA TAMAMLANDI ---")
        return {"status": "success", "message": "Lisans başarıyla aktifleştirildi."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lisans aktivasyonunda beklenmedik hata: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Lisans aktivasyonu sırasında bir hata oluştu.")

@router.get("/list")
async def get_licenses(current_user: Dict[str, Any] = Depends(require_founder_admin)):
    keys = await ProfileService.get_all_license_keys()
    if keys is None:
        raise HTTPException(status_code=500, detail="Lisanslar listelenirken bir hata oluştu.")
    return keys

class GenerateLicensePayload(BaseModel):
    duration_months: int = 0

@router.post("/generate")
async def generate_license(payload: GenerateLicensePayload, current_user: Dict[str, Any] = Depends(require_founder_admin)):
    key = await ProfileService.generate_license_key(duration_months=payload.duration_months)
    if not key:
        raise HTTPException(status_code=500, detail="Lisans üretilemedi (Veritabanı hatası).")
    return {"key": key}

class BulkDeletePayload(BaseModel):
    keys: List[str]

@router.post("/bulk-delete")
@router.post("/bulk-delete/")
async def bulk_delete_licenses(payload: BulkDeletePayload, current_user: Dict[str, Any] = Depends(require_founder_admin)):
    results = await ProfileService.bulk_delete_licenses(payload.keys)
    return results

@router.delete("/{key}")
async def delete_license(key: str, current_user: Dict[str, Any] = Depends(require_founder_admin)):
    success = await ProfileService.delete_license_key(key)
    if not success:
        raise HTTPException(status_code=400, detail="Lisans silinemedi veya zaten kullanılmış.")
    return {"status": "success"}
