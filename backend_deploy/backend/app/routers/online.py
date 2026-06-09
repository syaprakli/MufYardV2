from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
from app.lib.firebase_admin import db
from app.lib.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(tags=["online"])

class SetOnlineRequest(BaseModel):
    uid: str
    name: str

class RemoveOnlineRequest(BaseModel):
    uid: str

@router.post("/set")
async def set_online(body: SetOnlineRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        import asyncio
        auth_uid = (current_user.get("uid") or "").strip()
        if not auth_uid:
            raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")
        if body.uid and body.uid != auth_uid:
            raise HTTPException(status_code=403, detail="Başka bir kullanıcı için çevrimiçi kaydı oluşturamazsınız.")

        display_name = (body.name or "").strip() or (current_user.get("email") or "kullanici").split("@")[0]
        doc_ref = db.collection("online_users").document(auth_uid)
        await asyncio.to_thread(doc_ref.set, {
            "uid": auth_uid,
            "name": display_name,
            "last_active": datetime.now(timezone.utc).isoformat()
        })
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Kullanıcı çevrimiçi yapılırken bir hata oluştu.")

@router.post("/remove")
async def remove_online(body: RemoveOnlineRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        import asyncio
        auth_uid = (current_user.get("uid") or "").strip()
        if not auth_uid:
            raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")
        if body.uid and body.uid != auth_uid:
            raise HTTPException(status_code=403, detail="Başka bir kullanıcıyı çevrimdışı yapamazsınız.")
        await asyncio.to_thread(db.collection("online_users").document(auth_uid).delete)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Kullanıcı çevrimdışına alınırken bir hata oluştu.")

@router.get("/list")
async def list_online(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[dict]:
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
    except Exception:
        raise HTTPException(status_code=500, detail="Çevrimiçi kullanıcılar listelenirken bir hata oluştu.")
