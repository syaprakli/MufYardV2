from datetime import datetime, timedelta
import asyncio
from typing import List, Optional, Dict, Any
import uuid
from app.lib.firebase_admin import db
from app.schemas.task import TaskCreate, TaskUpdate

class TaskService:
    @staticmethod
    async def _generate_rapor_kodu(year: Optional[int] = None) -> str:
        """Auto-generate S.Y.64/YYYY-N format rapor kodu (Verimli sayac)."""
        if year is None:
            year = datetime.utcnow().year
        try:
            # count().get() is blocking
            res = await asyncio.to_thread(lambda: db.collection('tasks').count().get())
            count = res[0][0].value + 1
        except Exception:
            # Fallback
            docs = await asyncio.to_thread(lambda: list(db.collection('tasks').select(['owner_id']).stream()))
            count = len(docs) + 1
        return f"S.Y.64/{year}-{count}"

    @staticmethod
    async def get_tasks(user_id: Optional[str] = None, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        tasks_ref = db.collection('tasks')
        
        if not user_id and not user_email: return []
        
        try:
            # 1. Admin/Demo bypass
            admin_id = "mufettis@gsb.gov.tr"
            if user_id == admin_id or user_email == admin_id or user_id == "admin":
                docs = await asyncio.to_thread(lambda: tasks_ref.order_by('created_at', direction='DESCENDING').stream())
                return [ {**doc.to_dict(), 'id': doc.id} for doc in docs ]

            # 2. Parallel Queries with asyncio.gather
            async def run_query(q):
                if q is None: return []
                return await asyncio.to_thread(lambda: list(q.stream()))
            
            queries = [
                tasks_ref.where('owner_id', '==', user_id) if user_id else None,
                tasks_ref.where('owner_id', '==', user_email) if user_email else None,
                tasks_ref.where('assigned_to', 'array_contains', user_id) if user_id else None,
                tasks_ref.where('assigned_to', 'array_contains', user_email) if user_email else None,
                tasks_ref.where('shared_with', 'array_contains', user_id) if user_id else None,
                tasks_ref.where('shared_with', 'array_contains', user_email) if user_email else None,
                tasks_ref.where('accepted_collaborators', 'array_contains', user_id) if user_id else None,
                tasks_ref.where('accepted_collaborators', 'array_contains', user_email) if user_email else None,
                tasks_ref.where('pending_collaborators', 'array_contains', user_id) if user_id else None,
                tasks_ref.where('pending_collaborators', 'array_contains', user_email) if user_email else None
            ]

            results = await asyncio.gather(*(run_query(q) for q in queries))
            
            all_docs = []
            for res in results: all_docs.extend(res)

            unique_tasks = {}
            for doc in all_docs:
                if doc.id not in unique_tasks:
                    d = doc.to_dict()
                    d['id'] = doc.id
                    unique_tasks[doc.id] = d
            
            res = list(unique_tasks.values())
            def sort_key(x):
                val = x.get('created_at', '')
                if hasattr(val, 'timestamp'): return val.timestamp()
                return str(val)

            res.sort(key=sort_key, reverse=True)
            return res
        except Exception as e:
            print(f"Task query error: {e}")
            return []

    @staticmethod
    async def create_task(task: TaskCreate) -> Dict[str, Any]:
        task_data = task.dict()
        task_data['created_at'] = datetime.utcnow().isoformat()

        if not task_data.get('rapor_kodu'):
            task_data['rapor_kodu'] = await TaskService._generate_rapor_kodu()

        owner_id = task_data.get('owner_id')
        assigned = task_data.get('assigned_to', [])
        pending_uids = [uid for uid in assigned if uid != owner_id]
        task_data['pending_collaborators'] = pending_uids
        task_data['accepted_collaborators'] = []

        # Ensure owner_id is set
        if not task_data.get('owner_id'):
             task_data['owner_id'] = "mufettis@gsb.gov.tr" # Fallback only as last resort

        try:
            result = await asyncio.to_thread(db.collection('tasks').add, task_data)
            if result and result[1]:
                task_id = result[1].id
                
                # --- Auto Folder Creation Hook ---
                try:
                    from app.lib.folder_manager import FolderManager
                    bt = task_data.get('baslama_tarihi')
                    year = datetime.now().year
                    if bt:
                        try:
                            # Handle YYYY-MM-DD or ISO formats
                            if '-' in bt and len(bt) >= 10:
                                year = int(bt.split('-')[0])
                        except Exception:
                            pass
                    
                    await asyncio.to_thread(FolderManager.ensure_audit_folders,
                        year=str(year),
                        audit_type=task_data.get('rapor_turu', 'Diger'),
                        audit_code=task_data.get('rapor_kodu', 'Kodsuz'),
                        audit_title=task_data.get('rapor_adi', 'Basliksiz')
                    )
                except Exception as ef:
                    print(f"Folder creation failed: {ef}")

                try:
                    from app.services.notification_service import NotificationService
                    for uid in pending_uids:
                        await NotificationService.notify_task_invitation(
                            task_id=task_id,
                            task_name=task_data.get('rapor_adi', 'Yeni Görev'),
                            owner_name=task_data.get('owner_id'),
                            collaborator_id=uid
                        )
                except Exception:
                    pass
                
                doc = await asyncio.to_thread(result[1].get)
                if doc and doc.exists:
                    new_task = doc.to_dict() or {}
                    new_task['id'] = task_id
                    return new_task
        except Exception as ge:
            print(f"Error in create_task: {ge}")
            pass

        # Fallback (non-persistent)
        task_data['id'] = str(uuid.uuid4())
        return task_data

    @staticmethod
    async def update_task(task_id: str, task_update: TaskUpdate) -> Optional[Dict[str, Any]]:
        try:
            doc_ref = db.collection('tasks').document(task_id)
            update_data = {k: v for k, v in task_update.dict().items() if v is not None}
            if not update_data:
                return None
            await asyncio.to_thread(doc_ref.update, update_data)
            updated_doc_res = await asyncio.to_thread(doc_ref.get)
            updated_doc = updated_doc_res.to_dict() or {}
            updated_doc['id'] = task_id
            return updated_doc
        except Exception:
            return None

    @staticmethod
    async def accept_task(task_id: str, user_id: str) -> bool:
        try:
            doc_ref = db.collection('tasks').document(task_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            task_data = doc.to_dict()
            pending = task_data.get('pending_collaborators', [])
            accepted = task_data.get('accepted_collaborators', [])
            
            if user_id in pending:
                pending.remove(user_id)
                if user_id not in accepted:
                    accepted.append(user_id)
                
                await asyncio.to_thread(doc_ref.update, {
                    'pending_collaborators': pending,
                    'accepted_collaborators': accepted
                })
                return True
            return False
        except Exception:
            return False

    @staticmethod
    async def delete_task(task_id: str) -> bool:
        try:
            await asyncio.to_thread(lambda: db.collection('tasks').document(task_id).delete())
            return True
        except Exception:
            return False
