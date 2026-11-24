"""İfade tutanakları (inceleme, soruşturma, ön inceleme, araştırma görevleri).

Yetki göreve bağlıdır: görevin sahibi, atanan, paylaşılan ve kabul eden müfettişler ile yönetici
düzenler; moderatör yalnızca görür. İfadeler kişisel veri içerdiği için moderatöre düzenleme verilmez
ve içerik günlüğe (log) yazılmaz.
"""
import asyncio
import json
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from app.lib.auth import get_current_user
from app.lib.firebase_admin import db
from app.lib.timeutil import utcnow
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


async def _gorev_erisimi(task_id: Optional[str], user: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Görev ve kullanıcının erişimi: 'edit', 'view' veya 'none'."""
    if not task_id:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")
    doc = await asyncio.to_thread(db.collection("tasks").document(task_id).get)
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")
    task = doc.to_dict() or {}
    kimlikler = [v for v in (user.get("uid"), user.get("email")) if v]
    rol = (user.get("role") or "user").strip().lower()
    if task.get("owner_id") in kimlikler or rol == "admin":
        return task, "edit"
    for alan in ("assigned_to", "shared_with", "accepted_collaborators"):
        if any(k in (task.get(alan) or []) for k in kimlikler):
            return task, "edit"
    if rol == "moderator":
        return task, "view"
    return task, "none"


def _okuma(access: str) -> None:
    if access == "none":
        raise HTTPException(status_code=403, detail="Bu görevin tutanaklarını görme yetkiniz yok.")


def _duzenleme(access: str) -> None:
    if access != "edit":
        raise HTTPException(status_code=403, detail="Bu görevin tutanaklarını değiştirme yetkiniz yok.")


async def _get(tutanak_id: str) -> Optional[Dict[str, Any]]:
    doc = await asyncio.to_thread(db.collection(COLLECTION).document(tutanak_id).get)
    return _to_dict(doc) if doc.exists else None


@router.get("/")
async def list_tutanaklar(task_id: str = Query(..., max_length=200), current_user: Dict[str, Any] = Depends(get_current_user)):
    _, access = await _gorev_erisimi(task_id, current_user)
    _okuma(access)
    q = db.collection(COLLECTION).where("task_id", "==", task_id).limit(500)
    docs = await asyncio.to_thread(lambda: list(q.stream()))
    items: List[Dict[str, Any]] = [_to_dict(d) for d in docs]
    items.sort(key=lambda x: x.get("created_at") or "")
    return items


@router.post("/")
async def create_tutanak(body: TutanakCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    _, access = await _gorev_erisimi(body.task_id, current_user)
    _duzenleme(access)
    now = _now()
    data = {
        **body.model_dump(),
        "kisiler": [k.model_dump() for k in (body.kisiler or [])],
        "sorular": [s.model_dump() for s in (body.sorular or [])],
        "tamamlandi": bool(body.tamamlandi),
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
    _, access = await _gorev_erisimi(current.get("task_id"), current_user)
    _duzenleme(access)
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
    _, access = await _gorev_erisimi(current.get("task_id"), current_user)
    _duzenleme(access)
    await asyncio.to_thread(db.collection(COLLECTION).document(tutanak_id).delete)
    return {"status": "success"}
