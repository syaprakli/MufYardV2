from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class InspectorBase(BaseModel):
    name: str = Field(..., example="Sefa YAPRAKLI")
    email: str = Field(..., example="sefa@gsb.gov.tr")
    title: str = Field(default="Müfettiş", example="Müfettiş")
    extension: Optional[str] = Field(None, example="1234")
    phone: Optional[str] = Field(None, example="0532...")
    room: Optional[str] = Field(None, example="4. Kat / 402")
    uid: Optional[str] = None

class InspectorCreate(InspectorBase):
    pass

class InspectorResponse(InspectorBase):
    id: str
    extension: Optional[str] = None
    phone: Optional[str] = None
    room: Optional[str] = None
    force_unlinked: Optional[bool] = None
    created_at: str

    class Config:
        from_attributes = True
