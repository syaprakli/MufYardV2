from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ReminderBase(BaseModel):
    title: str = Field(..., example="X Federasyonu Disiplin Soruşturması")
    description: Optional[str] = Field(None, example="Açıklama veya kritik notlar")
    reminder_type: str = Field("zamanasimi", example="zamanasimi") # "zamanasimi" veya "genel"
    category: str = Field("disiplin_657", example="disiplin_657")
    incident_date: Optional[str] = Field(None, example="2025-05-10")
    expiration_date: str = Field(..., example="2027-05-10")
    notify_before_months: int = Field(2, example=2)
    notify_before_days: Optional[int] = Field(None, example=3) # Genel hatırlatıcılar için gün eşiği
    status: str = Field("active", example="active")  # active, completed, archived
    priority: str = Field("urgent", example="urgent")  # normal, urgent, critical
    tags: List[str] = Field(default_factory=list)

class ReminderCreate(ReminderBase):
    owner_id: Optional[str] = None

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reminder_type: Optional[str] = None
    category: Optional[str] = None
    incident_date: Optional[str] = None
    expiration_date: Optional[str] = None
    notify_before_months: Optional[int] = None
    notify_before_days: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None

class ReminderResponse(ReminderBase):
    id: str
    owner_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True
