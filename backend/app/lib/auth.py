import asyncio
from typing import Any, Callable, Dict, Optional

from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as firebase_auth

from app.lib.firebase_admin import db, is_mock


_ROLE_CACHE: Dict[str, tuple[str, float]] = {} # uid -> (role, timestamp)
_CACHE_TTL = 300 # 5 dakika cache

async def _get_role_for_uid(uid: str) -> str:
    now = asyncio.get_event_loop().time()
    if uid in _ROLE_CACHE:
        role, ts = _ROLE_CACHE[uid]
        if now - ts < _CACHE_TTL:
            return role

    try:
        doc_ref = db.collection("profiles").document(uid)
        doc = await asyncio.to_thread(doc_ref.get)
        if doc.exists:
            profile = doc.to_dict() or {}
            role = (profile.get("role") or "user").strip().lower()
            found_role = role or "user"
            _ROLE_CACHE[uid] = (found_role, now)
            return found_role
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Auth role fetch error (uid={uid}): {e}")
    return "user"


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
) -> Dict[str, Any]:
    # Primary path: Firebase ID token
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Geçersiz kimlik doğrulama başlığı.")

        try:
            decoded = await asyncio.to_thread(firebase_auth.verify_id_token, token)
            uid = decoded.get("uid")
            if not uid:
                raise HTTPException(status_code=401, detail="Token içinde kullanıcı kimliği bulunamadı.")

            email = decoded.get("email")
            role = await _get_role_for_uid(uid)
            return {"uid": uid, "email": email, "role": role}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")

    # Dev fallback: only when backend runs with mock Firebase
    if is_mock and x_user_id:
        role = await _get_role_for_uid(x_user_id)
        return {"uid": x_user_id, "email": x_user_email, "role": role}

    raise HTTPException(status_code=401, detail="Bu işlem için giriş yapmanız gerekiyor.")


def require_roles(*allowed_roles: str) -> Callable:
    normalized = {r.strip().lower() for r in allowed_roles if r and r.strip()}

    async def dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = (current_user.get("role") or "user").strip().lower()
        if normalized and user_role not in normalized:
            raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz bulunmuyor.")
        return current_user

    return dependency
