from datetime import datetime
import asyncio
import logging
from typing import Optional, Dict, Any, List
from app.lib.firebase_admin import db, bucket, messenger, messaging
from app.schemas.profile import ProfileUpdate
from fastapi import UploadFile
import os

logger = logging.getLogger(__name__)

class ProfileService:
    @staticmethod
    async def upload_avatar(uid: str, file: UploadFile) -> str:
        """Uploads an avatar to LOCAL storage and returns the local URL."""
        # Setup local paths
        ext = file.filename.split('.')[-1]
        relative_path = os.path.join("profiles", uid)
        
        # Absolute path for the backend system
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        upload_dir = os.path.join(backend_dir, "uploads", relative_path)
        
        # Ensure directory exists
        os.makedirs(upload_dir, exist_ok=True)
        
        file_name = f"avatar.{ext}"
        file_path = os.path.join(upload_dir, file_name)
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Standardized local public URL (assuming backend is on port 8000)
        # In a real setup, this would use a base URL from config
        public_url = f"http://localhost:8000/uploads/profiles/{uid}/{file_name}"
        
        # Update profile URL in Firestore
        await ProfileService.update_profile(uid, ProfileUpdate(avatar_url=public_url))
        
        logger.info(f"Avatar saved locally for user {uid}: {public_url}")
        return public_url

    @staticmethod
    async def get_profile(uid: str) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('profiles').document(uid)
        doc = await asyncio.to_thread(doc_ref.get)
        if doc.exists:
            profile_data = doc.to_dict()
            profile_data['uid'] = doc.id
            return profile_data
        
        # Default Profile if not exists
        default_profile = {
            "uid": uid,
            "full_name": "Kullanıcı",
            "title": "Müfettiş",
            "institution": "Gençlik ve Spor Bakanlığı",
            "email": "mufettis@gsb.gov.tr",
            "theme": "navy",
            "ai_enabled": True,
            "ai_model": "Gemini 1.5 Pro",
            "ai_temperature": 0.7,
            "ai_system_prompt": None,
            "notifications_enabled": True,
            "updated_at": datetime.utcnow()
        }
        await asyncio.to_thread(lambda: db.collection('profiles').document(uid).set(default_profile))
        return default_profile

    @staticmethod
    async def update_profile(uid: str, profile_update: ProfileUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('profiles').document(uid)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            await ProfileService.get_profile(uid) # Initialize if not exists
            
        update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['uid'] = uid
        return updated_doc
    @staticmethod
    async def get_all_profiles() -> List[Dict[str, Any]]:
        docs = await asyncio.to_thread(db.collection('profiles').stream)
        profiles = []
        for doc in docs:
            p = doc.to_dict()
            p['uid'] = doc.id
            profiles.append(p)
        return profiles

    @staticmethod
    async def send_notification(token: str, title: str, body: str) -> bool:
        """Sends a push notification using FCM."""
        if not messenger or not token:
            logger.warning("FCM Messenger not initialized or missing token.")
            return False
            
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                token=token,
            )
            response = messenger.send(message)
            logger.info(f"Successfully sent message: {response}")
            return True
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")
            return False
