from fastapi import APIRouter, Response, HTTPException, Depends
from app.services.report_service import ReportService
from app.services.audit_service import AuditService
from app.schemas.audit import AuditCreate, AuditUpdate, AuditResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.lib.auth import get_current_user

router = APIRouter(tags=["audit"])

class ReportRequest(BaseModel):
    location: str
    subject: str
    introduction: Optional[str] = None
    findings: List[str]
    conclusion: Optional[str] = None
    inspector: str


def _resolve_audit_role(audit_data: Dict[str, Any], user_id: Optional[str], user_email: Optional[str]) -> str:
    identities = [v for v in [user_id, user_email] if v]
    owner_id = audit_data.get("owner_id")
    admin_id = "sefa.yaprakli@gsb.gov.tr"

    if any(identity in [owner_id, admin_id, "admin"] for identity in identities):
        return "edit"

    shared_roles = audit_data.get("shared_roles") or {}
    for identity in identities:
        role = shared_roles.get(identity)
        if role in ["view", "comment", "edit"]:
            return role

    # Backward compatibility for old shared documents without shared_roles mapping.
    shared_with = audit_data.get("shared_with") or []
    assigned_to = audit_data.get("assigned_to") or []
    accepted = audit_data.get("accepted_collaborators") or []
    if any(identity in shared_with or identity in assigned_to or identity in accepted for identity in identities):
        return "edit"

    return "none"

@router.get("/", response_model=List[AuditResponse])
async def list_audits(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        return await AuditService.get_all_audits(current_user.get("uid"), current_user.get("email"))
    except Exception:
        raise HTTPException(status_code=500, detail="Denetimler alınırken bir hata oluştu.")

@router.post("/", response_model=AuditResponse)
async def create_audit(audit: AuditCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        audit.owner_id = current_user.get("uid")
        return await AuditService.create_audit(audit)
    except Exception:
        raise HTTPException(status_code=500, detail="Denetim oluşturulurken bir hata oluştu.")

@router.get("/{id}", response_model=AuditResponse)
async def get_audit(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    audit = await AuditService.get_audit(id)
    if not audit:
        raise HTTPException(status_code=404, detail="Denetim bulunamadı.")

    role = _resolve_audit_role(audit, current_user.get("uid"), current_user.get("email"))
    user_role = (current_user.get("role") or "user").strip().lower()
    if role == "none" and user_role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Bu denetime erişim yetkiniz yok.")
    return audit

@router.patch("/{id}", response_model=AuditResponse)
async def update_audit(
    id: str,
    audit: AuditUpdate,
    force_version: Optional[bool] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    current = await AuditService.get_audit(id)
    if not current:
        raise HTTPException(status_code=404, detail="Denetim güncellenemedi.")

    role = _resolve_audit_role(current, current_user.get("uid"), current_user.get("email"))
    incoming = audit.dict(exclude_none=True)
    if incoming and role == "none":
        raise HTTPException(status_code=403, detail="Bu denetimi güncelleme yetkiniz yok.")
    if incoming and role == "view":
        raise HTTPException(status_code=403, detail="Goruntuleme rolu ile guncelleme yapamazsiniz.")
    if incoming and role == "comment":
        raise HTTPException(status_code=403, detail="Yorumlama rolu ile denetim alanlarini guncelleyemezsiniz.")
    if "report_content" in incoming and role in ["view", "comment"]:
        raise HTTPException(status_code=403, detail="Bu rapor içeriğini düzenleme yetkiniz yok.")

    updated = await AuditService.update_audit(id, audit, force_version)
    if not updated:
        raise HTTPException(status_code=404, detail="Denetim güncellenemedi.")

    try:
        from app.routers.audit_trail import log_audit_change
        username = current_user.get("email") or current_user.get("uid") or "Bilinmeyen Kullanıcı"
        action = "Rapor Güncellendi"
        if force_version:
            action = "Sürüm Oluşturuldu"
        
        details = ""
        incoming = audit.dict(exclude_none=True)
        if "report_content" in incoming:
            details = "Rapor metni düzenlendi."
        elif "title" in incoming:
            details = f"Rapor başlığı değiştirildi: {incoming['title']}"
            
        log_audit_change(id, username, action, details)
    except Exception as log_err:
        print(f"Audit trail loglama hatası: {log_err}")

    return updated

@router.post("/{id}/accept")
async def accept_audit(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await AuditService.accept_audit(id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Denetim reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Denetim kabul edildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Denetim kabul edilirken bir hata oluştu.")

@router.post("/{id}/reject")
async def reject_audit(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await AuditService.reject_audit(id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Denetim reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Denetim reddedildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Denetim reddedilirken bir hata oluştu.")

@router.delete("/{id}")
async def delete_audit(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await AuditService.get_audit(id)
    if not current:
        raise HTTPException(status_code=404, detail="Denetim silinemedi veya bulunamadı.")
    
    uid = current_user.get("uid")
    email = (current_user.get("email") or "").strip().lower()
    identity_keys = [v for v in [uid, email] if v]
    
    owner_id = current.get("owner_id")
    admin_id = "sefa.yaprakli@gsb.gov.tr"
    
    is_owner_or_admin = (
        any(identity in [owner_id, admin_id, "admin"] for identity in identity_keys) or
        (current_user.get("role") or "user").strip().lower() == "admin"
    )

    if is_owner_or_admin:
        success = await AuditService.delete_audit(id)
        if not success:
            raise HTTPException(status_code=404, detail="Denetim silinemedi veya bulunamadı.")
        return {"status": "success", "message": "Denetim silindi"}
    else:
        import asyncio
        from app.lib.firebase_admin import db
        
        assigned_to = current.get("assigned_to") or []
        shared_with = current.get("shared_with") or []
        pending_collaborators = current.get("pending_collaborators") or []
        accepted_collaborators = current.get("accepted_collaborators") or []

        is_collaborator = (
            any(ident in assigned_to for ident in identity_keys) or
            any(ident in shared_with for ident in identity_keys) or
            any(ident in pending_collaborators for ident in identity_keys) or
            any(ident in accepted_collaborators for ident in identity_keys)
        )

        if is_collaborator:
            doc_ref = db.collection('audits').document(id)
            
            new_assigned = [ident for ident in assigned_to if ident not in identity_keys]
            new_shared = [ident for ident in shared_with if ident not in identity_keys]
            new_pending = [ident for ident in pending_collaborators if ident not in identity_keys]
            new_accepted = [ident for ident in accepted_collaborators if ident not in identity_keys]
            
            await asyncio.to_thread(doc_ref.update, {
                "assigned_to": new_assigned,
                "shared_with": new_shared,
                "pending_collaborators": new_pending,
                "accepted_collaborators": new_accepted
            })
            return {"status": "success", "message": "Denetim paylaşımlarınızdan kaldırıldı."}
        else:
            raise HTTPException(status_code=403, detail="Bu denetimi silme veya terk etme yetkiniz yok.")


@router.get("/{id}/versions")
async def get_audit_versions(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        current = await AuditService.get_audit(id)
        if not current:
            raise HTTPException(status_code=404, detail="Denetim bulunamadı.")
        role = _resolve_audit_role(current, current_user.get("uid"), current_user.get("email"))
        user_role = (current_user.get("role") or "user").strip().lower()
        if role == "none" and user_role not in ["admin", "moderator"]:
            raise HTTPException(status_code=403, detail="Bu denetime erişim yetkiniz yok.")
        return await AuditService.get_audit_versions(id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Denetim sürümleri alınırken bir hata oluştu.")

@router.post("/{id}/restore/{version_id}", response_model=AuditResponse)
async def restore_audit_version(
    id: str, 
    version_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    current = await AuditService.get_audit(id)
    if not current:
        raise HTTPException(status_code=404, detail="Sürüm geri yüklenemedi.")
    role = _resolve_audit_role(current, current_user.get("uid"), current_user.get("email"))
    user_role = (current_user.get("role") or "user").strip().lower()
    if role not in ["edit"] and user_role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Sürüm geri yükleme yetkiniz yok.")

    restored = await AuditService.restore_audit_version(id, version_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Sürüm geri yüklenemedi.")

    try:
        from app.routers.audit_trail import log_audit_change
        username = current_user.get("email") or current_user.get("uid") or "Bilinmeyen Kullanıcı"
        log_audit_change(id, username, "Sürüm Geri Yüklendi", f"Sürüm geri yüklendi: {version_id}")
    except Exception as log_err:
        print(f"Audit trail loglama hatası: {log_err}")

    return restored

@router.delete("/{id}/versions/{version_id}")
async def delete_audit_version(id: str, version_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await AuditService.get_audit(id)
    if not current:
        raise HTTPException(status_code=404, detail="Sürüm silinemedi veya bulunamadı.")
    role = _resolve_audit_role(current, current_user.get("uid"), current_user.get("email"))
    user_role = (current_user.get("role") or "user").strip().lower()
    if role not in ["edit"] and user_role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Sürüm silme yetkiniz yok.")

    success = await AuditService.delete_audit_version(id, version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sürüm silinemedi veya bulunamadı.")
    return {"status": "success", "message": "Sürüm silindi"}

@router.get("/export/excel")
async def export_excel(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        import asyncio
        audits = await AuditService.get_all_audits(current_user.get("uid"), current_user.get("email"))
        excel_file = await ReportService.generate_excel_report(audits)
        return Response(
            content=excel_file.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Tüm_Denetimler.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/export/word")
async def export_word(id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    import asyncio
    audit = await AuditService.get_audit(id)
    if not audit:
        raise HTTPException(status_code=404, detail="Denetim bulunamadı.")
    role = _resolve_audit_role(audit, current_user.get("uid"), current_user.get("email"))
    user_role = (current_user.get("role") or "user").strip().lower()
    if role == "none" and user_role not in ["admin", "moderator"]:
        raise HTTPException(status_code=403, detail="Bu denetime erişim yetkiniz yok.")
    
    word_file = await ReportService.generate_word_report(audit)
    filename = f"Denetim_Raporu_{audit['title'].replace(' ', '_')}.docx"
    
    return Response(
        content=word_file.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
