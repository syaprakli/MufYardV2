from fastapi import APIRouter, Response, HTTPException
from app.services.report_service import ReportService
from app.services.audit_service import AuditService
from app.schemas.audit import AuditCreate, AuditUpdate, AuditResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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
async def list_audits(user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        return await AuditService.get_all_audits(user_id, user_email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=AuditResponse)
async def create_audit(audit: AuditCreate):
    try:
        return await AuditService.create_audit(audit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}", response_model=AuditResponse)
async def get_audit(id: str):
    audit = await AuditService.get_audit(id)
    if not audit:
        raise HTTPException(status_code=404, detail="Denetim bulunamadı.")
    return audit

@router.patch("/{id}", response_model=AuditResponse)
async def update_audit(
    id: str,
    audit: AuditUpdate,
    force_version: Optional[bool] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None
):
    if user_id or user_email:
        current = await AuditService.get_audit(id)
        if not current:
            raise HTTPException(status_code=404, detail="Denetim güncellenemedi.")

        role = _resolve_audit_role(current, user_id, user_email)
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
        username = user_email or user_id or "Bilinmeyen Kullanıcı"
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
async def accept_audit(id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await AuditService.accept_audit(id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Denetim reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Denetim kabul edildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/reject")
async def reject_audit(id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await AuditService.reject_audit(id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Denetim reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Denetim reddedildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}")
async def delete_audit(id: str):
    success = await AuditService.delete_audit(id)
    if not success:
        raise HTTPException(status_code=404, detail="Denetim silinemedi veya bulunamadı.")
    return {"status": "success", "message": "Denetim silindi"}

@router.get("/{id}/versions")
async def get_audit_versions(id: str):
    try:
        return await AuditService.get_audit_versions(id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/restore/{version_id}", response_model=AuditResponse)
async def restore_audit_version(
    id: str, 
    version_id: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None
):
    restored = await AuditService.restore_audit_version(id, version_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Sürüm geri yüklenemedi.")

    try:
        from app.routers.audit_trail import log_audit_change
        username = user_email or user_id or "Bilinmeyen Kullanıcı"
        log_audit_change(id, username, "Sürüm Geri Yüklendi", f"Sürüm geri yüklendi: {version_id}")
    except Exception as log_err:
        print(f"Audit trail loglama hatası: {log_err}")

    return restored

@router.delete("/{id}/versions/{version_id}")
async def delete_audit_version(id: str, version_id: str):
    success = await AuditService.delete_audit_version(id, version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sürüm silinemedi veya bulunamadı.")
    return {"status": "success", "message": "Sürüm silindi"}

@router.get("/export/excel")
async def export_excel():
    try:
        import asyncio
        audits = await AuditService.get_all_audits()
        excel_file = await ReportService.generate_excel_report(audits)
        return Response(
            content=excel_file.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Tüm_Denetimler.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/export/word")
async def export_word(id: str):
    import asyncio
    audit = await AuditService.get_audit(id)
    if not audit:
        raise HTTPException(status_code=404, detail="Denetim bulunamadı.")
    
    word_file = await ReportService.generate_word_report(audit)
    filename = f"Denetim_Raporu_{audit['title'].replace(' ', '_')}.docx"
    
    return Response(
        content=word_file.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
