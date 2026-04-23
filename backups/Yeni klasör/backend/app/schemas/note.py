from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NoteBase(BaseModel):
    title: str = Field(..., example="Denetim Notu")
    text: str = Field(..., example="Ankara şubesi için ek belgeler talep edilecek.")
    is_pinned: bool = False
    color: Optional[str] = Field("amber", example="blue") # For card styling

class NoteCreate(NoteBase):
    owner_id: str = Field(..., example="user_123")

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    is_pinned: Optional[bool] = None
    color: Optional[str] = None

class NoteResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    text: str
    is_pinned: bool
    color: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

