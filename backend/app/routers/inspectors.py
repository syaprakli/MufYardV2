from fastapi import APIRouter, HTTPException, File, UploadFile
from typing import List, Dict, Any
from app.services.inspector_service import InspectorService
from app.schemas.inspector import InspectorCreate, InspectorResponse

router = APIRouter(tags=["inspectors"])

@router.post("/sync-from-excel")
async def sync_inspectors():
    """backend/rehber.xlsx dosyasından ünvan bazlı senkronizasyon tetikler."""
    try:
        result = await InspectorService.sync_from_excel()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-from-contacts")
async def sync_inspectors_from_contacts():
    """Kurumsal rehberdeki hedef unvanları müfettiş listesine senkronize eder."""
    try:
        result = await InspectorService.sync_from_contacts()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-and-sync")
async def upload_and_sync_inspectors(file: UploadFile = File(...)):
    """Yeni bir Excel yükler ve müfettiş listesini otomatik senkronize eder."""
    import os
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları (.xlsx, .xls) kabul edilir.")
        
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        file_path = os.path.join(base_dir, "rehber.xlsx")
        
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
async def get_inspectors():
    return await InspectorService.get_inspectors()

@router.post("/", response_model=InspectorResponse)
async def add_inspector(inspector: InspectorCreate):
    return await InspectorService.add_inspector(inspector)

@router.delete("/{inspector_id}")
async def delete_inspector(inspector_id: str):
    if await InspectorService.delete_inspector(inspector_id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Müfettiş bulunamadı.")

@router.put("/{inspector_id}", response_model=InspectorResponse)
async def update_inspector(inspector_id: str, inspector: InspectorCreate):
    updated = await InspectorService.update_inspector(inspector_id, inspector)
    if updated: return updated
    raise HTTPException(status_code=404, detail="Güncelleme başarısız.")

@router.post("/bulk")
async def add_inspectors_bulk(inspectors: List[InspectorCreate]):
    count = await InspectorService.add_inspectors_bulk(inspectors)
    return {"status": "success", "count": count}
