"""Zaman yardımcıları.

datetime.utcnow() Python 3.12'den itibaren kullanımdan kaldırıldı. Kod tabanı saat dilimi bilgisi
olmayan (naive) UTC değerlere ve `.isoformat() + "Z"` biçimine dayandığı için, birebir aynı
değeri üreten bu fonksiyon kullanılır. Aware datetime'a geçiş ayrı ve dikkatli bir iştir.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """datetime.utcnow() ile aynı: saat dilimi bilgisi olmayan UTC zamanı."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
