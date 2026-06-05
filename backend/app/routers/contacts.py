import asyncio
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Depends
from typing import List, Optional, Dict, Any
from app.services.contact_service import ContactService
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse
from app.config import BASE_DIR
from app.lib.auth import get_current_user
from app.lib.firebase_admin import db

router = APIRouter(tags=["contacts"])

@router.get("/", response_model=List[ContactResponse])
async def get_contacts(
    category: str = Query(..., description="'corporate' veya 'personal'"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        return await ContactService.get_contacts(category, current_user.get("uid"), current_user.get("email"))
    except Exception:
        raise HTTPException(status_code=500, detail="Kişiler alınırken bir hata oluştu.")

@router.post("/sync-corporate")
async def sync_corporate(current_user: Dict[str, Any] = Depends(get_current_user)):
    """backend/rehber.xlsx dosyasından manuel senkronizasyon tetikler."""
    try:
        role = (current_user.get("role") or "user").strip().lower()
        if role not in ["admin", "moderator"]:
            raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
        result = await ContactService.sync_from_rdb_rehber_v6()
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail="Kurumsal rehber senkronize edilirken bir hata oluştu.")
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Kurumsal rehber senkronize edilirken bir hata oluştu.")

@router.post("/upload-and-sync")
async def upload_and_sync(file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    """Yeni bir Excel yükler ve otomatik senkronize eder."""
    import os
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları (.xlsx, .xls) kabul edilir.")
        
    try:
        role = (current_user.get("role") or "user").strip().lower()
        if role not in ["admin", "moderator"]:
            raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
        # Path to data directory
        from app.config import DATA_DIR
        file_path = os.path.join(DATA_DIR, "rehber.xlsx")
        # Save file to disk
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        # Trigger sync
        result = await ContactService.sync_from_rdb_rehber_v6(file_path)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail="Excel dosyası senkronize edilirken bir hata oluştu.")
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Excel dosyası senkronize edilirken bir hata oluştu.")

@router.post("/", response_model=ContactResponse)
async def create_contact(contact: ContactCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        contact.owner_id = current_user.get("uid")
        return await ContactService.create_contact(contact)
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi eklenirken bir hata oluştu.")

@router.post("/{contact_id}/share")
async def share_contact(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await ContactService.share_contact(contact_id, current_user.get("uid"))
        if not success:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı")
        return {"status": "success", "message": "Kişi kurumsal rehberde paylaşıldı"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi paylaşılırken bir hata oluştu.")

@router.post("/{contact_id}/accept")
async def accept_contact(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await ContactService.accept_contact(contact_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Kişi reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Kişi eklendi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi eklenirken bir hata oluştu.")

@router.post("/{contact_id}/reject")
async def reject_contact(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await ContactService.reject_contact(contact_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Kişi reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Kişi reddedildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi reddedilirken bir hata oluştu.")

@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: str, contact_update: ContactUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        role = (current_user.get("role") or "user").strip().lower()
        uid = current_user.get("uid")
        doc = await asyncio.to_thread(db.collection("contacts").document(contact_id).get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        owner_id = (doc.to_dict() or {}).get("owner_id")
        if role not in ["admin", "moderator"] and owner_id != uid:
            raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")

        updated = await ContactService.update_contact(contact_id, contact_update, uid)
        if not updated:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        return updated
    except PermissionError:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi güncellenirken bir hata oluştu.")

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await ContactService.delete_contact(contact_id, current_user.get("uid"))
        if not success:
            raise HTTPException(status_code=404, detail="Kişi bulunamadı.")
        return {"status": "success", "message": "Kişi rehberden silindi."}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok.")
    except Exception:
        raise HTTPException(status_code=500, detail="Kişi silinirken bir hata oluştu.")
