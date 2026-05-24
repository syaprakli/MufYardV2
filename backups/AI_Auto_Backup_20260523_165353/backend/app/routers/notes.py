from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.services.note_service import NoteService
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse

router = APIRouter(tags=["notes"])

@router.get("/", response_model=List[NoteResponse])
async def get_notes(uid: str, email: Optional[str] = None):
    try:
        return await NoteService.get_notes(uid, email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/{note_id}/accept")
async def accept_note(note_id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await NoteService.accept_note(note_id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Not reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Not kabul edildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{note_id}/reject")
async def reject_note(note_id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await NoteService.reject_note(note_id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Not reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Not reddedildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=NoteResponse)
async def create_note(note: NoteCreate):
    try:
        return await NoteService.create_note(note)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, note_update: NoteUpdate):
    updated = await NoteService.update_note(note_id, note_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")
    return updated

@router.delete("/{note_id}")
async def delete_note(note_id: str):
    success = await NoteService.delete_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Not silinemedi.")
    return {"status": "success", "message": "Not silindi."}
