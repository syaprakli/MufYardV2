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
    def _normalize_email(value: Optional[str]) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _merge_emails(*groups: Any) -> List[str]:
        merged: List[str] = []
        seen = set()

        def push_one(raw: Any):
            email = ProfileService._normalize_email(str(raw) if raw is not None else "")
            if email and email not in seen:
                seen.add(email)
                merged.append(email)

        for group in groups:
            if group is None:
                continue
            if isinstance(group, (list, tuple, set)):
                for item in group:
                    push_one(item)
            else:
                push_one(group)

        return merged

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
    async def get_profile(uid: str, email: Optional[str] = None, full_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        try:
            doc_ref = db.collection('profiles').document(uid)
            doc = await asyncio.to_thread(doc_ref.get)
        except Exception as e:
            logger.error(f"Firestore Quota Error: {e}")
            # Fallback will be handled at the end of method
            doc = type('obj', (object,), {'exists': False})

        
        profile_data = None
        is_generic = False
        if doc.exists:
            profile_data = doc.to_dict()
            profile_data['uid'] = doc.id
            
            # Eğer profil zaten doğrulanmışsa ve ismi genel değilse direkt döndür
            is_generic = profile_data.get('full_name') in ["Kullanıcı", "İsimsiz Kullanıcı", "Kullanici", "İsimsiz"]
            if profile_data.get('verified') == True and not is_generic:
                return profile_data
            
            # Doğrulanmamışsa veya ismi genel ise aşağıda 'Discovery' mantığına devam et

        # Discovery logic
        inspector_match = None
        search_email = (email or (uid if "@" in uid else None))
        if search_email:
            search_email = search_email.lower().strip()
        requested_name = (full_name or "").strip()
            
        try:
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

            if not inspector_match and requested_name:
                inspectors_ref = db.collection('inspectors')

                def clean_name(n):
                    return n.upper().replace(".", " ").replace("-", " ").strip()

                cleaned_search = clean_name(requested_name)
                all_inspectors = await asyncio.to_thread(lambda: [doc.to_dict() for doc in inspectors_ref.stream()])
                for insp in all_inspectors:
                    if clean_name(insp.get('name', '')) == cleaned_search:
                        inspector_match = insp
                        break
        except Exception as e:
            logger.warning(f"Firestore Discovery error (Quota?): {e}")

        if not inspector_match and profile_data and profile_data.get('full_name'):
            # Try search by full_name in inspectors (Fuzzy match)
            # This handles cases like sefayaprakli@hotmail.com -> Sefa Yapraklı
            name_to_search = profile_data.get('full_name')
            if (name_to_search not in ["Kullanıcı", "İsimsiz Kullanıcı", "Kullanici", "İsimsiz", "Müfettiş"]):
                inspectors_ref = db.collection('inspectors')
                
                # More robust normalization: Uppercase and strip dots/dashes
                def clean_name(n):
                    return n.upper().replace(".", " ").replace("-", " ").strip()

                cleaned_search = clean_name(name_to_search)
                
                # Query all inspectors to perform case-insensitive fuzzy check in memory
                # (Firestore query limitations on partial match)
                all_inspectors = await asyncio.to_thread(lambda: [doc.to_dict() for doc in inspectors_ref.stream()])
                for insp in all_inspectors:
                    if clean_name(insp.get('name', '')) == cleaned_search:
                        inspector_match = insp
                        break

        if inspector_match:
            merged_emails = ProfileService._merge_emails(
                (profile_data or {}).get('emails', []),
                (profile_data or {}).get('email'),
                search_email,
                inspector_match.get('email')
            )
            base_profile = dict(profile_data or {})
            base_full_name = (base_profile.get('full_name') or '').strip()
            base_is_generic = base_full_name in ["Kullanıcı", "İsimsiz Kullanıcı", "Kullanici", "İsimsiz", "Müfettiş"]

            new_data = {
                **base_profile,
                "uid": uid,
                "full_name": base_full_name if base_full_name and not base_is_generic else inspector_match.get('name', base_full_name or "Kullanıcı"),
                "title": (base_profile.get('title') or '').strip() or inspector_match.get('title', "Müfettiş"),
                "email": (base_profile.get('email') or '').strip() or inspector_match.get('email', search_email or ""),
                "emails": merged_emails,
                "phone": (base_profile.get('phone') or '').strip() or inspector_match.get('phone', ""),
                "institution": (base_profile.get('institution') or '').strip() or "Gençlik ve Spor Bakanlığı",
                "birthday": base_profile.get('birthday'),  # Preserve saved birthday
                "verified": True,
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
                    "role": "admin" if email in ["sefa.yaprakli@gsb.gov.tr", "sefayaprakli@hotmail.com"] else "user"
                })
            
            # Admin role enforcement
            if email in ["sefa.yaprakli@gsb.gov.tr", "sefayaprakli@hotmail.com"]:
                new_data["role"] = "admin"

            try:
                await asyncio.to_thread(lambda: doc_ref.set(new_data, merge=True))
                
                # Welcome Notification
                if not profile_data:
                    await asyncio.to_thread(db.collection('notifications').add, {
                        "user_id": uid,
                        "title": "Aramıza Hoş Geldiniz! 🚀",
                        "message": "MufYard platformuna başarıyla kayıt oldunuz. Dijital denetim süreçlerinizi buradan yönetebilirsiniz.",
                        "type": "system",
                        "read": False,
                        "created_at": datetime.utcnow()
                    })
            except: pass # Quota exceeded
                
            return new_data

        if profile_data:
            profile_data['uid'] = uid
            try:
                current_emails = ProfileService._merge_emails(
                    profile_data.get('emails', []),
                    profile_data.get('email'),
                    search_email,
                )
                if current_emails != profile_data.get('emails', []):
                    await asyncio.to_thread(lambda: doc_ref.update({"emails": current_emails, "updated_at": datetime.utcnow()}))
                    profile_data['emails'] = current_emails

                # Admin role enforcement for existing profiles
                _admin_emails = ["sefa.yaprakli@gsb.gov.tr", "sefayaprakli@hotmail.com"]
                if (profile_data.get('email') or search_email or '').lower() in _admin_emails:
                    if profile_data.get('role') != 'admin':
                        await asyncio.to_thread(lambda: doc_ref.update({"role": "admin"}))
                        profile_data['role'] = 'admin'
            except: pass # Quota
            return profile_data

        # Final Fallback
        _admin_emails = ["sefa.yaprakli@gsb.gov.tr", "sefayaprakli@hotmail.com"]
        _fallback_role = "admin" if (search_email or "").lower() in _admin_emails else "user"
        default_profile = {
            "uid": uid,
            "full_name": "Kullanıcı (Mod-Dışı)",
            "title": "Müfettiş",
            "institution": "Gençlik ve Spor Bakanlığı",
            "email": search_email or "sefa.yaprakli@gsb.gov.tr",
            "emails": ProfileService._merge_emails(search_email or "sefa.yaprakli@gsb.gov.tr"),
            "theme": "navy",
            "ai_enabled": True,
            "ai_model": "Gemini 2.0 Flash",
            "ai_temperature": 0.7,
            "notifications_enabled": True,
            "role": _fallback_role,
            "verified": False,
            "updated_at": datetime.utcnow()
        }
        
        try:
            await asyncio.to_thread(lambda: doc_ref.set(default_profile))
            
            # Welcome Notification
            await asyncio.to_thread(db.collection('notifications').add, {
                "user_id": uid,
                "title": "Aramıza Hoş Geldiniz! 🚀",
                "message": "MufYard platformuna başarıyla kayıt oldunuz. Hesabınızı kişiselleştirmek için ayarlar menüsünü kullanabilirsiniz.",
                "type": "system",
                "read": False,
                "created_at": datetime.utcnow()
            })
        except: pass
        
        return default_profile

    @staticmethod
    async def update_profile(uid: str, profile_update: ProfileUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('profiles').document(uid)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            await ProfileService.get_profile(uid) # Initialize if not exists
            
        update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
        current_doc = await asyncio.to_thread(doc_ref.get)
        current = current_doc.to_dict() or {}

        merged_emails = ProfileService._merge_emails(
            current.get('emails', []),
            current.get('email'),
            update_data.get('emails', []),
            update_data.get('email')
        )
        if merged_emails:
            update_data['emails'] = merged_emails

        update_data['updated_at'] = datetime.utcnow()
        
        # set(merge=True) kullan: update() belge yoksa exception fırlatır,
        # set(merge=True) hem yeni oluşturur hem günceller.
        await asyncio.to_thread(lambda: doc_ref.set(update_data, merge=True))
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['uid'] = uid
        return updated_doc
    @staticmethod
    async def get_all_profiles() -> List[Dict[str, Any]]:
        try:
            query = db.collection('profiles').limit(500)
            docs = await asyncio.to_thread(lambda: list(query.stream()))
            profiles = []
            now = datetime.utcnow()
            for doc in docs:
                p = doc.to_dict()
                if not p: continue
                
                p['uid'] = doc.id
                
                # Validation for schema
                if 'full_name' not in p: p['full_name'] = "İsimsiz Kullanıcı"
                if 'title' not in p: p['title'] = "Müfettiş"
                if 'institution' not in p: p['institution'] = "Gençlik ve Spor Bakanlığı"
                if 'email' not in p: p['email'] = ""
                if 'emails' not in p: p['emails'] = ProfileService._merge_emails(p.get('email'))
                if 'theme' not in p: p['theme'] = "navy"
                if 'ai_enabled' not in p: p['ai_enabled'] = True
                if 'has_premium_ai' not in p: p['has_premium_ai'] = False
                if 'notifications_enabled' not in p: p['notifications_enabled'] = True
                if 'role' not in p: p['role'] = "user"
                if 'two_factor_enabled' not in p: p['two_factor_enabled'] = False
                if 'verified' not in p: p['verified'] = False
                if 'updated_at' not in p: p['updated_at'] = now
                
                profiles.append(p)
            return profiles
        except Exception as e:
            logger.error(f"Error getting all profiles: {e}")
            return []

    @staticmethod
    async def delete_profile(uid: str) -> bool:
        doc_ref = db.collection('profiles').document(uid)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
        await asyncio.to_thread(doc_ref.delete)
        # Firebase Auth hesabını da sil
        try:
            from firebase_admin import auth as firebase_auth
            await asyncio.to_thread(firebase_auth.delete_user, uid)
        except Exception as e:
            logger.warning(f"Firebase Auth kullanıcısı silinemedi (uid={uid}): {e}")
        return True

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
