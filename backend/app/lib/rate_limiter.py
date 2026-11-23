import base64
import json
from typing import Optional

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _uid_from_bearer(authorization: Optional[str]) -> Optional[str]:
    """Firebase ID token içinden uid'yi okur (imza doğrulaması auth katmanında yapılır).

    Sahte token ile farklı uid'ler üretmek limiti aşmaya yaramaz: bu istekler
    zaten get_current_user tarafından 401 ile reddedilir ve iş yapmaz.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    parts = authorization.split(" ", 1)[1].strip().split(".")
    if len(parts) != 3:
        return None
    try:
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("ascii")))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    uid = payload.get("user_id") or payload.get("sub")
    if isinstance(uid, str) and 0 < len(uid) <= 128:
        return uid
    return None


def rate_limit_key(request: Request) -> str:
    """Kullanıcı bazlı limit anahtarı; giriş yoksa proxy'nin eklediği gerçek istemci IP'si.

    X-Forwarded-For'un en soldaki değeri istemci tarafından yazılabilir; Railway
    proxy'si gerçek adresi listenin sonuna ekler, bu yüzden en sağdaki değer kullanılır.
    """
    uid = _uid_from_bearer(request.headers.get("authorization"))
    if uid:
        return f"uid:{uid}"

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return f"ip:{hops[-1]}"

    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=rate_limit_key, default_limits=["60/minute"])
