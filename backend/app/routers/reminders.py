from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.services.reminder_service import ReminderService
from app.schemas.reminder import ReminderCreate, ReminderUpdate, ReminderResponse
from app.lib.auth import get_current_user

router = APIRouter(tags=["reminders"])

@router.get("/", response_model=List[ReminderResponse])
async def get_reminders(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Kullanıcı kimliği doğrulanamadı.")
    try:
        return await ReminderService.get_reminders(user_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"get_reminders error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Hatırlatıcılar alınırken hata oluştu.")

@router.post("/", response_model=ReminderResponse)
async def create_reminder(reminder: ReminderCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Kullanıcı kimliği doğrulanamadı.")
    try:
        return await ReminderService.create_reminder(reminder, user_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"create_reminder error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Hatırlatıcı oluşturulurken hata oluştu.")

@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(reminder_id: str, reminder_update: ReminderUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Kullanıcı kimliği doğrulanamadı.")
    try:
        updated = await ReminderService.update_reminder(reminder_id, reminder_update, user_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Hatırlatıcı bulunamadı veya düzenleme yetkiniz yok.")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"update_reminder error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Hatırlatıcı güncellenirken hata oluştu.")

@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    user_id = current_user.get("uid")
    if not user_id:
        raise HTTPException(status_code=401, detail="Kullanıcı kimliği doğrulanamadı.")
    try:
        success = await ReminderService.delete_reminder(reminder_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Hatırlatıcı bulunamadı veya silme yetkiniz yok.")
        return {"status": "success", "message": "Hatırlatıcı silindi."}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"delete_reminder error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Hatırlatıcı silinirken hata oluştu.")
