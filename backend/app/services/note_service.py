from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db
from app.schemas.note import NoteCreate, NoteUpdate

class NoteService:
    @staticmethod
    async def get_notes(user_id: str, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        notes_ref = db.collection('notes')
        
        async def run_query(q):
            if q is None: return []
            return await asyncio.to_thread(lambda: list(q.stream()))
            
        queries = [
            notes_ref.where('owner_id', '==', user_id),
            notes_ref.where('shared_with', 'array_contains', user_id) if user_id else None,
            notes_ref.where('shared_with', 'array_contains', user_email) if user_email else None,
            notes_ref.where('accepted_collaborators', 'array_contains', user_id) if user_id else None,
            notes_ref.where('accepted_collaborators', 'array_contains', user_email) if user_email else None,
            notes_ref.where('pending_collaborators', 'array_contains', user_id) if user_id else None,
            notes_ref.where('pending_collaborators', 'array_contains', user_email) if user_email else None
        ]

        results = await asyncio.gather(*(run_query(q) for q in queries))
        
        all_docs = []
        for res in results: all_docs.extend(res)

        unique_notes = {}
        for doc in all_docs:
            if doc.id not in unique_notes:
                d = doc.to_dict()
                d['id'] = doc.id
                unique_notes[doc.id] = d
        
        notes = list(unique_notes.values())
        
        # Sort in memory: Pinned first, then by created_at descending
        def sort_key(x):
            pinned = 1 if x.get('is_pinned', False) else 0
            # Handle different date types safely
            created = x.get('created_at', '')
            if hasattr(created, 'timestamp'):
                created = created.isoformat()
            return (pinned, str(created))

        notes.sort(key=sort_key, reverse=True)
        return notes



    @staticmethod
    async def create_note(note: NoteCreate) -> Dict[str, Any]:
        note_data = note.dict()
        note_data['created_at'] = datetime.utcnow()
        
        owner_id = note_data.get('owner_id')
        shared = note_data.get('shared_with', [])
        # Kendi paylaştığımız kişileri başlangıçta 'bekleyen' durumuna alıyoruz
        note_data['pending_collaborators'] = [uid for uid in shared if uid != owner_id]
        note_data['accepted_collaborators'] = []

        doc_ref = await asyncio.to_thread(db.collection('notes').add, note_data)
        
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        new_note = new_doc.to_dict()
        new_note['id'] = doc_ref[1].id
        return new_note


    @staticmethod
    async def update_note(note_id: str, note_update: NoteUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('notes').document(note_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return None
            
        update_data = {k: v for k, v in note_update.dict().items() if v is not None}
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['id'] = note_id
        return updated_doc

    @staticmethod
    async def delete_note(note_id: str) -> bool:
        doc_ref = db.collection('notes').document(note_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def accept_note(note_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('notes').document(note_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            note_data = doc.to_dict()
            pending = note_data.get('pending_collaborators', [])
            accepted = note_data.get('accepted_collaborators', [])
            identity_keys = [value for value in [user_id, user_email] if value]
            
            matched_identity = next((value for value in identity_keys if value in pending), None)

            if matched_identity:
                pending = [value for value in pending if value not in identity_keys]
                for identity in identity_keys:
                    if identity not in accepted:
                        accepted.append(identity)
                
                await asyncio.to_thread(doc_ref.update, {
                    'pending_collaborators': pending,
                    'accepted_collaborators': accepted
                })
                return True
            return False
        except Exception:
            return False

    @staticmethod
    async def reject_note(note_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('notes').document(note_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            note_data = doc.to_dict()
            pending = note_data.get('pending_collaborators', [])
            identity_keys = [value for value in [user_id, user_email] if value]
            
            matched_identity = next((value for value in identity_keys if value in pending), None)

            if matched_identity:
                pending = [value for value in pending if value not in identity_keys]
                await asyncio.to_thread(doc_ref.update, {
                    'pending_collaborators': pending
                })
                return True
            return False
        except Exception:
            return False
