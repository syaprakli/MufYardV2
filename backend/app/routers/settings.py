import asyncio
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.lib.firebase_admin import db
from app.lib.auth import require_founder_admin
from pydantic import BaseModel

router = APIRouter()



class RolesUpdate(BaseModel):
    moderator_permissions: List[str]

@router.get("/roles")
async def get_roles_settings(current_user: Dict[str, Any] = Depends(require_founder_admin)):
    try:
        doc = await asyncio.to_thread(db.collection("system_settings").document("roles").get)
        if doc.exists:
            return doc.to_dict()
        else:
            return {"moderator_permissions": []}
    except Exception:
        raise HTTPException(status_code=500, detail="Rol ayarları alınırken bir hata oluştu.")

@router.patch("/roles")
async def update_roles_settings(update: RolesUpdate, current_user: Dict[str, Any] = Depends(require_founder_admin)):
    try:
        ref = db.collection("system_settings").document("roles")
        await asyncio.to_thread(ref.set, update.model_dump(), merge=True)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Rol ayarları güncellenirken bir hata oluştu.")
