from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.lib.firebase_admin import db
from pydantic import BaseModel

router = APIRouter()

class RolesUpdate(BaseModel):
    moderator_permissions: List[str]

@router.get("/roles")
async def get_roles_settings():
    try:
        doc = db.collection("system_settings").document("roles").get()
        if doc.exists:
            return doc.to_dict()
        else:
            return {"moderator_permissions": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/roles")
async def update_roles_settings(update: RolesUpdate):
    try:
        ref = db.collection("system_settings").document("roles")
        ref.set(update.dict(), merge=True)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
