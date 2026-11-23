import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional

from app.config import get_settings

_EPHEMERAL_FALLBACK_KEY = secrets.token_bytes(32)


def get_signing_secret() -> bytes:
    """Returns an HMAC signing key from environment settings or a process-local random key."""
    settings = get_settings()
    raw = (
        os.getenv("APP_SIGNING_SECRET")
        or os.getenv("SECRET_KEY")
        or settings.GOOGLE_CLIENT_SECRET
        or ""
    ).strip()
    if raw:
        return hashlib.sha256(raw.encode("utf-8")).digest()
    return _EPHEMERAL_FALLBACK_KEY


def create_signed_token(payload: Dict[str, Any], ttl_seconds: int = 3600) -> str:
    """Creates a URL-safe HMAC-SHA256 signed token with expiration."""
    body = dict(payload)
    body["exp"] = int(time.time()) + max(1, int(ttl_seconds))
    raw_json = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(raw_json).decode("ascii").rstrip("=")
    sig = hmac.new(get_signing_secret(), b64_payload.encode("ascii"), hashlib.sha256).digest()
    b64_sig = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    return f"{b64_payload}.{b64_sig}"


def verify_signed_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies an HMAC-SHA256 signed token and returns its payload if valid and unexpired."""
    if not token or "." not in token:
        return None
    try:
        b64_payload, b64_sig = token.split(".", 1)
        expected_sig = hmac.new(
            get_signing_secret(),
            b64_payload.encode("ascii"),
            hashlib.sha256,
        ).digest()
        expected_b64_sig = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")
        if not hmac.compare_digest(b64_sig, expected_b64_sig):
            return None

        padded = b64_payload + "=" * (-len(b64_payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        if not isinstance(data, dict):
            return None
        exp = int(data.get("exp", 0))
        if exp < int(time.time()):
            return None
        return data
    except Exception:
        return None
