from datetime import datetime, timedelta
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
    FOUNDER_EMAILS = [
        "sefa.yaprakli@gsb.gov.tr",
        "syaprakli@gmail.com",
        "sefayaprakli@hotmail.com"
    ]

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
            
        # Standardized relative URL for both local and production
        # Frontend resolveUrl will append BASE_URL (https://mufyardv2.up.railway.app)
        public_url = f"/uploads/profiles/{uid}/{file_name}"
        
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

            # Admin & Premium role enforcement (Whitelisted emails)
            _premium_emails = ProfileService.FOUNDER_EMAILS
            user_email_normalized = (email or search_email or "").lower().strip()
            
            # Add defaults for new profiles
            if not profile_data:
                is_premium = user_email_normalized in _premium_emails or uid in _premium_emails
                new_data.update({
                    "theme": "navy",
                    "ai_enabled": True,
                    "ai_model": "Gemini 2.0 Flash",
                    "ai_temperature": 0.7,
                    "notifications_enabled": True,
                    "created_at": datetime.utcnow(),
                    "has_premium_ai": is_premium,
                    "trial_started": is_premium, # Premium ise zaten başlamış sayılır
                    "role": "admin" if is_premium else "user"
                })
            
            if user_email_normalized in _premium_emails or uid in _premium_emails:
                new_data["role"] = "admin"
                new_data["has_premium_ai"] = True
            else:
                # Kurucu olmayanlar için mevcut veriyi koru, yoksa varsayılanları ata
                if not profile_data:
                    new_data["role"] = "user"
                    new_data["has_premium_ai"] = False
                else:
                    # Veritabanındaki mevcut durumu koru (Sadece kurucular zorla admin yapılır)
                    new_data["role"] = profile_data.get("role", "user")
                    new_data["has_premium_ai"] = profile_data.get("has_premium_ai", False)

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

                # Admin & Premium enforcement for existing profiles
                _premium_emails = ProfileService.FOUNDER_EMAILS
                user_email_normalized = (profile_data.get('email') or search_email or '').lower().strip()
                
                if user_email_normalized in _premium_emails:
                    if profile_data.get('role') != 'admin' or profile_data.get('has_premium_ai') != True:
                        await asyncio.to_thread(lambda: doc_ref.update({
                            "role": "admin",
                            "has_premium_ai": True,
                            "premium_type": "Sınırsız",
                            "updated_at": datetime.utcnow()
                        }))
                        profile_data['role'] = 'admin'
                        profile_data['has_premium_ai'] = True
                        profile_data['premium_type'] = "Sınırsız"
            except: pass 
            return profile_data

        # Final Fallback (New Account Creation)
        _premium_emails = ProfileService.FOUNDER_EMAILS + ["VKV8SfuNkWf9WeTYeSCTizd4oG83"]
        user_email_normalized = (search_email or "").lower().strip()
        is_premium_email = user_email_normalized in _premium_emails or uid in _premium_emails
        
        _fallback_role = "admin" if is_premium_email else "user"
        _has_premium = True if is_premium_email else False

        default_profile = {
            "uid": uid,
            "full_name": "Kullanıcı (Mod-Dışı)",
            "title": "Müfettiş",
            "institution": "Gençlik ve Spor Bakanlığı",
            "email": search_email or "sefa.yaprakli@gsb.gov.tr",
            "emails": ProfileService._merge_emails(search_email or "sefa.yaprakli@gsb.gov.tr"),
            "theme": "navy",
            "ai_enabled": True,
            "has_premium_ai": _has_premium,
            "premium_type": "Sınırsız" if _has_premium else None,
            "ai_model": "Gemini 2.0 Flash",
            "ai_temperature": 0.7,
            "notifications_enabled": True,
            "role": _fallback_role,
            "verified": False,
            "created_at": datetime.utcnow(),
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
        
        # Eğer has_premium_ai False yapılıyorsa, kullanılan lisansı boşa çıkar
        if update_data.get('has_premium_ai') == False:
            try:
                # Bu kullanıcı tarafından kullanılan anahtarı bul
                license_docs = await asyncio.to_thread(lambda: list(db.collection('license_keys').where('used_by', '==', uid).stream()))
                for ldoc in license_docs:
                    await asyncio.to_thread(ldoc.reference.update, {
                        'is_used': False,
                        'used_by': None,
                        'used_by_email': None,
                        'used_by_name': None,
                        'used_at': None
                    })
                    logger.info(f"Lisans anahtarı iade edildi (Kullanıcı resetlendi): {ldoc.id}")
            except Exception as e:
                logger.error(f"Lisans iade hatası: {e}")

        await asyncio.to_thread(lambda: doc_ref.set(update_data, merge=True))
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['uid'] = uid
        return updated_doc

    @staticmethod
    async def activate_premium(uid: str, license_key: str) -> bool:
        """
        Lisans anahtarını doğrular ve Pro özelliklerini (Sınırsız kullanım) açar.
        """
        from datetime import datetime, timedelta
        
        if not license_key:
            return False
            
        try:
            logger.info(f"[ProfileService] Aktivasyon adımları başlıyor: {uid}")
            
            # 0. Kullanıcı bilgilerini al
            doc_ref = db.collection('profiles').document(uid)
            user_doc = await asyncio.to_thread(doc_ref.get)
            if not user_doc.exists:
                logger.error(f"[ProfileService] Kullanıcı profili bulunamadı: {uid}")
                return False
            user_data = user_doc.to_dict()
            user_email = user_data.get('email', 'Bilinmiyor')
            user_name = user_data.get('full_name', 'Bilinmiyor')
            logger.info(f"[ProfileService] Kullanıcı teyit edildi: {user_name} ({user_email})")
            
            # 1. Lisans anahtarını koleksiyonda ara
            logger.info(f"[ProfileService] Anahtar sorgulanıyor: {license_key.strip().upper()}")
            license_ref = db.collection('license_keys').document(license_key.strip().upper())
            doc = await asyncio.to_thread(license_ref.get)
            
            if not doc.exists:
                logger.warning(f"[ProfileService] Anahtar veritabanında yok: {license_key}")
                return False
                
            license_data = doc.to_dict()
            if license_data.get('is_used'):
                logger.warning(f"[ProfileService] Anahtar zaten kullanılmış: {license_key} (used_by={license_data.get('used_by')})")
                return False
                
            duration_months = license_data.get('duration_months', 0)
            expires_at = None
            if duration_months > 0:
                expires_at = datetime.utcnow() + timedelta(days=duration_months * 30)

            # 2. Lisans anahtarını kullanıldı olarak işaretle
            logger.info("[ProfileService] Anahtar kullanıldı olarak işaretleniyor...")
            await asyncio.to_thread(license_ref.update, {
                'is_used': True,
                'used_by': uid,
                'used_by_email': user_email,
                'used_by_name': user_name,
                'used_at': datetime.utcnow().isoformat(),
                'expires_at': expires_at.isoformat() if expires_at else None
            })
            
            # 3. Kullanıcı profilini güncelle
            logger.info("[ProfileService] Kullanıcı profili premium'a yükseltiliyor...")
            update_data = {
                'has_premium_ai': True,
                'trial_started': True,
                'premium_until': expires_at.isoformat() if expires_at else None,
                'premium_type': license_data.get('duration_label', 'Sınırsız'),
                'updated_at': datetime.utcnow()
            }
            await asyncio.to_thread(doc_ref.set, update_data, merge=True)
            
            # 4. Bildirim gönder (Hata alsa bile ana işlemi bozmasın)
            try:
                logger.info("[ProfileService] Tebrik bildirimi gönderiliyor...")
                await asyncio.to_thread(db.collection('notifications').add, {
                    "user_id": uid,
                    "title": "MufYard Pro Aktif! 💎",
                    "message": "Lisans anahtarınız başarıyla doğrulandı. Artık sınırsız kullanım hakkına sahipsiniz.",
                    "type": "success",
                    "read": False,
                    "created_at": datetime.utcnow()
                })
            except Exception as e:
                logger.warning(f"[ProfileService] Bildirim gönderilemedi (işlem devam ediyor): {e}")
            
            logger.info(f"[ProfileService] Aktivasyon BAŞARILI: {uid}")
            return True
        except Exception as e:
            logger.error(f"[ProfileService] Aktivasyon HATASI (uid={uid}): {e}")
            return False
    @staticmethod
    async def reset_to_trial(uid: str) -> bool:
        """
        Kullanıcıyı deneme sürümüne geri döndürür. (Kayıt tarihini bugüne çeker ve Pro'yu kapatır)
        """
        from datetime import datetime
        try:
            doc_ref = db.collection('profiles').document(uid)
            update_data = {
                'has_premium_ai': False,
                'trial_started': True,
                'account_created_at': datetime.utcnow(), # Deneme süresini baştan başlat
                'premium_until': None,
                'premium_type': None,
                'updated_at': datetime.utcnow()
            }
            await asyncio.to_thread(doc_ref.update, update_data)
            logger.info(f"[ProfileService] Kullanıcı deneme sürümüne SIFIRLANDI: {uid}")
            return True
        except Exception as e:
            logger.error(f"[ProfileService] Deneme sürümü sıfırlama hatası: {e}")
            return False

    @staticmethod
    async def cancel_premium(uid: str) -> bool:
        """
        Kullanıcının Pro üyeliğini iptal eder ama deneme süresine dokunmaz.
        """
        from datetime import datetime
        try:
            doc_ref = db.collection('profiles').document(uid)
            update_data = {
                'has_premium_ai': False,
                'premium_until': None,
                'premium_type': None,
                'updated_at': datetime.utcnow()
            }
            await asyncio.to_thread(doc_ref.update, update_data)
            logger.info(f"[ProfileService] Kullanıcı Pro üyeliği İPTAL EDİLDİ: {uid}")
            return True
        except Exception as e:
            logger.error(f"[ProfileService] Pro iptal hatası: {e}")
            return False

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
                if 'trial_started' not in p: p['trial_started'] = p.get('has_premium_ai', False)
                if 'notifications_enabled' not in p: p['notifications_enabled'] = True
                if 'role' not in p: p['role'] = "user"
                if 'two_factor_enabled' not in p: p['two_factor_enabled'] = False
                if 'verified' not in p: p['verified'] = False
                if 'created_at' not in p: p['created_at'] = p.get('updated_at', now)
                if 'updated_at' not in p: p['updated_at'] = now
                
                profiles.append(p)
            return profiles
        except Exception as e:
            logger.error(f"Error getting all profiles: {e}")
            return []

    @staticmethod
    async def generate_license_key(duration_months: int = 0):
        """Generates a unique license key and stores it in Firestore."""
        import random
        import string
        from datetime import datetime, timezone
        
        # Generate a key like MUFYARD-XXXX-XXXX-XXXX
        suffix = '-'.join([''.join(random.choices(string.ascii_uppercase + string.digits, k=4)) for _ in range(3)])
        key = f"MUFYARD-{suffix}"
        
        # Duration label for humans
        duration_label = "Sınırsız" if duration_months == 0 else f"{duration_months} Ay"
        
        try:
            await asyncio.to_thread(db.collection("license_keys").document(key).set, {
                "key": key,
                "is_used": False,
                "used_by": None,
                "used_by_email": None,
                "used_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "duration_months": duration_months,
                "duration_label": duration_label
            })
            return key
        except Exception as e:
            logger.error(f"Error generating license key: {e}")
            return None

    @staticmethod
    async def get_all_license_keys() -> List[Dict[str, Any]]:
        """Tüm lisans anahtarlarını listeler."""
        try:
            docs = await asyncio.to_thread(lambda: list(db.collection('license_keys').stream()))
            keys = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                
                # Normalize created_at for sorting
                created_at = data.get('created_at')
                if created_at:
                    if hasattr(created_at, 'isoformat'): # It's a datetime/Timestamp object
                        data['created_at'] = created_at.isoformat()
                    # If it's already a string, keep it
                else:
                    data['created_at'] = ""
                    
                keys.append(data)
            return sorted(keys, key=lambda x: x['created_at'], reverse=True)
        except Exception as e:
            logger.error(f"Lisans listeleme hatası: {e}")
            return None # Return None to indicate actual failure

    @staticmethod
    async def delete_license_key(key: str) -> bool:
        """Kullanılmamış bir lisans anahtarını siler."""
        try:
            ref = db.collection('license_keys').document(key)
            doc = await asyncio.to_thread(ref.get)
            if doc.exists:
                await asyncio.to_thread(ref.delete)
                return True
            return False
        except Exception:
            return False

    @staticmethod
    async def bulk_delete_licenses(keys: List[str]) -> Dict[str, int]:
        """Birden fazla lisans anahtarını siler. Sadece kullanılmamış olanlar silinir."""
        success_count = 0
        error_count = 0
        try:
            for key in keys:
                res = await ProfileService.delete_license_key(key)
                if res:
                    success_count += 1
                else:
                    error_count += 1
            return {"success": success_count, "error": error_count}
        except Exception as e:
            logger.error(f"Bulk delete error: {e}")
            return {"success": success_count, "error": error_count}

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
