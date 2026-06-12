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

    note_data = doc.to_dict() or {}
    owner_id = note_data.get("owner_id")
    
    admin_id = "sefa.yaprakli@gsb.gov.tr"
    can_delete = role in ["admin", "moderator"] or any(identity in [owner_id, admin_id, "admin"] for identity in identity_keys)
    
    if can_delete:
        success = await NoteService.delete_note(note_id)
        if not success:
            raise HTTPException(status_code=404, detail="Not silinemedi.")
        return {"status": "success", "message": "Not silindi."}
    else:
        # Collaborator leave
        shared_with = note_data.get("shared_with", []) or []
        accepted = note_data.get("accepted_collaborators", []) or []
        pending = note_data.get("pending_collaborators", []) or []

        is_collaborator = (
            any(identity in shared_with for identity in identity_keys) or
            any(identity in accepted for identity in identity_keys) or
            any(identity in pending for identity in identity_keys)
        )

        if is_collaborator:
            new_shared = [identity for identity in shared_with if identity not in identity_keys]
            new_accepted = [identity for identity in accepted if identity not in identity_keys]
            new_pending = [identity for identity in pending if identity not in identity_keys]

            await asyncio.to_thread(doc_ref.update, {
                "shared_with": new_shared,
                "accepted_collaborators": new_accepted,
                "pending_collaborators": new_pending
            })
            return {"status": "success", "message": "Not paylaşımlarınızdan kaldırıldı."}
        else:
            raise HTTPException(status_code=403, detail="Bu notu silme veya terk etme yetkiniz yok.")
