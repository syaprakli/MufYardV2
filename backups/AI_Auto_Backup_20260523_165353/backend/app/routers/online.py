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
        import asyncio
        doc_ref = db.collection("online_users").document(body.uid)
        await asyncio.to_thread(doc_ref.set, {
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
        import asyncio
        await asyncio.to_thread(db.collection("online_users").document(body.uid).delete)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_online() -> List[dict]:
    try:
        import asyncio
        docs = await asyncio.to_thread(db.collection("online_users").stream)
        now = datetime.now(timezone.utc)
        fresh_users: List[dict] = []
        stale_ids: List[str] = []

        for doc in docs:
            data = doc.to_dict() or {}
            last_active_raw = data.get("last_active")
            is_fresh = False

            if isinstance(last_active_raw, str):
                try:
                    last_active = datetime.fromisoformat(last_active_raw.replace("Z", "+00:00"))
                    age_seconds = (now - last_active).total_seconds()
                    is_fresh = age_seconds <= 90
                except Exception:
                    is_fresh = False

            if is_fresh:
                fresh_users.append(data)
            else:
                stale_ids.append(doc.id)

        # Stale kayıtları toplu sil (event loop'u bloke etme)
        async def _delete_stale():
            for stale_id in stale_ids:
                await asyncio.to_thread(db.collection("online_users").document(stale_id).delete)
        if stale_ids:
            asyncio.create_task(_delete_stale())

        return fresh_users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
