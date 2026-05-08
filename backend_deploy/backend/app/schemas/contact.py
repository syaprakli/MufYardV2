from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ContactBase(BaseModel):
    name: str = Field(..., example="Ahmet Yılmaz")
    title: str = Field(default="", example="Başmüfettiş")
    unit: str = Field(default="", example="Rehberlik ve Denetim Başkanlığı")
    phone: str = Field(..., example="05xx xxx xx xx")
    email: Optional[str] = Field(default="", example="eposta@gsb.gov.tr")
    tags: List[str] = Field(default_factory=list, example=["Müfettiş", "Birim Amiri"])
    category: Optional[str] = Field(default=None, example="Başmüfettiş")
    sort_order: Optional[int] = Field(default=None, example=14)
    is_shared: bool = False
    shared_with: List[str] = Field(default_factory=list)
    pending_collaborators: List[str] = Field(default_factory=list)
    accepted_collaborators: List[str] = Field(default_factory=list)

class ContactCreate(ContactBase):
    owner_id: str

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    unit: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_shared: Optional[bool] = None

class ContactResponse(ContactBase):
    id: str
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
