"""Tenkit takibi veri katmanı (Firestore 'tenkitler' koleksiyonu)."""
import asyncio
import re
import unicodedata
from typing import Any, Dict, List, Optional

from app.lib.firebase_admin import db
from app.lib.timeutil import utcnow

COLLECTION = "tenkitler"
_TR_MAP = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
                         "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c"})


def birim_anahtari(rapor_turu: Optional[str], birim_adi: Optional[str]) -> str:
    """Aynı birimin (il müdürlüğü, kulüp, yurt…) farklı denetimlerini eşleştirmek için normalleştirilmiş anahtar.

    "Van Gençlik ve Spor İl Müdürlüğü" / "VAN GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ " aynı anahtarı üretir.
    """
    def norm(s: Optional[str]) -> str:
        s = (s or "").translate(_TR_MAP).lower()
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
        s = re.sub(r"[^a-z0-9]+", " ", s)
        return re.sub(r"\s+", " ", s).strip()
    return f"{norm(rapor_turu)}|{norm(birim_adi)}"


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _to_dict(doc) -> Dict[str, Any]:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


class TenkitService:
    @staticmethod
    async def list_by_audit(audit_id: str) -> List[Dict[str, Any]]:
        q = db.collection(COLLECTION).where("audit_id", "==", audit_id).limit(1000)
        docs = await asyncio.to_thread(lambda: list(q.stream()))
        items = [_to_dict(d) for d in docs]
        items.sort(key=lambda x: (x.get("created_at") or ""))
        return items

    @staticmethod
    async def list_by_birim(anahtar: str) -> List[Dict[str, Any]]:
        q = db.collection(COLLECTION).where("birim_anahtari", "==", anahtar).limit(2000)
        docs = await asyncio.to_thread(lambda: list(q.stream()))
        return [_to_dict(d) for d in docs]

    @staticmethod
    async def get(tenkit_id: str) -> Optional[Dict[str, Any]]:
        doc = await asyncio.to_thread(db.collection(COLLECTION).document(tenkit_id).get)
        return _to_dict(doc) if doc.exists else None

    @staticmethod
    async def create(data: Dict[str, Any]) -> Dict[str, Any]:
        now = _now()
        payload = {**data, "created_at": now, "updated_at": now,
                   "gecmis": [{"durum": data.get("durum", "acik"), "tarih": now, "kullanici": data.get("owner_id")}]}
        ref = db.collection(COLLECTION).document()
        await asyncio.to_thread(ref.set, payload)
        return {**payload, "id": ref.id}

    @staticmethod
    async def update(tenkit_id: str, current: Dict[str, Any], changes: Dict[str, Any], uid: str) -> Dict[str, Any]:
        now = _now()
        changes = {**changes, "updated_at": now}
        if "durum" in changes and changes["durum"] != current.get("durum"):
            gecmis = list(current.get("gecmis") or [])
            gecmis.append({"durum": changes["durum"], "tarih": now, "kullanici": uid})
            changes["gecmis"] = gecmis[-50:]
        await asyncio.to_thread(db.collection(COLLECTION).document(tenkit_id).update, changes)
        merged = {**current, **changes}
        merged["id"] = tenkit_id
        return merged

    @staticmethod
    async def delete(tenkit_id: str) -> None:
        await asyncio.to_thread(db.collection(COLLECTION).document(tenkit_id).delete)
