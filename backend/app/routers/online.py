import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.lib.auth import get_current_user
from app.lib.firebase_admin import db

router = APIRouter(tags=["online"])

# Bir kullanıcı son heartbeat'ten bu yana bu kadar saniye geçmediyse çevrimiçi sayılır.
ONLINE_TTL_SECONDS = 90
# online_users koleksiyonu tüm istemciler için en fazla bu sıklıkta okunur.
# Önbelleksiz her istemci 15 sn'de bir koleksiyonun tamamını okuyordu: okuma maliyeti ~ kullanıcı².
LIST_CACHE_SECONDS = 10

# uid -> {"uid", "name", "last_active"}; tek instance süreç içi önbellek.
_online_cache: Dict[str, Dict[str, Any]] = {}
_cache_loaded_at: Optional[float] = None
_cache_lock = asyncio.Lock()


class SetOnlineRequest(BaseModel):
    uid: str
    name: str


class RemoveOnlineRequest(BaseModel):
    uid: str


def _is_fresh(entry: Dict[str, Any], now: datetime) -> bool:
    raw = entry.get("last_active")
    if not isinstance(raw, str):
        return False
    try:
        last_active = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    return (now - last_active).total_seconds() <= ONLINE_TTL_SECONDS


def _reset_cache() -> None:
    """Testler için."""
    global _cache_loaded_at
    _online_cache.clear()
    _cache_loaded_at = None


async def _refresh_cache_if_stale() -> None:
    global _cache_loaded_at
    if _cache_loaded_at is not None and time.monotonic() - _cache_loaded_at < LIST_CACHE_SECONDS:
        return
    async with _cache_lock:
        # Kilidi beklerken başka bir istek yenilemiş olabilir.
        if _cache_loaded_at is not None and time.monotonic() - _cache_loaded_at < LIST_CACHE_SECONDS:
            return
        docs = await asyncio.to_thread(lambda: list(db.collection("online_users").stream()))
        now = datetime.now(timezone.utc)
        fresh: Dict[str, Dict[str, Any]] = {}
        stale_ids: List[str] = []
        for doc in docs:
            data = doc.to_dict() or {}
            if _is_fresh(data, now):
                fresh[doc.id] = data
            else:
                stale_ids.append(doc.id)

        # Yenileme sırasında gelen heartbeat'ler daha güncelse onları koru.
        for uid, entry in list(_online_cache.items()):
            if uid not in fresh and _is_fresh(entry, now):
                fresh[uid] = entry
        _online_cache.clear()
        _online_cache.update(fresh)
        _cache_loaded_at = time.monotonic()

        if stale_ids:
            async def _delete_stale():
                for stale_id in stale_ids:
                    try:
                        await asyncio.to_thread(db.collection("online_users").document(stale_id).delete)
                    except Exception:
                        pass
            asyncio.create_task(_delete_stale())


@router.post("/set")
async def set_online(body: SetOnlineRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    auth_uid = (current_user.get("uid") or "").strip()
    if not auth_uid:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")
    if body.uid and body.uid != auth_uid:
        raise HTTPException(status_code=403, detail="Başka bir kullanıcı için çevrimiçi kaydı oluşturamazsınız.")
    try:
        display_name = (body.name or "").strip() or (current_user.get("email") or "kullanici").split("@")[0]
        entry = {
            "uid": auth_uid,
            "name": display_name,
            "last_active": datetime.now(timezone.utc).isoformat(),
        }
        await asyncio.to_thread(db.collection("online_users").document(auth_uid).set, entry)
        # Önbelleği geçersiz kılmak yerine güncelle: heartbeat'ler yeniden okuma tetiklemez.
        _online_cache[auth_uid] = entry
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Kullanıcı çevrimiçi yapılırken bir hata oluştu.")


@router.post("/remove")
async def remove_online(body: RemoveOnlineRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    auth_uid = (current_user.get("uid") or "").strip()
    if not auth_uid:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")
    if body.uid and body.uid != auth_uid:
        raise HTTPException(status_code=403, detail="Başka bir kullanıcıyı çevrimdışı yapamazsınız.")
    try:
        await asyncio.to_thread(db.collection("online_users").document(auth_uid).delete)
        _online_cache.pop(auth_uid, None)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Kullanıcı çevrimdışına alınırken bir hata oluştu.")


@router.get("/list")
async def list_online(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[dict]:
    try:
        await _refresh_cache_if_stale()
        now = datetime.now(timezone.utc)
        return [dict(entry) for entry in _online_cache.values() if _is_fresh(entry, now)]
    except Exception:
        raise HTTPException(status_code=500, detail="Çevrimiçi kullanıcılar listelenirken bir hata oluştu.")
