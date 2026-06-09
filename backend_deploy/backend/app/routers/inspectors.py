from fastapi import APIRouter, HTTPException, File, UploadFile, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
from app.services.inspector_service import InspectorService
from app.schemas.inspector import InspectorCreate, InspectorResponse
from app.lib.auth import get_current_user, require_roles
from app.config import BASE_DIR

router = APIRouter(tags=["inspectors"])

@router.post("/sync-from-excel")
async def sync_inspectors(current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator"))):
    """backend/rehber.xlsx dosyasından ünvan bazlı senkronizasyon tetikler."""
    try:
        result = await InspectorService.sync_from_excel()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-from-contacts")
async def sync_inspectors_from_contacts(current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator"))):
    """Kurumsal rehberdeki hedef unvanları müfettiş listesine senkronize eder."""
    try:
        result = await InspectorService.sync_from_contacts()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-and-sync")
async def upload_and_sync_inspectors(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    """Yeni bir Excel yükler ve müfettiş listesini otomatik senkronize eder."""
    import os
    from pathlib import Path
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları (.xlsx, .xls) kabul edilir.")

    # Dosya adı güvenliği: sadece sabit dosya adı kullanılacak
    try:
        from app.config import DATA_DIR
        file_path = os.path.join(DATA_DIR, "rehber.xlsx")

        # Path traversal koruması
        if not Path(file_path).resolve().parent == Path(DATA_DIR).resolve():
            raise HTTPException(status_code=400, detail="Geçersiz dosya yolu.")

        # Save file to disk
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Trigger inspector sync
        result = await InspectorService.sync_from_excel()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[InspectorResponse])
async def get_inspectors(current_user: Dict[str, Any] = Depends(get_current_user)):
    return await InspectorService.get_inspectors()

@router.post("/", response_model=InspectorResponse)
async def add_inspector(
    inspector: InspectorCreate,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    return await InspectorService.add_inspector(inspector)

@router.delete("/{inspector_id}")
async def delete_inspector(
    inspector_id: str,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    if await InspectorService.delete_inspector(inspector_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Müfettiş bulunamadı.")

@router.put("/{inspector_id}", response_model=InspectorResponse)
async def update_inspector(
    inspector_id: str,
    inspector: InspectorCreate,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    updated = await InspectorService.update_inspector(inspector_id, inspector)
    if updated: return updated
    raise HTTPException(status_code=404, detail="Güncelleme başarısız.")

@router.post("/bulk")
async def add_inspectors_bulk(
    inspectors: List[InspectorCreate],
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    count = await InspectorService.add_inspectors_bulk(inspectors)
    return {"status": "success", "count": count}

class LinkProfileRequest(BaseModel):
    profile_uid: str

@router.patch("/{inspector_id}/link")
async def link_inspector_to_profile(
    inspector_id: str,
    body: LinkProfileRequest,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    """Admin tarafından bir müfettişi sisteme kayıtlı kullanıcıyla manuel eşleştirir."""
    import asyncio
    from app.lib.firebase_admin import db
    try:
        update_data = {"uid": body.profile_uid, "force_unlinked": not body.profile_uid}
        await asyncio.to_thread(
            db.collection('inspectors').document(inspector_id).update,
            update_data
        )
        doc = await asyncio.to_thread(db.collection('inspectors').document(inspector_id).get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Müfettiş bulunamadı.")
        d = doc.to_dict()
        d['id'] = doc.id
        return d
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
