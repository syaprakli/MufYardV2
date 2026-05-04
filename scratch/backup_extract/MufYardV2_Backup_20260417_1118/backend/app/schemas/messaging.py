from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MessageBase(BaseModel):
    text: str = Field(..., example="Merhabalar, iyi çalışmalar.")
    author_id: str = Field(..., example="mufettis-id")
    author_name: str = Field(..., example="Sefa YAPRAKLI")
    author_role: Optional[str] = Field("Müfettiş", example="Müfettiş")

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
