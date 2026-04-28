from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProfileBase(BaseModel):
    full_name: str = Field(default="İsimsiz Kullanıcı", example="Sefa YAPRAKLI")
    title: str = Field(default="Müfettiş", example="Müfettiş")
    institution: str = Field(default="Gençlik ve Spor Bakanlığı")
    email: str = Field(default="", example="sefa.yaprakli@gsb.gov.tr")
    avatar_url: Optional[str] = None
    theme: str = Field(default="navy", example="dark") # "navy", "dark", "light"
    ai_enabled: bool = True
    has_premium_ai: bool = False
    notifications_enabled: bool = True
    role: str = Field(default="user", example="admin") # "admin", "moderator", "user"
    fcm_token: Optional[str] = None
    email_assignments: bool = True
    email_approvals: bool = True
    email_collaboration: bool = True
    two_factor_enabled: bool = False
    two_factor_secret: Optional[str] = None
    phone: Optional[str] = None
    ai_model: str = Field(default="gemini-2.0-flash")
    gemini_api_key: Optional[str] = None
    gemini_model: str = Field(default="gemini-2.0-flash")

    ai_temperature: float = Field(default=0.7)
    ai_system_prompt: Optional[str] = None

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    institution: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: Optional[str] = None
    ai_enabled: Optional[bool] = None
    has_premium_ai: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    role: Optional[str] = None
    fcm_token: Optional[str] = None
    email_assignments: Optional[bool] = None
    email_approvals: Optional[bool] = None
    email_collaboration: Optional[bool] = None
    two_factor_enabled: Optional[bool] = None
    two_factor_secret: Optional[str] = None
    phone: Optional[str] = None
    ai_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None

    ai_temperature: Optional[float] = None
    ai_system_prompt: Optional[str] = None

class ProfileResponse(ProfileBase):
    uid: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
