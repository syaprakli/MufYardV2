"""Log satırlarındaki kimlik bilgilerini gizler.

WebSocket'ler Firebase ID token'ını URL'de (?token=...) taşır ve uvicorn bağlantı satırını
sorgu parametreleriyle loglar; imzalı indirme bağlantıları da ?dl_token=... içerir.
Bu filtre uvicorn loglarında bu değerleri <redacted> ile değiştirir.
"""
import logging
import re

_SECRET_PARAM = re.compile(r"((?:^|[?&])(?:token|dl_token|id_token|access_token)=)[^&\s\"']+", re.IGNORECASE)


def redact(text: str) -> str:
    return _SECRET_PARAM.sub(r"\1<redacted>", text)


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        redacted = redact(message)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def install_log_redaction(logger_names=("uvicorn.access", "uvicorn.error", "uvicorn")) -> None:
    flt = RedactSecretsFilter()
    for name in logger_names:
        logger = logging.getLogger(name)
        if not any(isinstance(f, RedactSecretsFilter) for f in logger.filters):
            logger.addFilter(flt)
