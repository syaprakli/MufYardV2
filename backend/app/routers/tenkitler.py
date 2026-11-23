"""Tenkit takibi uç noktaları.

Yetki, tenkitin bağlı olduğu denetimden türetilir: denetimi görebilen tenkitlerini görür,
denetimde düzenleme yetkisi olan tenkit ekler/değiştirir/siler.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query

from app.lib.auth import get_current_user
from app.lib.firebase_admin import db
from app.routers.audit import _resolve_audit_role
from app.schemas.tenkit import TenkitAktar, TenkitCreate, TenkitUpdate
from app.services.audit_service import AuditService
from app.services.tenkit_service import TenkitService, birim_anahtari

router = APIRouter(tags=["tenkitler"])
_log = logging.getLogger("app.tenkitler")


def _user_role(user: Dict[str, Any]) -> str:
    return (user.get("role") or "user").strip().lower()


async def _audit_access(audit_id: str, user: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """Denetimi ve kullanıcının erişim düzeyini döner: 'edit', 'comment', 'view' veya 'none'."""
    audit = await AuditService.get_audit(audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="Denetim bulunamadı.")
    access = _resolve_audit_role(audit, user.get("uid"), user.get("email"), user.get("role"))
    if access == "none" and _user_role(user) == "moderator":
        access = "view"
    return audit, access


def _require_read(access: str) -> None:
    if access == "none":
        raise HTTPException(status_code=403, detail="Bu denetimin tenkitlerini görme yetkiniz yok.")


def _require_edit(access: str) -> None:
    if access != "edit":
        raise HTTPException(status_code=403, detail="Bu denetimin tenkitlerini değiştirme yetkiniz yok.")


async def _birim_bilgisi(audit: Dict[str, Any]) -> Dict[str, str]:
    """Denetimin bağlı olduğu görevden birim adı/türü (önceki denetimleri eşleştirmek için)."""
    rapor_turu, birim_adi = "", ""
    task_id = audit.get("task_id")
    if task_id:
        try:
            doc = await asyncio.to_thread(db.collection("tasks").document(task_id).get)
            if doc.exists:
                t = doc.to_dict() or {}
                rapor_turu, birim_adi = t.get("rapor_turu") or "", t.get("rapor_adi") or ""
        except Exception as e:  # görev okunamazsa denetim başlığına düşülür
            _log.warning(f"Tenkit birim bilgisi alınamadı (task={task_id}): {e}")
    birim_adi = birim_adi or audit.get("title") or ""
    return {"rapor_turu": rapor_turu, "birim_adi": birim_adi, "birim_anahtari": birim_anahtari(rapor_turu, birim_adi)}


@router.get("/")
async def list_tenkitler(audit_id: str = Query(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    _, access = await _audit_access(audit_id, current_user)
    _require_read(access)
    return await TenkitService.list_by_audit(audit_id)


@router.get("/onceki")
async def onceki_tenkitler(audit_id: str = Query(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    """Aynı birimin önceki denetimlerinde verilen tenkitler (kullanıcının erişebildiği denetimlerden)."""
    audit, access = await _audit_access(audit_id, current_user)
    _require_read(access)
    birim = await _birim_bilgisi(audit)
    items = await TenkitService.list_by_birim(birim["birim_anahtari"])
    sonuc: List[Dict[str, Any]] = []
    erisim_onbellek: Dict[str, Optional[Dict[str, Any]]] = {}
    for t in items:
        aid = t.get("audit_id")
        if not aid or aid == audit_id:
            continue
        if aid not in erisim_onbellek:
            try:
                other, other_access = await _audit_access(aid, current_user)
                erisim_onbellek[aid] = other if other_access != "none" else None
            except HTTPException:
                erisim_onbellek[aid] = None
        other = erisim_onbellek[aid]
        if other is None:
            continue
        sonuc.append({**t, "denetim_basligi": other.get("title"), "denetim_tarihi": other.get("date") or other.get("created_at")})
    sonuc.sort(key=lambda x: (x.get("denetim_tarihi") or "", x.get("created_at") or ""), reverse=True)
    return {"birim_adi": birim["birim_adi"], "rapor_turu": birim["rapor_turu"], "tenkitler": sonuc}


@router.post("/")
async def create_tenkit(body: TenkitCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    audit, access = await _audit_access(body.audit_id, current_user)
    _require_edit(access)
    birim = await _birim_bilgisi(audit)
    data = {**body.model_dump(), **birim, "task_id": audit.get("task_id"), "owner_id": current_user.get("uid"),
            "birim_cevabi": None, "cevap_tarihi": None, "takip_notu": None}
    return await TenkitService.create(data)


@router.post("/aktar")
async def aktar_tenkitler(body: TenkitAktar, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Toplu ekleme (ör. kontrol listesindeki 'Hayır' maddeleri). Aynı kaynak_ref ikinci kez eklenmez."""
    audit, access = await _audit_access(body.audit_id, current_user)
    _require_edit(access)
    birim = await _birim_bilgisi(audit)
    mevcut = await TenkitService.list_by_audit(body.audit_id)
    mevcut_ref = {t.get("kaynak_ref") for t in mevcut if t.get("kaynak_ref")}
    eklenen = []
    for item in body.items:
        if item.kaynak_ref and item.kaynak_ref in mevcut_ref:
            continue
        data = {**item.model_dump(), **birim, "audit_id": body.audit_id, "task_id": audit.get("task_id"),
                "owner_id": current_user.get("uid"), "durum": "acik",
                "birim_cevabi": None, "cevap_tarihi": None, "takip_notu": None}
        eklenen.append(await TenkitService.create(data))
        if item.kaynak_ref:
            mevcut_ref.add(item.kaynak_ref)
    return {"eklenen": len(eklenen), "atlanan": len(body.items) - len(eklenen), "tenkitler": eklenen}


@router.patch("/{tenkit_id}")
async def update_tenkit(tenkit_id: str, body: TenkitUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await TenkitService.get(tenkit_id)
    if not current:
        raise HTTPException(status_code=404, detail="Tenkit bulunamadı.")
    _, access = await _audit_access(current.get("audit_id"), current_user)
    _require_edit(access)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return current
    return await TenkitService.update(tenkit_id, current, changes, current_user.get("uid"))


@router.delete("/{tenkit_id}")
async def delete_tenkit(tenkit_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    current = await TenkitService.get(tenkit_id)
    if not current:
        raise HTTPException(status_code=404, detail="Tenkit bulunamadı.")
    _, access = await _audit_access(current.get("audit_id"), current_user)
    _require_edit(access)
    await TenkitService.delete(tenkit_id)
    return {"status": "success"}
