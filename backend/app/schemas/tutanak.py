"""İfade tutanakları (inceleme/soruşturmada tek tutanak türü ifadedir)."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

TutanakTuru = Literal["ifade"]
KisiRolu = Literal["ifade_veren", "mufettis", "katilan", "tanik", "yazman"]


class TutanakKisi(BaseModel):
    ad: str = Field("", max_length=200)  # düzenleme sırasında boş olabilir (yeni ifadede "İfade veren" boş başlar)
    unvan: Optional[str] = Field(None, max_length=200)
    rol: KisiRolu = "katilan"
    tckn: Optional[str] = Field(None, max_length=11, pattern=r"^\d{0,11}$")
    adres: Optional[str] = Field(None, max_length=500)
    # İfade verenin kimlik bilgileri (ifade tutanağı şablonu)
    baba_adi: Optional[str] = Field(None, max_length=100)
    ana_adi: Optional[str] = Field(None, max_length=100)
    dogum_yeri: Optional[str] = Field(None, max_length=100)
    dogum_yili: Optional[str] = Field(None, max_length=20)
    nufus_yeri: Optional[str] = Field(None, max_length=200)
    telefon: Optional[str] = Field(None, max_length=30)


class SoruCevap(BaseModel):
    soru: str = Field("", max_length=5000)
    cevap: str = Field("", max_length=20000)


class TutanakAlanlari(BaseModel):
    baslik: Optional[str] = Field(None, max_length=300)
    tarih: Optional[str] = Field(None, max_length=20)
    saat: Optional[str] = Field(None, max_length=10)
    yer: Optional[str] = Field(None, max_length=300)
    konu: Optional[str] = Field(None, max_length=2000)
    kisiler: Optional[List[TutanakKisi]] = Field(None, max_length=30)
    sorular: Optional[List[SoruCevap]] = Field(None, max_length=150)
    metin: Optional[str] = Field(None, max_length=60000)
    kapanis: Optional[str] = Field(None, max_length=3000)
    tamamlandi: Optional[bool] = None


class TutanakCreate(TutanakAlanlari):
    # İfade/tutanak inceleme-soruşturma görevine aittir (genel denetimde alınmaz)
    task_id: str = Field(..., min_length=1, max_length=200)
    tur: TutanakTuru = "ifade"


class TutanakUpdate(TutanakAlanlari):
    pass
