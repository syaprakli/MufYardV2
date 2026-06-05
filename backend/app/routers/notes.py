import asyncio
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from app.services.note_service import NoteService
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse
from app.lib.auth import get_current_user
from app.lib.firebase_admin import db

router = APIRouter(tags=["notes"])

@router.get("/", response_model=List[NoteResponse])
async def get_notes(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        return await NoteService.get_notes(current_user.get("uid"), current_user.get("email"))
    except Exception:
        raise HTTPException(status_code=500, detail="Notlar alınırken bir hata oluştu.")



@router.post("/{note_id}/accept")
async def accept_note(note_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await NoteService.accept_note(note_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Not reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Not kabul edildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Not kabul edilirken bir hata oluştu.")

@router.post("/{note_id}/reject")
async def reject_note(note_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await NoteService.reject_note(note_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Not reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Not reddedildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Not reddedilirken bir hata oluştu.")


@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        note.owner_id = current_user.get("uid")
        return await NoteService.create_note(note)
    except Exception:
        raise HTTPException(status_code=500, detail="Not oluşturulurken bir hata oluştu.")

@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note_update: NoteUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    role = (current_user.get("role") or "user").strip().lower()
    uid = current_user.get("uid")
    email = current_user.get("email")
    identity_keys = [value for value in [uid, email] if value]

    doc_ref = db.collection("notes").document(note_id)
    doc = await asyncio.to_thread(doc_ref.get)
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")

    data = doc.to_dict() or {}
    owner_id = data.get("owner_id")
    shared_with = data.get("shared_with", [])
    accepted = data.get("accepted_collaborators", [])

    can_edit = role in ["admin", "moderator"] or (
        owner_id in identity_keys
        or any(identity in shared_with for identity in identity_keys)
        or any(identity in accepted for identity in identity_keys)
    )
    if not can_edit:
        raise HTTPException(status_code=403, detail="Bu notu güncelleme yetkiniz yok.")

    updated = await NoteService.update_note(note_id, note_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")
    return updated

@router.delete("/{note_id}")
async def delete_note(note_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    role = (current_user.get("role") or "user").strip().lower()
    uid = current_user.get("uid")
    email = current_user.get("email")
    identity_keys = [value for value in [uid, email] if value]

    doc_ref = db.collection("notes").document(note_id)
    doc = await asyncio.to_thread(doc_ref.get)
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Not silinemedi.")

    owner_id = (doc.to_dict() or {}).get("owner_id")
    can_delete = role in ["admin", "moderator"] or owner_id in identity_keys
    if not can_delete:
        raise HTTPException(status_code=403, detail="Bu notu silme yetkiniz yok.")

    success = await NoteService.delete_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Not silinemedi.")
    return {"status": "success", "message": "Not silindi."}
