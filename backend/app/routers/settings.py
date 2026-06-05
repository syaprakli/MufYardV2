from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.lib.firebase_admin import db
from app.lib.auth import get_current_user
from app.services.profile_service import ProfileService
from pydantic import BaseModel

router = APIRouter()


def _ensure_founder(current_user: Dict[str, Any]) -> None:
    caller_email = (current_user.get("email") or "").strip().lower()
    founder_emails = {email.strip().lower() for email in ProfileService.FOUNDER_EMAILS}
    if caller_email not in founder_emails:
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca kurucu hesaplara açıktır.")

class RolesUpdate(BaseModel):
    moderator_permissions: List[str]

@router.get("/roles")
async def get_roles_settings(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        _ensure_founder(current_user)
        doc = db.collection("system_settings").document("roles").get()
        if doc.exists:
            return doc.to_dict()
        else:
            return {"moderator_permissions": []}
    except Exception:
        raise HTTPException(status_code=500, detail="Rol ayarları alınırken bir hata oluştu.")

@router.patch("/roles")
async def update_roles_settings(update: RolesUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        _ensure_founder(current_user)
        ref = db.collection("system_settings").document("roles")
        ref.set(update.dict(), merge=True)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Rol ayarları güncellenirken bir hata oluştu.")
