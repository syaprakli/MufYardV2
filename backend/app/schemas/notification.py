from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationBase(BaseModel):
    user_id: str
    title: str
    message: str
    type: str = "task_invite" # "task_invite", "task_accepted", "general"
    task_id: Optional[str] = None
    read: bool = False

class NotificationCreate(NotificationBase):
    pass

class Notification(NotificationBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
