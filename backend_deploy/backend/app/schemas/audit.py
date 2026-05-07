from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class AuditBase(BaseModel):
    task_id: Optional[str] = None
    title: str
    location: str
    date: str
    status: str = "Devam Ediyor"
    inspector: str
    description: Optional[str] = None
    report_content: Optional[str] = Field(default="<h1></h1>")
    institution: Optional[str] = Field(default="Gençlik ve Spor Bakanlığı")
    owner_id: Optional[str] = None
    assigned_to: List[str] = Field(default_factory=list)
    shared_with: List[str] = Field(default_factory=list)
    pending_collaborators: List[str] = Field(default_factory=list)
    accepted_collaborators: List[str] = Field(default_factory=list)
    is_public: bool = False
    report_seq: Optional[int] = 1

class AuditCreate(AuditBase):
    pass

class AuditUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    inspector: Optional[str] = None
    description: Optional[str] = None
    report_content: Optional[str] = None
    institution: Optional[str] = None
    owner_id: Optional[str] = None
    assigned_to: Optional[List[str]] = None
    shared_with: Optional[List[str]] = None
    pending_collaborators: Optional[List[str]] = None
    accepted_collaborators: Optional[List[str]] = None
    is_public: Optional[bool] = None


class AuditResponse(AuditBase):
    id: str
    created_at: Optional[str] = None  # string veya datetime olabilir

    class Config:
        from_attributes = True
