"""Arama uçları.

Önceki `search-reports` ucu tüm kullanıcıların denetimlerini yetki kontrolü olmadan tarıyordu (veri
sızıntısı). Tüm uçlar artık yalnızca kullanıcının erişebildiği denetimlerde arar (emsal_service).
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, Request

from app.lib.auth import get_current_user
from app.lib.rate_limiter import limiter
from app.services import emsal_service

router = APIRouter()


@router.get("/emsal")
@limiter.limit("60/minute")
async def emsal_ara(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    rapor_turu: Optional[str] = Query(None, max_length=100),
    limit: int = Query(30, ge=1, le=100),
    yenile: bool = False,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Eski raporlar ve tenkitler içinde arama (emsal)."""
    if yenile:
        emsal_service.onbellegi_temizle(current_user.get("uid"))
    return await emsal_service.ara(current_user, q, rapor_turu, limit)


@router.get("/search-reports")
@limiter.limit("60/minute")
async def search_reports(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Geriye dönük uyumluluk (Raporlar sayfası)."""
    s = await emsal_service.ara(current_user, q, None, limit)
    return {"results": [{"id": r["audit_id"], "title": r["baslik"], "snippet": r["ozet"], "type": "audit"} for r in s["raporlar"]]}


@router.get("/reports")
@limiter.limit("60/minute")
async def reports(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Geriye dönük uyumluluk (Görevler sayfası; daha önce bu adres yoktu ve arama hep hata veriyordu)."""
    s = await emsal_service.ara(current_user, q, None, 20)
    return [{"id": r["audit_id"], "title": r["baslik"], "snippet": r["ozet"], "type": "audit"} for r in s["raporlar"]]
