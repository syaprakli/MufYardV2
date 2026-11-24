"""İfade / tespit / görüşme tutanakları.

Yetki, bağlı denetimden türetilir (tenkitlerle aynı kural): denetimi görebilen okur,
düzenleme yetkisi olan ekler/değiştirir/siler. Tutanak içeriği kişisel veri içerebileceği
için günlüğe (log) yazılmaz.
"""
import asyncio
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.lib.auth import get_current_user
from app.lib.firebase_admin import db
from app.lib.timeutil import utcnow
from app.routers.tenkitler import _audit_access, _require_edit, _require_read
from app.schemas.tutanak import TutanakCreate, TutanakUpdate

router = APIRouter(tags=["tutanaklar"])
COLLECTION = "tutanaklar"
MAX_BELGE_BAYT = 900_000  # Firestore belge sınırı 1 MiB; pay bırakılır


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _to_dict(doc) -> Dict[str, Any]:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


def _boyut_kontrol(data: Dict[str, Any]) -> None:
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > MAX_BELGE_BAYT:
        raise HTTPException(status_code=413, detail="Tutanak çok uzun. Lütfen ikiye bölün.")


async def _get(tutanak_id: str) -> Optional[Dict[str, Any]]:
    doc = await asyncio.to_thread(db.collection(COLLECTION).document(tutanak_id).get)
    return _to_dict(doc) if doc.exists else None


@router.get("/")
async def list_tutanaklar(audit_id: str = Query(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    _, access = await _audit_access(audit_id, current_user)
    _require_read(access)
    q = db.collection(COLLECTION).where("audit_id", "==", audit_id).limit(500)
    docs = await asyncio.to_thread(lambda: list(q.stream()))
    items: List[Dict[str, Any]] = [_to_dict(d) for d in docs]
    items.sort(key=lambda x: x.get("created_at") or "")
    return items


@router.post("/")
async def create_tutanak(body: TutanakCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    audit, access = await _audit_access(body.audit_id, current_user)
    _require_edit(access)
    now = _now()
    data = {
        **body.model_dump(),
        "kisiler": [k.model_dump() for k in (body.kisiler or [])],
        "sorular": [s.model_dump() for s in (body.sorular or [])],
        "tamamlandi": bool(body.tamamlandi),
        "task_id": audit.get("task_id"),
        "owner_id": current_user.get("uid"),
        "created_at": now,
        "updated_at": now,
    }
    _boyut_kontrol(data)
    ref = db.collection(COLLECTION).document()
    await asyncio.to_thread(ref.set, data)
    return {**data, "id": ref.id}


@router.patch("/{tutanak_id}")
async def update_tutanak(tutanak_id: str, body: TutanakUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await _get(tutanak_id)
    if not current:
        raise HTTPException(status_code=404, detail="Tutanak bulunamadı.")
    _, access = await _audit_access(current.get("audit_id"), current_user)
    _require_edit(access)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return current
    changes["updated_at"] = _now()
    merged = {**current, **changes}
    merged.pop("id", None)
    _boyut_kontrol(merged)
    await asyncio.to_thread(db.collection(COLLECTION).document(tutanak_id).update, changes)
    return {**merged, "id": tutanak_id}


@router.delete("/{tutanak_id}")
async def delete_tutanak(tutanak_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await _get(tutanak_id)
    if not current:
        raise HTTPException(status_code=404, detail="Tutanak bulunamadı.")
    _, access = await _audit_access(current.get("audit_id"), current_user)
    _require_edit(access)
    await asyncio.to_thread(db.collection(COLLECTION).document(tutanak_id).delete)
    return {"status": "success"}
