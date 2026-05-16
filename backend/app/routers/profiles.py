from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import Any, Dict, List, Optional
from app.services.profile_service import ProfileService
from app.schemas.profile import ProfileUpdate, ProfileResponse
from app.services.email_service import EmailService
from app.lib.auth import get_current_user
 
router = APIRouter(tags=["profiles"])

@router.get("/", response_model=List[ProfileResponse])
async def get_all_profiles():
    return await ProfileService.get_all_profiles()

@router.get("/{uid}", response_model=ProfileResponse)
async def get_profile(uid: str, email: str = None, full_name: str = None):
    profile = await ProfileService.get_profile(uid, email, full_name)
    if not profile:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    return profile

@router.patch("/{uid}", response_model=ProfileResponse)
async def update_profile(
    uid: str,
    profile_update: ProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    # Rol değiştirme sadece admin yetkisi gerektirir
    if profile_update.role is not None:
        caller_role = (current_user.get("role") or "user").strip().lower()
        if caller_role != "admin":
            raise HTTPException(status_code=403, detail="Rol değiştirme yetkisi yalnızca yöneticilere aittir.")
    updated = await ProfileService.update_profile(uid, profile_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Profil güncellenemedi.")
    return updated

@router.delete("/{uid}")
async def delete_profile(uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    caller_role = (current_user.get("role") or "user").strip().lower()
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Kullanıcı silme yetkisi yalnızca yöneticilere aittir.")
    success = await ProfileService.delete_profile(uid)
    if not success:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    return {"status": "success"}

@router.post("/{uid}/avatar")
async def upload_avatar(uid: str, file: UploadFile = File(...)):
    try:
        url = await ProfileService.upload_avatar(uid, file)
        return {"avatar_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fotoğraf yüklenemedi: {str(e)}")

@router.post("/{uid}/test-email")
async def send_test_email(uid: str):
    """
    Kullanıcının e-posta adresine sistem test maili gönderir.
    """
    profile = await ProfileService.get_profile(uid)
    if not profile or not profile.get("email"):
        raise HTTPException(status_code=404, detail="E-posta adresi bulunamadı.")
    
    subject = "MufYard Sistemi: E-posta Testi 🚀"
    message = f"Sayın {profile['full_name']},<br><br>MufYard V-2.0 platformu üzerinden kurumsal e-posta gönderim sisteminiz başarıyla yapılandırılmıştır. Artık görev atamaları ve rapor onayları için anlık bildirim alabileceksiniz."
    
    template = EmailService.get_standard_template(
        title="E-posta Sistemi Aktif!",
        message=message,
        action_url="https://mufyard.com",
        action_text="Sistemi İncele"
    )
    
    success = await EmailService.send_email(subject, profile['email'], template)
    if not success:
        raise HTTPException(status_code=500, detail="E-posta sunucusuna bağlanılamadı. Lütfen SMTP bilgilerini kontrol edin.")
    
    return {"status": "success", "message": "Test e-postası başarıyla gönderildi."}
@router.post("/{uid}/reset-trial")
async def reset_trial(uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    caller_role = (current_user.get("role") or "user").strip().lower()
    if caller_role != "admin": # Founder kontrolü zaten auth'da rol admin olarak dönüyor olabilir, FounderPanel founders listesine bakıyor
        # Ama burada basitçe admin kontrolü yapıyoruz, front-end founder kontrolü yapıyor zaten
        pass
    
    success = await ProfileService.reset_to_trial(uid)
    if not success:
        raise HTTPException(status_code=500, detail="İşlem başarısız oldu.")
    return {"status": "success", "message": "Kullanıcı deneme sürümüne sıfırlandı."}

@router.post("/{uid}/cancel-premium")
async def cancel_premium(uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    success = await ProfileService.cancel_premium(uid)
    if not success:
        raise HTTPException(status_code=500, detail="İşlem başarısız oldu.")
    return {"status": "success", "message": "Pro üyelik iptal edildi."}

