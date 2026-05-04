from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from app.services.profile_service import ProfileService
from app.schemas.profile import ProfileUpdate, ProfileResponse
from app.services.email_service import EmailService

router = APIRouter(tags=["profiles"])

@router.get("/", response_model=List[ProfileResponse])
async def get_all_profiles():
    return await ProfileService.get_all_profiles()

@router.get("/{uid}", response_model=ProfileResponse)
async def get_profile(uid: str):
    profile = await ProfileService.get_profile(uid)
    if not profile:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    return profile

@router.patch("/{uid}", response_model=ProfileResponse)
async def update_profile(uid: str, profile_update: ProfileUpdate):
    updated = await ProfileService.update_profile(uid, profile_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Profil güncellenemedi.")
    return updated

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

