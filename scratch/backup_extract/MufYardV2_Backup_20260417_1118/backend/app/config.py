import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "MufYard V-2.0"
    DEBUG: bool = False
    STARTUP_SYNC_ENABLED: bool = False
    
    # AI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # Google API Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # Firebase Settings
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "" # Path to service account JSON
    FIREBASE_STORAGE_BUCKET: str = "" # e.g. project-id.appspot.com
    
    # Email (SMTP) Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@mufyard.com"
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), 
        extra="ignore"
    )

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
