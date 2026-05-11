from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NoteBase(BaseModel):
    title: str = Field(..., example="Denetim Notu")
    text: str = Field(..., example="Ankara şubesi için ek belgeler talep edilecek.")
    is_pinned: bool = False
    is_done: bool = False
    color: Optional[str] = Field("amber", example="blue") # For card styling
    priority: str = Field("normal", example="urgent")
    shared_with: list[str] = Field(default_factory=list)
    pending_collaborators: list[str] = Field(default_factory=list)
    accepted_collaborators: list[str] = Field(default_factory=list)

class NoteCreate(NoteBase):
    owner_id: str = Field(..., example="user_123")

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_done: Optional[bool] = None
    color: Optional[str] = None
    priority: Optional[str] = None
    shared_with: Optional[list[str]] = None
    pending_collaborators: Optional[list[str]] = None
    accepted_collaborators: Optional[list[str]] = None

class NoteResponse(NoteBase):
    id: str
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True

