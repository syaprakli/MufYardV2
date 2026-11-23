import asyncio
import logging
import time
from typing import Any, Callable, Dict, Optional

from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as firebase_auth

from app.lib.firebase_admin import db, is_mock


_logger = logging.getLogger(__name__)

_ROLE_CACHE: Dict[str, tuple[str, float]] = {} # uid -> (role, timestamp)
# uid -> (disabled, tokens_valid_after_seconds, fetched_at)
_STATUS_CACHE: Dict[str, tuple[bool, float, float]] = {}
# Yetkisi alınan / devre dışı bırakılan kullanıcının erişimi en geç bu kadar saniye sürer
# (rol değişikliğinde önbellek ayrıca anında temizlenir).
_CACHE_TTL = 60
_STATUS_CACHE_TTL = 60

ACCOUNT_INACTIVE_DETAIL = "Oturumunuz sonlandırılmış veya hesabınız devre dışı bırakılmış. Lütfen tekrar giriş yapın."

# İstemci bu metni tanıyıp kullanıcıyı doğrulama ekranına yönlendirir.
EMAIL_NOT_VERIFIED_DETAIL = "E-posta adresiniz doğrulanmamış. Lütfen e-postanıza gönderilen doğrulama bağlantısına tıklayıp tekrar giriş yapın."


def is_email_verified(decoded_token: Dict[str, Any]) -> bool:
    """Firebase ID token'ındaki email_verified bayrağı. Tüm kullanıcılar için zorunludur (alan adı istisnası yok)."""
    return bool((decoded_token or {}).get("email_verified", False))


def invalidate_user_cache(uid: Optional[str] = None) -> None:
    """Rol veya hesap durumu değiştiğinde çağrılır; uid verilmezse tüm önbellek temizlenir."""
    if uid is None:
        _ROLE_CACHE.clear()
        _STATUS_CACHE.clear()
    else:
        _ROLE_CACHE.pop(uid, None)
        _STATUS_CACHE.pop(uid, None)


def _fetch_account_status(uid: str) -> tuple[bool, float]:
    user = firebase_auth.get_user(uid)
    valid_after_ms = getattr(user, "tokens_valid_after_timestamp", None) or 0
    return bool(user.disabled), valid_after_ms / 1000.0


async def is_account_active(decoded_token: Dict[str, Any]) -> bool:
    """Hesap devre dışıysa veya token oturum iptalinden önce alınmışsa False.

    verify_id_token(check_revoked=True) her istekte Firebase Auth'a gider; bunun yerine durum
    uid başına 60 sn önbelleğe alınır. Auth servisine ulaşılamazsa erişim kesilmez (fail-open).
    """
    if is_mock:
        return True
    uid = (decoded_token or {}).get("uid")
    if not uid:
        return False
    now = time.monotonic()
    cached = _STATUS_CACHE.get(uid)
    if cached and now - cached[2] < _STATUS_CACHE_TTL:
        disabled, valid_after = cached[0], cached[1]
    else:
        try:
            disabled, valid_after = await asyncio.to_thread(_fetch_account_status, uid)
        except firebase_auth.UserNotFoundError:
            return False
        except Exception as e:
            _logger.warning(f"Hesap durumu alınamadı (uid={uid}), erişime izin veriliyor: {e}")
            return True
        _STATUS_CACHE[uid] = (disabled, valid_after, now)
    if disabled:
        return False
    issued_at = decoded_token.get("iat") or 0
    if valid_after and issued_at < valid_after:
        return False
    return True


async def _get_role_for_uid(uid: str) -> str:
    now = time.monotonic()
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
            decoded = None
            for attempt in range(3):
                try:
                    decoded = await asyncio.to_thread(lambda: firebase_auth.verify_id_token(token, clock_skew_seconds=60))
                    break
                except Exception as e:
                    err_str = str(e).lower()
                    if "too early" in err_str or "clock" in err_str or "time" in err_str:
                        if attempt < 2:
                            await asyncio.sleep(1.0)
                            continue
                    raise e

            if not decoded:
                raise HTTPException(status_code=401, detail="Token doğrulanamadı.")

            uid = decoded.get("uid")
            if not uid:
                raise HTTPException(status_code=401, detail="Token içinde kullanıcı kimliği bulunamadı.")

            email = decoded.get("email")
            email_verified = is_email_verified(decoded)
            if not email_verified:
                # Doğrulanmamış hesaplar (ör. başkasının e-postasıyla açılmış) hiçbir veriye erişemez.
                raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED_DETAIL)
            if not await is_account_active(decoded):
                raise HTTPException(status_code=401, detail=ACCOUNT_INACTIVE_DETAIL)
            role = await _get_role_for_uid(uid)
            return {"uid": uid, "email": email, "email_verified": email_verified, "role": role}
        except HTTPException:
            raise
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Token verification failed: {e}", exc_info=True)
            raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız.")

    # Dev fallback: only when backend runs with mock Firebase
    if is_mock and x_user_id:
        role = await _get_role_for_uid(x_user_id)
        return {"uid": x_user_id, "email": x_user_email, "email_verified": False, "role": role}

    raise HTTPException(status_code=401, detail="Bu işlem için giriş yapmanız gerekiyor.")


def require_roles(*allowed_roles: str) -> Callable:
    normalized = {r.strip().lower() for r in allowed_roles if r and r.strip()}

    async def dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = (current_user.get("role") or "user").strip().lower()
        if normalized and user_role not in normalized:
            raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz bulunmuyor.")
        return current_user

    return dependency


async def require_founder_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    from app.config import get_founder_emails

    user_role = (current_user.get("role") or "user").strip().lower()
    user_email = (current_user.get("email") or "").strip().lower()
    email_verified = bool(current_user.get("email_verified", False))
    founder_emails = get_founder_emails()

    if user_role != "admin" or not email_verified or user_email not in founder_emails:
        raise HTTPException(status_code=403, detail="Bu işlem yalnızca doğrulanmış kurucu yönetici hesaplarına açıktır.")
    return current_user

