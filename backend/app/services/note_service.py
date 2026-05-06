from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db
from app.schemas.note import NoteCreate, NoteUpdate

class NoteService:
    @staticmethod
    async def get_notes(user_id: str) -> List[Dict[str, Any]]:
        notes_ref = db.collection('notes')
        # Filter by owner_id
        query = notes_ref.where('owner_id', '==', user_id).limit(200)
        docs = await asyncio.to_thread(query.stream)
        
        notes = []
        for doc in docs:
            note_data = doc.to_dict()
            note_data['id'] = doc.id
            notes.append(note_data)
        
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
