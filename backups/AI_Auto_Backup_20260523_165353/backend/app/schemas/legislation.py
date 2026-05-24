from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class LegislationBase(BaseModel):
    title: str = Field(..., example="Kredi ve Yurtlar Hizmetleri Kanunu")
    category: str = Field(..., example="Genel")
    doc_type: Optional[str] = Field(None, example="Kanun")
    summary: Optional[str] = Field(None, example="Genel hizmet esaslarını belirleyen kanun.")
    content: Optional[str] = Field(None, example="Full text of the law for AI indexing...")
    tags: List[str] = Field(default_factory=list, example=["KYK", "Kanun"])
    document_url: Optional[str] = None
    local_path: Optional[str] = None
    official_gazette_info: Optional[str] = Field(None, example="12.04.1985 / 12345")
    is_pinned: bool = False
    is_archived: bool = False
    created_by_name: Optional[str] = None
    last_updated_by_name: Optional[str] = None
    is_approved: bool = True  # Varsayılan True (admin eklerken), kullanıcı eklerken False set edilecek
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

class LegislationCreate(LegislationBase):
    owner_id: Optional[str] = Field(None, example="user_123")
    is_public: bool = Field(True, example=True)

class LegislationUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    doc_type: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    document_url: Optional[str] = None
    local_path: Optional[str] = None
    official_gazette_info: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_public: Optional[bool] = None
    is_archived: Optional[bool] = None
    last_updated_by_name: Optional[str] = None
    is_approved: Optional[bool] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None



class LegislationResponse(LegislationBase):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
