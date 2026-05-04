from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.lib.firebase_admin import db
from datetime import datetime, timezone

router = APIRouter(tags=["online"])

class SetOnlineRequest(BaseModel):
    uid: str
    name: str

class RemoveOnlineRequest(BaseModel):
    uid: str

@router.post("/set")
async def set_online(body: SetOnlineRequest):
    try:
        doc_ref = db.collection("online_users").document(body.uid)
        doc_ref.set({
            "uid": body.uid,
            "name": body.name,
            "last_active": datetime.now(timezone.utc).isoformat()
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/remove")
async def remove_online(body: RemoveOnlineRequest):
    try:
        db.collection("online_users").document(body.uid).delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_online() -> List[dict]:
    try:
        docs = db.collection("online_users").stream()
        users = [doc.to_dict() for doc in docs]
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
