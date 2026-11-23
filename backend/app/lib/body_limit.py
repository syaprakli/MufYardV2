"""İstek gövdesi boyut sınırı (ASGI middleware).

Endpoint'ler yüklemeyi belleğe okuduktan sonra boyut kontrolü yapıyordu; bazılarında hiç sınır yoktu.
Bu middleware gövdeyi okunurken sayar: Content-Length sınırı aşıyorsa istek hiç okunmadan,
başlık yoksa / yanlışsa sınır aşıldığı anda 413 ile reddedilir.
"""
import json
from typing import Iterable, Tuple

DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024  # en büyük meşru yükleme: ses (20MB) + multipart payı
# (yol öneki, sınır) — ilk eşleşen kullanılır.
PATH_LIMITS: Tuple[Tuple[str, int], ...] = (
    ("/api/backup/import", 100 * 1024 * 1024),
    ("/api/legislation/upload", 50 * 1024 * 1024),  # kanun derlemesi PDF'leri büyük olabilir
)

_DETAIL = "İstek çok büyük. Yüklenebilecek en büyük dosya boyutu aşıldı."


class _BodyTooLarge(Exception):
    pass


def _limit_for(path: str, default: int, path_limits: Iterable[Tuple[str, int]]) -> int:
    for prefix, limit in path_limits:
        if path.startswith(prefix):
            return limit
    return default


class BodySizeLimitMiddleware:
    def __init__(self, app, max_body_bytes: int = DEFAULT_MAX_BODY_BYTES, path_limits=PATH_LIMITS):
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.path_limits = path_limits

    async def _send_413(self, send):
        body = json.dumps({"detail": _DETAIL}, ensure_ascii=False).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json; charset=utf-8"),
                        (b"content-length", str(len(body)).encode()),
                        (b"connection", b"close")],
        })
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = _limit_for(scope.get("path", ""), self.max_body_bytes, self.path_limits)

        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    if int(value) > limit:
                        await self._send_413(send)
                        return
                except ValueError:
                    pass
                break

        received = 0
        exceeded = False
        response_started = False

        async def limited_receive():
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    exceeded = True
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal response_started
            if exceeded:
                # FastAPI gövde ayrıştırma hatasını 400'e çevirebilir; yerine 413 gönder, uygulamanın yanıtını yut.
                if message["type"] == "http.response.start" and not response_started:
                    response_started = True
                    await self._send_413(send)
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._send_413(send)
