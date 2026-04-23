from fastapi import APIRouter, Response, HTTPException
from app.services.report_service import ReportService
from app.services.audit_service import AuditService
from app.schemas.audit import AuditCreate, AuditUpdate, AuditResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(tags=["audit"])

class ReportRequest(BaseModel):
    location: str
    subject: str
    introduction: Optional[str] = None
    findings: List[str]
    conclusion: Optional[str] = None
    inspector: str

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
async def update_audit(id: str, audit: AuditUpdate):
    updated = await AuditService.update_audit(id, audit)
    if not updated:
        raise HTTPException(status_code=404, detail="Denetim güncellenemedi.")
    return updated

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
async def restore_audit_version(id: str, version_id: str):
    restored = await AuditService.restore_audit_version(id, version_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Sürüm geri yüklenemedi.")
    return restored

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
