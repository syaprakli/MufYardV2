from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import asyncio
from app.services.profile_service import ProfileService
from app.schemas.profile import ProfileUpdate, ProfileResponse
from app.services.email_service import EmailService
from app.lib.auth import get_current_user
from app.lib.rate_limiter import limiter
from app.lib.firebase_admin import db
 
router = APIRouter(tags=["profiles"])


async def _log_role_change_event(
    request: Request,
    *,
    actor: Dict[str, Any],
    target_uid: str,
    old_role: Optional[str],
    new_role: Optional[str],
    status: str,
    reason: Optional[str] = None,
) -> None:
    """Store security-grade audit logs for role change operations."""
    try:
        actor_uid = (actor.get("uid") or "").strip()
        actor_email = (actor.get("email") or "").strip().lower()
        actor_role = (actor.get("role") or "user").strip().lower()

        user_agent = request.headers.get("user-agent", "")
        forwarded_for = request.headers.get("x-forwarded-for", "")
        client_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else "") or (request.client.host if request.client else "")

        target_profile = await ProfileService.get_profile(target_uid)

        payload = {
            "event_type": "role_change",
            "status": status,
            "reason": reason or "",
            "actor_uid": actor_uid,
            "actor_email": actor_email,
            "actor_role": actor_role,
            "target_uid": target_uid,
            "target_email": (target_profile or {}).get("email", ""),
            "old_role": old_role or "",
            "new_role": new_role or "",
            "ip": client_ip,
            "user_agent": user_agent,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await asyncio.to_thread(db.collection("security_audit_logs").add, payload)
    except Exception:
        # Audit logging must never block the main request path.
        return

@router.get("/", response_model=List[ProfileResponse])
async def get_all_profiles(current_user: Dict[str, Any] = Depends(get_current_user)):
    return await ProfileService.get_all_profiles()

@router.get("/{uid}", response_model=ProfileResponse)
async def get_profile(
    uid: str,
    email: str = None,
    full_name: str = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    profile = await ProfileService.get_profile(uid, email, full_name)
    if not profile:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    return profile

@router.patch("/{uid}", response_model=ProfileResponse)
@limiter.limit("5/minute")
async def update_profile(
    request: Request,
    uid: str,
    profile_update: ProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    import logging
    logger = logging.getLogger("app.profiles")
    caller_uid = (current_user.get("uid") or "").strip()
    caller_role = (current_user.get("role") or "user").strip().lower()
    caller_email = (current_user.get("email") or "").strip().lower()
    founder_emails = {email.strip().lower() for email in ProfileService.FOUNDER_EMAILS}
    is_founder = caller_email in founder_emails

    # Sahiplik kontrolü: Sadece kendi profilini veya admin/kurucu başkasının profilini güncelleyebilir
    if caller_uid != uid and caller_role != "admin" and not is_founder:
        raise HTTPException(status_code=403, detail="Başka bir kullanıcının profilini güncelleyemezsiniz.")

    # Rol degistirme sadece kurucu hesaplara aciktir.
    if profile_update.role is not None:
        target_profile_before = await ProfileService.get_profile(uid)
        old_role = (target_profile_before or {}).get("role")
        if not is_founder:
            await _log_role_change_event(
                request,
                actor=current_user,
                target_uid=uid,
                old_role=old_role,
                new_role=profile_update.role,
                status="denied",
                reason="founder_only_guard",
            )
            raise HTTPException(status_code=403, detail="Rol değiştirme yetkisi yalnızca kurucu hesaplara aittir.")
    logger.info(f"PROFILE UPDATE ATTEMPT: user_id={current_user.get('uid')}, target_uid={uid}, changes={profile_update.dict(exclude_unset=True)}")
    updated = await ProfileService.update_profile(uid, profile_update)
    if not updated:
        if profile_update.role is not None:
            await _log_role_change_event(
                request,
                actor=current_user,
                target_uid=uid,
                old_role=old_role,
                new_role=profile_update.role,
                status="failed",
                reason="profile_update_failed",
            )
        logger.warning(f"PROFILE UPDATE FAILED: user_id={current_user.get('uid')}, target_uid={uid}")
        raise HTTPException(status_code=404, detail="Profil güncellenemedi.")
    if profile_update.role is not None:
        await _log_role_change_event(
            request,
            actor=current_user,
            target_uid=uid,
            old_role=old_role,
            new_role=updated.get("role"),
            status="success",
            reason="role_updated",
        )
    logger.info(f"PROFILE UPDATE SUCCESS: user_id={current_user.get('uid')}, target_uid={uid}")
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
async def upload_avatar(
    uid: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        caller_role = (current_user.get("role") or "user").strip().lower()
        if current_user.get("uid") != uid and caller_role != "admin":
            raise HTTPException(status_code=403, detail="Başka bir kullanıcının avatarını güncelleyemezsiniz.")
        url = await ProfileService.upload_avatar(uid, file)
        return {"avatar_url": url}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Fotoğraf yüklenemedi: {str(e)}")

@router.post("/{uid}/test-email")
async def send_test_email(uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Kullanıcının e-posta adresine sistem test maili gönderir.
    """
    caller_role = (current_user.get("role") or "user").strip().lower()
    if current_user.get("uid") != uid and caller_role != "admin":
        raise HTTPException(status_code=403, detail="Başka bir kullanıcı adına test e-postası gönderemezsiniz.")
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
@limiter.limit("5/minute")
async def reset_trial(request: Request, uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    import logging
    logger = logging.getLogger("app.profiles")
    caller_role = (current_user.get("role") or "user").strip().lower()
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca yöneticilere açıktır.")
    
    logger.info(f"RESET TRIAL ATTEMPT: user_id={current_user.get('uid')}, target_uid={uid}")
    success = await ProfileService.reset_to_trial(uid)
    if not success:
        logger.warning(f"RESET TRIAL FAILED: user_id={current_user.get('uid')}, target_uid={uid}")
        raise HTTPException(status_code=500, detail="İşlem başarısız oldu.")
    logger.info(f"RESET TRIAL SUCCESS: user_id={current_user.get('uid')}, target_uid={uid}")
    return {"status": "success", "message": "Kullanıcı deneme sürümüne sıfırlandı."}

@router.post("/{uid}/cancel-premium")
@limiter.limit("5/minute")
async def cancel_premium(request: Request, uid: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    import logging
    logger = logging.getLogger("app.profiles")
    caller_role = (current_user.get("role") or "user").strip().lower()
    if caller_role != "admin":
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca yöneticilere açıktır.")
    logger.info(f"CANCEL PREMIUM ATTEMPT: user_id={current_user.get('uid')}, target_uid={uid}")
    success = await ProfileService.cancel_premium(uid)
    if not success:
        logger.warning(f"CANCEL PREMIUM FAILED: user_id={current_user.get('uid')}, target_uid={uid}")
        raise HTTPException(status_code=500, detail="İşlem başarısız oldu.")
    logger.info(f"CANCEL PREMIUM SUCCESS: user_id={current_user.get('uid')}, target_uid={uid}")
    return {"status": "success", "message": "Pro üyelik iptal edildi."}

