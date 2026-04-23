import os
import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

def get_base_dir():
    """Uygulamanın çalıştığı kök dizini döndürür. PyInstaller desteği eklenmiştir."""
    if getattr(sys, 'frozen', False):
        # PyInstaller ile paketlenmiş exe çalışıyorsa exe'nin bulunduğu klasör
        return os.path.dirname(sys.executable)
    # Geliştirme ortamındaysa (backend/ klasörü)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = get_base_dir()

def get_data_dir():
    """Kullanıcı raporları ve verilerinin saklanacağı 'Belgeler/MufYARD' klasörünü döner."""
    documents_path = os.path.join(os.path.expanduser("~"), "Documents")
    data_path = os.path.join(documents_path, "MufYARD")
    if not os.path.exists(data_path):
        try:
            os.makedirs(data_path, exist_ok=True)
        except:
            # Fallback to local if documents is inaccessible
            return BASE_DIR
    return data_path

DATA_DIR = get_data_dir()

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "MufYARD"
    DEBUG: bool = False
    STARTUP_SYNC_ENABLED: bool = False
    
    # AI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # Google API Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # Firebase Settings
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.path.join(BASE_DIR, "firebase-credentials.json")
    FIREBASE_STORAGE_BUCKET: str = "" # e.g. project-id.appspot.com
    
    # Email (SMTP) Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@mufyard.com"
    
    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"), 
        extra="ignore"
    )

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
