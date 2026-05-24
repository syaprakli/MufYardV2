import os
import json
import logging
from app.config import DATA_DIR

logger = logging.getLogger("local_settings")

SETTINGS_FILE = os.path.join(DATA_DIR, "ai_settings.json")

def get_local_ai_settings() -> dict:
    """Reads AI settings from the local JSON file."""
    if not os.path.exists(SETTINGS_FILE):
        return {}
    
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading local AI settings: {e}")
        return {}

def save_local_ai_settings(settings: dict) -> bool:
    """Saves AI settings to the local JSON file."""
    try:
        # Create directory if it doesn't exist (safety check)
        os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
        
        # Load existing first to merge (optional, but safer)
        existing = get_local_ai_settings()
        existing.update(settings)
        
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        logger.error(f"Error saving local AI settings: {e}")
        return False
