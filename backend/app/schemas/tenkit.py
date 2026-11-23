"""Tenkit takibi: denetimde verilen tenkitler, kanıtları ve rapor sonrası durumları."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

TenkitDurumu = Literal["acik", "cevap_bekleniyor", "giderildi", "kismen_giderildi", "giderilmedi"]
TenkitOnemi = Literal["kritik", "uyari", "bilgi"]
TenkitKaynagi = Literal["kontrol_listesi", "tenkit_havuzu", "manuel"]
KanitTuru = Literal["foto", "belge", "not"]
MAX_KANIT = 30


class Kanit(BaseModel):
    """Tenkiti destekleyen kanıt: denetim galerisinden fotoğraf, belge referansı veya not."""
    id: str = Field(..., min_length=1, max_length=64)
    tur: KanitTuru
    url: Optional[str] = Field(None, max_length=2048, description="Fotoğraf adresi (yalnızca http(s) veya sunucu yolu)")
    ad: Optional[str] = Field(None, max_length=300, description="Ör. 'Ek-3: 2025 yılı mizanı'")
    aciklama: Optional[str] = Field(None, max_length=2000)

    @field_validator("url")
    @classmethod
    def _guvenli_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip()
        # data:/javascript: vb. kabul edilmez: belge boyutu ve XSS riski
        if not (v.startswith("https://") or v.startswith("http://") or (v.startswith("/") and not v.startswith("//"))):
            raise ValueError("Kanıt adresi http(s) veya sunucu yolu olmalı.")
        return v


class TenkitBase(BaseModel):
    baslik: str = Field(..., min_length=1, max_length=500)
    aciklama: Optional[str] = Field(None, max_length=10000)
    dayanak: Optional[str] = Field(None, max_length=1000, description="Mevzuat dayanağı")
    onem: TenkitOnemi = "uyari"
    kaynak: TenkitKaynagi = "manuel"
    kaynak_ref: Optional[str] = Field(None, max_length=200, description="Kontrol listesi madde kimliği vb.")
    alan: Optional[str] = Field(None, max_length=200, description="Konu alanı (ör. Spor Faaliyetleri)")
    kanitlar: List[Kanit] = Field(default_factory=list, max_length=MAX_KANIT)


class TenkitCreate(TenkitBase):
    audit_id: str
    durum: TenkitDurumu = "acik"


class TenkitAktarItem(TenkitBase):
    pass


class TenkitAktar(BaseModel):
    audit_id: str
    items: List[TenkitAktarItem] = Field(..., max_length=500)


class TenkitUpdate(BaseModel):
    baslik: Optional[str] = Field(None, min_length=1, max_length=500)
    aciklama: Optional[str] = Field(None, max_length=10000)
    dayanak: Optional[str] = Field(None, max_length=1000)
    onem: Optional[TenkitOnemi] = None
    alan: Optional[str] = Field(None, max_length=200)
    durum: Optional[TenkitDurumu] = None
    birim_cevabi: Optional[str] = Field(None, max_length=10000)
    cevap_tarihi: Optional[str] = Field(None, max_length=40)
    takip_notu: Optional[str] = Field(None, max_length=10000)
    kanitlar: Optional[List[Kanit]] = Field(None, max_length=MAX_KANIT)
