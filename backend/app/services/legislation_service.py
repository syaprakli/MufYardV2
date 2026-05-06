import os
import shutil
import asyncio
import tempfile
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db, bucket
from app.schemas.legislation import LegislationCreate, LegislationUpdate
from fastapi import UploadFile

from app.config import get_settings
settings = get_settings()
MEVZUAT_DIR = settings.MEVZUAT_DIR

class LegislationService:
    @staticmethod
    async def get_legislations(user_id: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
        legislations_ref = db.collection('legislations')
        
        # Base query: Public items that are NOT archived
        public_query = legislations_ref.where('is_public', '==', True).where('is_archived', '==', False).limit(300)
        if category and category != 'All' and category != 'Tümü':
            public_query = public_query.where('category', '==', category)
            
        docs = await asyncio.to_thread(lambda: list(public_query.stream()))
        
        # Private items for specific user that are NOT archived
        if user_id:
            private_query = legislations_ref.where('is_public', '==', False).where('owner_id', '==', user_id).where('is_archived', '==', False).limit(100)
            if category and category != 'All' and category != 'Tümü':
                private_query = private_query.where('category', '==', category)
            private_docs = await asyncio.to_thread(lambda: list(private_query.stream()))
            docs.extend(private_docs)

        legislations = []
        for doc in docs:
            leg_data = doc.to_dict()
            leg_data['id'] = doc.id
            legislations.append(leg_data)
            
        # Memory sort for pinned items
        return sorted(legislations, key=lambda x: x.get('is_pinned', False), reverse=True)

    @staticmethod
    async def save_legislation_file(
        file: UploadFile,
        category: str,
        doc_type: str = "",
        user_id: Optional[str] = None,
        is_public: bool = True
    ) -> str:
        """
        PUBLIC  → Firebase Storage (accessible from every computer, no server needed)
        PRIVATE → Local disk under Mevzuat/Kisisel/{uid}/
        """
        filename = file.filename.replace(" ", "_")
        name, ext = os.path.splitext(filename)

        # ── PUBLIC: Upload to Firebase Storage ─────────────────────────────────
        if is_public:
            # Build a unique blob path inside the bucket
            timestamp = int(datetime.utcnow().timestamp())
            if doc_type:
                blob_path = f"mevzuat/{category}/{doc_type}/{name}_{timestamp}{ext}"
            else:
                blob_path = f"mevzuat/{category}/{name}_{timestamp}{ext}"

            def _upload():
                try:
                    blob = bucket.blob(blob_path)
                    file.file.seek(0)
                    blob.upload_from_file(
                        file.file,
                        content_type=file.content_type or "application/octet-stream",
                    )
                    blob.make_public()
                    return blob.public_url
                except Exception as e:
                    if "does not exist" in str(e).lower() or "404" in str(e):
                        raise Exception("Firebase Storage bucket başlatılmamış. Lütfen Firebase Console'dan Storage bölümüne gidip 'Get Started' butonuna tıklayarak Storage'ı aktif hale getirin.")
                    raise e

            public_url = await asyncio.to_thread(_upload)
            return public_url  # e.g. https://storage.googleapis.com/mufyardv2.appspot.com/mevzuat/...

        # ── PRIVATE: Save to local disk ─────────────────────────────────────────
        if not is_public and user_id:
            target_dir = os.path.join(MEVZUAT_DIR, "Kisisel", user_id, category)
        elif doc_type:
            target_dir = os.path.join(MEVZUAT_DIR, category, doc_type)
        else:
            target_dir = os.path.join(MEVZUAT_DIR, category)

        os.makedirs(target_dir, exist_ok=True)

        file_path = os.path.join(target_dir, filename)
        if os.path.exists(file_path):
            filename = f"{name}_{int(datetime.utcnow().timestamp())}{ext}"
            file_path = os.path.join(target_dir, filename)

        def _write():
            file.file.seek(0)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        await asyncio.to_thread(_write)

        if not is_public and user_id:
            return f"/Mevzuat/Kisisel/{user_id}/{category}/{filename}"
        if doc_type:
            return f"/Mevzuat/{category}/{doc_type}/{filename}"
        return f"/Mevzuat/{category}/{filename}"


    @staticmethod
    async def create_legislation(legislation: LegislationCreate, is_admin: bool = False) -> Dict[str, Any]:
        leg_data = legislation.dict()
        leg_data['created_at'] = datetime.utcnow()
        if 'is_archived' not in leg_data:
            leg_data['is_archived'] = False
        
        # Onay mekanizması
        if not is_admin and leg_data.get('is_public', True):
            leg_data['is_approved'] = False
        else:
            leg_data['is_approved'] = True
            
        doc_ref = await asyncio.to_thread(db.collection('legislations').add, leg_data)
        
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        new_leg = new_doc.to_dict()
        new_leg['id'] = doc_ref[1].id
        return new_leg

    @staticmethod
    async def approve_legislation(legislation_id: str, admin_name: str) -> bool:
        doc_ref = db.collection('legislations').document(legislation_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
            
        await asyncio.to_thread(doc_ref.update, {
            'is_approved': True,
            'approved_by': admin_name,
            'approved_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        })
        return True

    @staticmethod
    async def reject_legislation(legislation_id: str) -> bool:
        # Reddedilirse tamamen silebiliriz veya 'rejected' statusü verebiliriz.
        # Kullanıcının talebine göre: "onay bekleyenler", silebiliriz.
        doc_ref = db.collection('legislations').document(legislation_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
        
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def update_legislation(legislation_id: str, leg_update: LegislationUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('legislations').document(legislation_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return None
            
        update_data = {k: v for k, v in leg_update.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['id'] = legislation_id
        return updated_doc

    @staticmethod
    async def delete_legislation(legislation_id: str) -> bool:
        doc_ref = db.collection('legislations').document(legislation_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return False
            
        leg_data = doc.to_dict()
        
        # IF PUBLIC: archive instead of delete
        if leg_data.get('is_public', True):
            await asyncio.to_thread(doc_ref.update, {'is_archived': True, 'updated_at': datetime.utcnow()})
            return True
        
        # IF PRIVATE: hard delete from Firestore
        await asyncio.to_thread(doc_ref.delete)
        
        # Optional: Delete physical file if it's personal?
        # We'll leave it for now to avoid accidental disk data loss.
        return True

    @staticmethod
    async def promote_to_public(legislation_id: str, user_name: str) -> Optional[Dict[str, Any]]:
        """Promotes a private legislation record to public shared library."""
        doc_ref = db.collection('legislations').document(legislation_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return None
            
        leg_data = doc.to_dict()
        if leg_data.get('is_public', False):
            return leg_data # Already public
            
        # 1. Update metadata
        update_data = {
            'is_public': True,
            'owner_id': None, # Now owned by the organization
            'last_updated_by_name': user_name,
            'updated_at': datetime.utcnow()
        }
        
        # 2. (Optional) In a real system, we would move the physical file from Kisisel/ to Genel/
        # But for simplicity and URL stability, we'll keep the file where it is but make it public in UI.
        # Actually, let's update the local_path if it contains 'Kisisel' to show it's now shared.
        # For now, just updating Firestore is enough to make it visible to everyone.
        
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc = (await asyncio.to_thread(doc_ref.get)).to_dict()
        updated_doc['id'] = legislation_id
        return updated_doc

