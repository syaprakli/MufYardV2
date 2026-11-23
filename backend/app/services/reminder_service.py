from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db
from app.schemas.reminder import ReminderCreate, ReminderUpdate
from app.lib.timeutil import utcnow

class ReminderService:
    @staticmethod
    async def get_reminders(user_id: str) -> List[Dict[str, Any]]:
        reminders_ref = db.collection('reminders')

        def fetch_docs():
            docs = list(reminders_ref.where('owner_id', '==', user_id).stream())
            results = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                results.append(data)
            # Sort by expiration_date ascending
            results.sort(key=lambda x: str(x.get('expiration_date', '9999-99-99')))
            return results

        return await asyncio.to_thread(fetch_docs)

    @staticmethod
    async def create_reminder(reminder: ReminderCreate, user_id: str) -> Dict[str, Any]:
        reminders_ref = db.collection('reminders')
        now_iso = utcnow().isoformat()
        
        data = reminder.model_dump()
        data['owner_id'] = user_id
        data['created_at'] = now_iso
        data['updated_at'] = now_iso

        def add_doc():
            new_doc = reminders_ref.document()
            new_doc.set(data)
            created = data.copy()
            created['id'] = new_doc.id
            return created

        return await asyncio.to_thread(add_doc)

    @staticmethod
    async def update_reminder(reminder_id: str, reminder_update: ReminderUpdate, user_id: str) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('reminders').document(reminder_id)

        def perform_update():
            doc = doc_ref.get()
            if not doc.exists:
                return None
            current_data = doc.to_dict()
            if current_data.get('owner_id') != user_id:
                return None

            update_dict = {k: v for k, v in reminder_update.model_dump(exclude_unset=True).items() if v is not None}
            update_dict['updated_at'] = utcnow().isoformat()
            
            doc_ref.update(update_dict)
            current_data.update(update_dict)
            current_data['id'] = doc.id
            return current_data

        return await asyncio.to_thread(perform_update)

    @staticmethod
    async def delete_reminder(reminder_id: str, user_id: str) -> bool:
        doc_ref = db.collection('reminders').document(reminder_id)

        def perform_delete():
            doc = doc_ref.get()
            if not doc.exists:
                return False
            if doc.to_dict().get('owner_id') != user_id:
                return False
            doc_ref.delete()
            return True

        return await asyncio.to_thread(perform_delete)
