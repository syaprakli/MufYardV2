from datetime import datetime
import asyncio
import logging
from typing import Optional, Dict, Any, List
from app.lib.firebase_admin import db, bucket, messenger, messaging
from app.schemas.profile import ProfileUpdate
from app.config import BASE_DIR
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
        from app.config import get_settings
        settings = get_settings()
        upload_dir = os.path.join(settings.UPLOADS_DIR, relative_path)
        
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
    async def get_profile(uid: str, email: Optional[str] = None) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('profiles').document(uid)
        doc = await asyncio.to_thread(doc_ref.get)
        
        profile_data = None
        is_generic = False
        if doc.exists:
            profile_data = doc.to_dict()
            # If profile is "generic", try to enrich it
            if profile_data.get('full_name') in ["Kullanıcı", "İsimsiz Kullanıcı", "Kullanici", "İsimsiz"]:
                is_generic = True
            else:
                profile_data['uid'] = doc.id
                return profile_data

        # Discovery logic
        search_email = (email or (uid if "@" in uid else None))
        if search_email:
            search_email = search_email.lower().strip()
            
        inspector_match = None
        
        if search_email:
            # Search by email in inspectors
            inspectors_ref = db.collection('inspectors')
            # Try exact match first
            query = inspectors_ref.where('email', '==', search_email).limit(1)
            results = await asyncio.to_thread(lambda: list(query.stream()))
            if results:
                inspector_match = results[0].to_dict()
            else:
                # Try search by UID if email match fails
                query = inspectors_ref.where('uid', '==', search_email).limit(1)
                results = await asyncio.to_thread(lambda: list(query.stream()))
                if results:
                    inspector_match = results[0].to_dict()
        
        if not inspector_match:
            # Try search by uid in inspectors
            query = db.collection('inspectors').where('uid', '==', uid).limit(1)
            results = await asyncio.to_thread(lambda: list(query.stream()))
            if results:
                inspector_match = results[0].to_dict()

        if inspector_match:
            new_data = {
                "uid": uid,
                "full_name": inspector_match.get('name', profile_data.get('full_name') if profile_data else "Kullanıcı"),
                "title": inspector_match.get('title', profile_data.get('title') if profile_data else "Müfettiş"),
                "email": inspector_match.get('email', search_email or (profile_data.get('email') if profile_data else "")),
                "phone": inspector_match.get('phone', (profile_data.get('phone') if profile_data else "")),
                "institution": "Gençlik ve Spor Bakanlığı",
                "updated_at": datetime.utcnow()
            }
            
            # Add defaults for new profiles
            if not profile_data:
                new_data.update({
                    "theme": "navy",
                    "ai_enabled": True,
                    "ai_model": "Gemini 2.0 Flash",
                    "ai_temperature": 0.7,
                    "notifications_enabled": True,
                    "role": "user"
                })
            
            await asyncio.to_thread(lambda: doc_ref.set(new_data, merge=True))
            return new_data

        if profile_data:
            profile_data['uid'] = doc.id
            return profile_data

        # Final Fallback
        default_profile = {
            "uid": uid,
            "full_name": "Kullanıcı",
            "title": "Müfettiş",
            "institution": "Gençlik ve Spor Bakanlığı",
            "email": search_email or "mufettis@gsb.gov.tr",
            "theme": "navy",
            "ai_enabled": True,
            "ai_model": "Gemini 2.0 Flash",
            "ai_temperature": 0.7,
            "notifications_enabled": True,
            "role": "user",
            "updated_at": datetime.utcnow()
        }
        await asyncio.to_thread(lambda: doc_ref.set(default_profile))
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
