from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import List, Optional, Dict, Any
from app.services.contact_service import ContactService
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse

router = APIRouter(tags=["contacts"])

@router.get("/", response_model=List[ContactResponse])
async def get_contacts(
    category: str = Query("corporate", description="Rehber kategorisi: 'corporate' veya 'personal'"),
    user_id: Optional[str] = Query(None, description="Kişisel rehber için kullanıcı ID")
):
    try:
        return await ContactService.get_contacts(category, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-corporate")
async def sync_corporate():
    """backend/rehber.xlsx dosyasından manuel senkronizasyon tetikler."""
    try:
        result = await ContactService.sync_from_rdb_rehber_v6()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-and-sync")
async def upload_and_sync(file: UploadFile = File(...)):
    """Yeni bir Excel yükler ve otomatik senkronize eder."""
    import os
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları (.xlsx, .xls) kabul edilir.")
        
    try:
        # Path to root directory (backend/)
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        file_path = os.path.join(base_dir, "rehber.xlsx")
        
        # Save file to disk
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Trigger sync
        result = await ContactService.sync_from_rdb_rehber_v6(file_path)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=ContactResponse)
async def create_contact(contact: ContactCreate):
    try:
        return await ContactService.create_contact(contact)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{contact_id}/share")
async def share_contact(contact_id: str, user_id: str = Query(..., description="Paylaşan kullanıcının ID'si")):
    try:
        success = await ContactService.share_contact(contact_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        return {"status": "success", "message": "Kişi kurumsal rehberde paylaşıldı."}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: str, contact_update: ContactUpdate, user_id: str = Query(..., description="Güncelleyen kullanıcının ID'si")):
    try:
        updated = await ContactService.update_contact(contact_id, contact_update, user_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        return updated
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, user_id: str = Query(..., description="Silen kullanıcının ID'si")):
    try:
        success = await ContactService.delete_contact(contact_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        return {"status": "success", "message": "Kişi rehberden silindi."}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
