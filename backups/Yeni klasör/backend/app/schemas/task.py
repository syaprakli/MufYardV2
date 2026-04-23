from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class TaskStep(BaseModel):
    text: str
    done: bool = False


class TaskBase(BaseModel):
    rapor_kodu: Optional[str] = None          # S.Y.64/2026-1 (otomatik)
    rapor_adi: str                            # Bolu Genel Denetimi
    rapor_turu: str = "Genel Denetim"         # Genel Denetim / Soruşturma / İnceleme / Ön İnceleme / Spor Kulüpleri
    baslama_tarihi: Optional[str] = None      # 2026-03-15
    sure_gun: Optional[int] = 30             # Verilen süre (gün)
    rapor_durumu: str = "Devam Ediyor"        # Devam Ediyor / İncelemede / Tamamlandı / Beklemede
    steps: List[Any] = Field(default_factory=list)  # İş adımları [{text, done}]
    owner_id: Optional[str] = None
    assigned_to: List[str] = Field(default_factory=list)
    shared_with: List[str] = Field(default_factory=list)
    pending_collaborators: List[str] = Field(default_factory=list)
    accepted_collaborators: List[str] = Field(default_factory=list)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    rapor_adi: Optional[str] = None
    rapor_turu: Optional[str] = None
    baslama_tarihi: Optional[str] = None
    sure_gun: Optional[int] = None
    rapor_durumu: Optional[str] = None
    steps: Optional[List[Any]] = None
    owner_id: Optional[str] = None
    assigned_to: Optional[List[str]] = None
    shared_with: Optional[List[str]] = None
    pending_collaborators: Optional[List[str]] = None
    accepted_collaborators: Optional[List[str]] = None


class TaskResponse(TaskBase):
    id: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
