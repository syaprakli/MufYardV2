"""Tenkit takibi: denetimde verilen tenkitler ve rapor sonrası durumları."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

TenkitDurumu = Literal["acik", "cevap_bekleniyor", "giderildi", "kismen_giderildi", "giderilmedi"]
TenkitOnemi = Literal["kritik", "uyari", "bilgi"]
TenkitKaynagi = Literal["kontrol_listesi", "tenkit_havuzu", "manuel"]


class TenkitBase(BaseModel):
    baslik: str = Field(..., min_length=1, max_length=500)
    aciklama: Optional[str] = Field(None, max_length=10000)
    dayanak: Optional[str] = Field(None, max_length=1000, description="Mevzuat dayanağı")
    onem: TenkitOnemi = "uyari"
    kaynak: TenkitKaynagi = "manuel"
    kaynak_ref: Optional[str] = Field(None, max_length=200, description="Kontrol listesi madde kimliği vb.")
    alan: Optional[str] = Field(None, max_length=200, description="Konu alanı (ör. Spor Faaliyetleri)")


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
