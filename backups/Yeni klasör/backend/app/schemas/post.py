from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PostBase(BaseModel):
    title: str = Field(..., example="Mevzuat Güncellemesi")
    content: str = Field(..., example="Yeni yönetmelik 3. madde değişikliği hakkında...")
    category: str = Field("Genel", example="Mevzuat")
    author_id: str = Field(..., example="admin-id")
    author_name: str = Field(..., example="Bilgi İşlem")
    author_role: Optional[str] = Field("Müfettiş", example="Müfettiş")
    is_public: bool = True
    shared_with: Optional[List[str]] = Field(default_factory=list, example=["user-id-1", "user-id-2"])
    attachments: Optional[List[dict]] = Field(default_factory=list, example=[{"url": "...", "type": "image", "name": "..."}])

class PostCreate(PostBase):
    pass

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None

class CommentUpdate(BaseModel):
    content: Optional[str] = None

class PostResponse(PostBase):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    likes_count: int = 0
    # comments: List[dict] = [] # Gelecek versiyon için hazır

    class Config:
        from_attributes = True
