from datetime import datetime
import asyncio
from typing import List, Optional, Dict, Any
from app.lib.firebase_admin import db
from app.schemas.note import NoteCreate, NoteUpdate
from app.lib.timeutil import utcnow


def _fetch_profile_names(uids: List[str]) -> Dict[str, str]:
    """uid -> full_name; Firestore get_all ile tek seferde (e-posta gibi geçersiz ID'ler atlanır)."""
    valid = [u for u in uids if u and "/" not in u]
    if not valid:
        return {}
    refs = [db.collection('profiles').document(u) for u in valid]
    names: Dict[str, str] = {}
    try:
        get_all = getattr(db, "get_all", None)
        snapshots = get_all(refs, field_paths=['full_name']) if callable(get_all) else [r.get() for r in refs]
        for snap in snapshots:
            if snap.exists:
                full_name = (snap.to_dict() or {}).get('full_name')
                if full_name:
                    names[snap.id] = full_name
    except Exception:
        pass
    return names

class NoteService:
    @staticmethod
    async def get_notes(user_id: str, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        notes_ref = db.collection('notes')
        test_uid = "tolEIwlWrHfWCQduDuXcnqBvWdo2"
        test_email = "test@mufyard.com"
        is_test_user = (user_id == test_uid or (user_email and user_email.lower() == test_email))
        
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
                if not is_test_user:
                    note_owner = d.get('owner_id', '')
                    if note_owner in [test_uid, test_email]:
                        continue
                unique_notes[doc.id] = d
        
        notes = list(unique_notes.values())
        
        # Resolve owner names
        def resolve_names():
            # Tekil sahipler tek bir toplu okumayla çözülür (not başına ayrı okuma yok).
            owner_ids = sorted({n.get('owner_id') for n in notes if n.get('owner_id')})
            names = _fetch_profile_names(owner_ids)
            for n in notes:
                oid = n.get('owner_id')
                n['owner_name'] = (names.get(oid) or oid) if oid else 'Bilinmeyen'

        if notes:
            await asyncio.to_thread(resolve_names)

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
        note_data = note.model_dump()
        note_data['created_at'] = utcnow()
        
        owner_id = note_data.get('owner_id')
        shared = note_data.get('shared_with', [])
        # Kendi paylaştığımız kişileri başlangıçta 'bekleyen' durumuna alıyoruz
        note_data['pending_collaborators'] = [uid for uid in shared if uid != owner_id]
        note_data['accepted_collaborators'] = []

        doc_ref = await asyncio.to_thread(db.collection('notes').add, note_data)
        
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        new_note = new_doc.to_dict()
        new_note['id'] = doc_ref[1].id

        # Send notifications
        pending = note_data.get('pending_collaborators', [])
        if pending:
            try:
                from app.services.notification_service import NotificationService
                from app.services.profile_service import ProfileService
                
                owner_profile = await ProfileService.get_profile(owner_id)
                owner_display = owner_profile.get('full_name') if owner_profile else owner_id
                
                for collaborator_id in pending:
                    try:
                        target_uid = collaborator_id
                        if "@" in collaborator_id:
                            profiles_query = db.collection('profiles').where('email', '==', collaborator_id.lower().strip()).limit(1)
                            profiles = await asyncio.to_thread(lambda: list(profiles_query.stream()))
                            if profiles:
                                target_uid = profiles[0].id
                        
                        await NotificationService.notify_note_invitation(
                            note_id=new_note['id'],
                            note_title=note_data.get('title', 'Yeni Not'),
                            owner_name=owner_display,
                            collaborator_id=target_uid
                        )
                    except Exception as inner_err:
                        print(f"[NOTIF] Create note inner notify error: {inner_err}")
            except Exception as outer_err:
                print(f"[NOTIF] Create note outer notify error: {outer_err}")

        return new_note


    @staticmethod
    async def update_note(note_id: str, note_update: NoteUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('notes').document(note_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            return None
        current_data = doc.to_dict() or {}
            
        update_data = {k: v for k, v in note_update.model_dump().items() if v is not None}
        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['id'] = note_id

        # Send notifications if pending_collaborators changed
        if 'pending_collaborators' in update_data:
            old_pending = current_data.get('pending_collaborators', [])
            new_pending = update_data['pending_collaborators'] or []
            added_collaborators = [c for c in new_pending if c not in old_pending]
            
            if added_collaborators:
                try:
                    from app.services.notification_service import NotificationService
                    from app.services.profile_service import ProfileService
                    
                    owner_id = current_data.get('owner_id')
                    owner_profile = await ProfileService.get_profile(owner_id)
                    owner_display = owner_profile.get('full_name') if owner_profile else owner_id
                    
                    for collaborator_id in added_collaborators:
                        try:
                            target_uid = collaborator_id
                            if "@" in collaborator_id:
                                profiles_query = db.collection('profiles').where('email', '==', collaborator_id.lower().strip()).limit(1)
                                profiles = await asyncio.to_thread(lambda: list(profiles_query.stream()))
                                if profiles:
                                    target_uid = profiles[0].id
                            
                            await NotificationService.notify_note_invitation(
                                note_id=note_id,
                                note_title=current_data.get('title', 'Yeni Not'),
                                owner_name=owner_display,
                                collaborator_id=target_uid
                            )
                        except Exception as inner_err:
                            print(f"[NOTIF] Update note inner notify error: {inner_err}")
                except Exception as outer_err:
                    print(f"[NOTIF] Update note outer notify error: {outer_err}")

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
