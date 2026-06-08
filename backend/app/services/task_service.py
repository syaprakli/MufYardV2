from datetime import datetime, timedelta
import asyncio
from typing import List, Optional, Dict, Any
import uuid
from app.lib.firebase_admin import db
from app.schemas.task import TaskCreate, TaskUpdate
import pandas as pd
import io

_task_creation_lock = asyncio.Lock()

class TaskService:
    @staticmethod
    def _extract_rapor_seq(rapor_kodu: str, year: int, prefix: str = "S.Y.64") -> Optional[int]:
        """S.Y.64/YYYY-N formatindan N degerini doner."""
        if not rapor_kodu:
            return None
        expected_prefix = f"{prefix}/{year}-"
        if not rapor_kodu.startswith(expected_prefix):
            return None
        tail = rapor_kodu[len(expected_prefix):].strip()
        if not tail.isdigit():
            return None
        value = int(tail)
        return value if value > 0 else None

    @staticmethod
    def _is_final_code(code: str) -> bool:
        """S.Y.64/YYYY-N formatında olup olmadığını kontrol eder."""
        if not code:
            return False
        parts = code.split('/')
        if len(parts) != 2:
            return False
        if parts[0] != "S.Y.64":
            return False
        tail = parts[1].split('-')
        if len(tail) != 2:
            return False
        return tail[0].isdigit() and len(tail[0]) == 4 and tail[1].isdigit()

    @staticmethod
    async def _generate_rapor_kodu(year: Optional[int] = None) -> str:
        """Auto-generate S.Y.64/YYYY-N format rapor kodu.

        Var olan kodlar icinde en kucuk bos numarayi (gap filling) verir.
        """
        if year is None:
            year = datetime.utcnow().year

        try:
            # Sadece rapor_kodu alanini cek
            docs = await asyncio.to_thread(
                lambda: list(
                    db.collection('tasks')
                    .limit(1000)
                    .select(['rapor_kodu'])
                    .stream()
                )
            )

            used_numbers = set()
            for doc in docs:
                kodu = (doc.to_dict() or {}).get('rapor_kodu', '')
                seq = TaskService._extract_rapor_seq(kodu, year)
                if seq is not None:
                    used_numbers.add(seq)

            count = 1
            while count in used_numbers:
                count += 1
        except Exception as e:
            print(f"rapor_kodu generate error: {e}")
            count = 1

        return f"S.Y.64/{year}-{count}"

    @staticmethod
    async def get_tasks(user_id: Optional[str] = None, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        tasks_ref = db.collection('tasks')
        
        if not user_id and not user_email: return []
        
        try:
            # 1. Admin/Demo bypass
            admin_id = "sefa.yaprakli@gsb.gov.tr"
            if user_id == admin_id or user_email == admin_id or user_id == "admin":
                docs = await asyncio.to_thread(lambda: tasks_ref.order_by('created_at', direction='DESCENDING').limit(500).stream())
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

        owner_id = task_data.get('owner_id')
        assigned = task_data.get('assigned_to', [])
        pending_uids = [uid for uid in assigned if uid != owner_id]
        task_data['pending_collaborators'] = pending_uids
        task_data['accepted_collaborators'] = []

        # Ensure owner_id is set
        if not task_data.get('owner_id'):
             task_data['owner_id'] = "sefa.yaprakli@gsb.gov.tr" # Fallback only as last resort

        try:
            async with _task_creation_lock:
                if task_data.get('parent_task_id'):
                    parent_doc_ref = db.collection('tasks').document(task_data['parent_task_id'])
                    parent_doc = await asyncio.to_thread(parent_doc_ref.get)
                    if parent_doc.exists:
                        parent_data = parent_doc.to_dict() or {}
                        task_data['rapor_kodu'] = parent_data.get('rapor_kodu')

                if not task_data.get('rapor_kodu'):
                    status = task_data.get('rapor_durumu', 'Başlanmadı')
                    bt = task_data.get('baslama_tarihi')
                    from app.lib.folder_manager import FolderManager
                    year = int(FolderManager.extract_year(bt))
                    if status in ('İncelemede', 'Tamamlandı'):
                        task_data['rapor_kodu'] = await TaskService._generate_rapor_kodu(year)
                    else:
                        import uuid
                        unique_id = uuid.uuid4().hex[:8]
                        task_data['rapor_kodu'] = f"TASLAK-{year}-{unique_id}"
                result = await asyncio.to_thread(db.collection('tasks').add, task_data)
                
            if result and result[1]:
                task_id = result[1].id
                
                # --- Auto Folder Creation Hook ---
                try:
                    from app.lib.folder_manager import FolderManager
                    bt = task_data.get('baslama_tarihi')
                    year = FolderManager.extract_year(bt)
                    
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
                    from app.services.profile_service import ProfileService
                    
                    # Resolve owner name for notification
                    owner_profile = await ProfileService.get_profile(task_data.get('owner_id'))
                    owner_display = owner_profile.get('full_name') if owner_profile else task_data.get('owner_id')
                    
                    for uid in pending_uids:
                        await NotificationService.notify_task_invitation(
                            task_id=task_id,
                            task_name=task_data.get('rapor_adi', 'Yeni Görev'),
                            owner_name=owner_display,
                            collaborator_id=uid
                        )
                except Exception as ne:
                    print(f"Notification failed: {ne}")
                
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

            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return None
            current_data = doc.to_dict() or {}

            # If parent_task_id is being updated, inherit parent's code
            new_parent_id = update_data.get('parent_task_id')
            if new_parent_id is not None:
                current_parent_id = current_data.get('parent_task_id')
                if new_parent_id != current_parent_id:
                    if new_parent_id:
                        parent_doc_ref = db.collection('tasks').document(new_parent_id)
                        parent_doc = await asyncio.to_thread(parent_doc_ref.get)
                        if parent_doc.exists:
                            parent_data = parent_doc.to_dict() or {}
                            update_data['rapor_kodu'] = parent_data.get('rapor_kodu')
                    else:
                        # Parent cleared, generate a code if we don't have one
                        if not update_data.get('rapor_kodu') and not current_data.get('rapor_kodu'):
                            status = update_data.get('rapor_durumu') or current_data.get('rapor_durumu', 'Başlanmadı')
                            bt = update_data.get('baslama_tarihi') or current_data.get('baslama_tarihi')
                            from app.lib.folder_manager import FolderManager
                            year = int(FolderManager.extract_year(bt))
                            if status in ('İncelemede', 'Tamamlandı'):
                                update_data['rapor_kodu'] = await TaskService._generate_rapor_kodu(year)
                            else:
                                import uuid
                                unique_id = uuid.uuid4().hex[:8]
                                update_data['rapor_kodu'] = f"TASLAK-{year}-{unique_id}"

            # Auto-promote to final registry code if status changes to "İncelemede" or "Tamamlandı"
            new_status = update_data.get('rapor_durumu')
            if new_status in ('İncelemede', 'Tamamlandı'):
                current_code = update_data.get('rapor_kodu') or current_data.get('rapor_kodu', '')
                if not TaskService._is_final_code(current_code):
                    # Generate next final registry code
                    parent_id = update_data.get('parent_task_id') or current_data.get('parent_task_id')
                    if parent_id:
                        # Inherit parent's code (which might be final or draft)
                        parent_doc_ref = db.collection('tasks').document(parent_id)
                        parent_doc = await asyncio.to_thread(parent_doc_ref.get)
                        if parent_doc.exists:
                            parent_data = parent_doc.to_dict() or {}
                            if parent_data.get('rapor_kodu'):
                                update_data['rapor_kodu'] = parent_data.get('rapor_kodu')
                    else:
                        bt = update_data.get('baslama_tarihi') or current_data.get('baslama_tarihi')
                        from app.lib.folder_manager import FolderManager
                        year = int(FolderManager.extract_year(bt))
                        update_data['rapor_kodu'] = await TaskService._generate_rapor_kodu(year)

            # --- Folder Renaming Hook ---
            old_start_date = current_data.get('baslama_tarihi')
            old_type = current_data.get('rapor_turu', 'Diger') or 'Diger'
            old_code = current_data.get('rapor_kodu', 'Kodsuz') or 'Kodsuz'
            old_title = current_data.get('rapor_adi', 'Basliksiz') or 'Basliksiz'

            new_start_date = update_data.get('baslama_tarihi', old_start_date)
            new_type = update_data.get('rapor_turu', old_type) or old_type
            new_code = update_data.get('rapor_kodu', old_code) or old_code
            new_title = update_data.get('rapor_adi', old_title) or old_title

            from app.lib.folder_manager import FolderManager
            old_year = FolderManager.extract_year(old_start_date)
            new_year = FolderManager.extract_year(new_start_date)

            import os

            old_path = FolderManager.get_audit_path(old_year, old_type, old_code, old_title)
            new_path = FolderManager.get_audit_path(new_year, new_type, new_code, new_title)

            if old_path != new_path and os.path.exists(old_path):
                try:
                    os.makedirs(os.path.dirname(new_path), exist_ok=True)
                    os.rename(old_path, new_path)
                    print(f"Renamed task folder from {old_path} to {new_path}")

                    # Migrate permissions in file_permissions.json
                    old_rel_prefix = FolderManager.get_audit_relative_path(old_year, old_type, old_code, old_title)
                    new_rel_prefix = FolderManager.get_audit_relative_path(new_year, new_type, new_code, new_title)

                    perms = FolderManager.load_permissions()
                    updated_perms = {}
                    for file_id, meta in perms.items():
                        if file_id == old_rel_prefix:
                            updated_perms[new_rel_prefix] = meta
                        elif file_id.startswith(old_rel_prefix + "/"):
                            new_file_id = new_rel_prefix + file_id[len(old_rel_prefix):]
                            updated_perms[new_file_id] = meta
                        else:
                            updated_perms[file_id] = meta

                    FolderManager.save_permissions(updated_perms)
                except Exception as fe:
                    print(f"Failed to rename folder: {fe}")
                    from fastapi import HTTPException
                    raise HTTPException(
                        status_code=400,
                        detail="Klasör veya içindeki bir dosya başka bir programda (örneğin Word, Excel veya Gezgin) açık olduğu için adlandırılamadı. Lütfen açık dosyaları kapatıp tekrar deneyin."
                    )

            await asyncio.to_thread(doc_ref.update, update_data)

            # Cascade: if this task's rapor_kodu changed, update all children's rapor_kodu and rename their folders
            new_rapor_kodu = update_data.get('rapor_kodu')
            if new_rapor_kodu and new_rapor_kodu != current_data.get('rapor_kodu'):
                children_docs = await asyncio.to_thread(
                    lambda: list(
                        db.collection('tasks')
                        .where('parent_task_id', '==', task_id)
                        .stream()
                    )
                )
                for child in children_docs:
                    child_data = child.to_dict() or {}
                    child_id = child.id

                    child_start_date = child_data.get('baslama_tarihi')
                    child_type = child_data.get('rapor_turu', 'Diger') or 'Diger'
                    child_code = child_data.get('rapor_kodu', 'Kodsuz') or 'Kodsuz'
                    child_title = child_data.get('rapor_adi', 'Basliksiz') or 'Basliksiz'

                    child_year = FolderManager.extract_year(child_start_date)

                    child_old_path = FolderManager.get_audit_path(child_year, child_type, child_code, child_title)
                    child_new_path = FolderManager.get_audit_path(child_year, child_type, new_rapor_kodu, child_title)

                    if child_old_path != child_new_path and os.path.exists(child_old_path):
                        try:
                            os.makedirs(os.path.dirname(child_new_path), exist_ok=True)
                            os.rename(child_old_path, child_new_path)

                            child_old_rel = FolderManager.get_audit_relative_path(child_year, child_type, child_code, child_title)
                            child_new_rel = FolderManager.get_audit_relative_path(child_year, child_type, new_rapor_kodu, child_title)

                            perms = FolderManager.load_permissions()
                            updated_perms = {}
                            for file_id, meta in perms.items():
                                if file_id == child_old_rel:
                                    updated_perms[child_new_rel] = meta
                                elif file_id.startswith(child_old_rel + "/"):
                                    new_file_id = child_new_rel + file_id[len(child_old_rel):]
                                    updated_perms[new_file_id] = meta
                                else:
                                    updated_perms[file_id] = meta
                            FolderManager.save_permissions(updated_perms)
                        except Exception as cfe:
                            print(f"Failed to rename child folder: {cfe}")

                    await asyncio.to_thread(
                        db.collection('tasks').document(child_id).update,
                        {'rapor_kodu': new_rapor_kodu}
                    )

            updated_doc_res = await asyncio.to_thread(doc_ref.get)
            updated_doc = updated_doc_res.to_dict() or {}
            updated_doc['id'] = task_id
            return updated_doc
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error updating task: {e}")
            return None

    @staticmethod
    async def accept_task(task_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('tasks').document(task_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            task_data = doc.to_dict()
            pending = task_data.get('pending_collaborators', [])
            accepted = task_data.get('accepted_collaborators', [])
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

                # --- Auto Folder Creation Hook (On Acceptance) ---
                try:
                    from app.lib.folder_manager import FolderManager
                    bt = task_data.get('baslama_tarihi')
                    year = FolderManager.extract_year(bt)
                    
                    await asyncio.to_thread(FolderManager.ensure_audit_folders,
                        year=str(year),
                        audit_type=task_data.get('rapor_turu', 'Diger'),
                        audit_code=task_data.get('rapor_kodu', 'Kodsuz'),
                        audit_title=task_data.get('rapor_adi', 'Basliksiz')
                    )
                except Exception as ef:
                    print(f"Folder creation failed on acceptance: {ef}")

                return True
            return False
        except Exception:
            return False

    @staticmethod
    async def reject_task(task_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('tasks').document(task_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            task_data = doc.to_dict()
            pending = task_data.get('pending_collaborators', [])
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

    @staticmethod
    async def delete_task(task_id: str) -> bool:
        try:
            # Önce task verisini al (klasörü silmek için bilgi lazım)
            doc_ref = db.collection('tasks').document(task_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if doc.exists:
                task_data = doc.to_dict()
                           # Klasörü de temizle (opsiyonel ama ghost dosya kalmaması için iyi)
                try:
                    from app.lib.folder_manager import FolderManager
                    import shutil
                    import os
                    
                    bt = task_data.get('baslama_tarihi')
                    year = FolderManager.extract_year(bt)
                    
                    audit_path = FolderManager.get_audit_path(
                        year=str(year),
                        audit_type=task_data.get('rapor_turu', 'Diger'),
                        audit_code=task_data.get('rapor_kodu', 'Kodsuz'),
                        audit_title=task_data.get('rapor_adi', 'Basliksiz')
                    )
                    
                    if os.path.exists(audit_path):
                        # Klasör boş değilse de siler (rmtree)
                        await asyncio.to_thread(shutil.rmtree, audit_path)
                except Exception as ef:
                    print(f"Task folder deletion failed: {ef}")

                # Alt görevleri de sil (öksüz/ orphaned görev kalmasını önlemek için)
                try:
                    children = await asyncio.to_thread(
                        lambda: list(
                            db.collection('tasks')
                            .where('parent_task_id', '==', task_id)
                            .stream()
                        )
                    )
                    for child in children:
                        await asyncio.to_thread(db.collection('tasks').document(child.id).delete)
                except Exception as ec:
                    print(f"Child tasks deletion failed: {ec}")

                await asyncio.to_thread(doc_ref.delete)
                return True
            return False
        except Exception:
            return False

    @staticmethod
    async def import_tasks_from_excel(file_content: bytes, owner_id: str) -> Dict[str, Any]:
        """Excel dosyasından görevleri içe aktarır."""
        try:
            df = await asyncio.to_thread(pd.read_excel, io.BytesIO(file_content))
            
            # Kolon isimlerini normalize et (küçük harf ve boşluksuz)
            df.columns = [str(c).strip().lower().replace(' ', '_').replace('ı', 'i').replace('ş', 's').replace('ç', 'c').replace('ö', 'o').replace('ü', 'u').replace('ğ', 'g') for c in df.columns]
            
            # Zorunlu kolonlar: rapor_adi
            if 'rapor_adi' not in df.columns:
                # Alternatif isimleri dene
                for alt in ['rapor_adi', 'konu', 'baslik', 'rapor_ismi']:
                    if alt in df.columns:
                        df.rename(columns={alt: 'rapor_adi'}, inplace=True)
                        break
            
            if 'rapor_adi' not in df.columns:
                return {"status": "error", "message": "Excel'de 'Rapor Adı' kolonu bulunamadı."}

            imported_count = 0
            for _, row in df.iterrows():
                if pd.isna(row['rapor_adi']): continue
                
                # TaskCreate şemasına uygun veri hazırla
                task_data = {
                    "rapor_adi": str(row['rapor_adi']),
                    "rapor_kodu": str(row.get('rapor_kodu')) if not pd.isna(row.get('rapor_kodu')) else None,
                    "rapor_turu": str(row.get('rapor_turu', 'Genel Denetim')),
                    "baslama_tarihi": str(row.get('baslama_tarihi')) if not pd.isna(row.get('baslama_tarihi')) else datetime.utcnow().isoformat().split('T')[0],
                    "sure_gun": int(row.get('sure_gun', 30)),
                    "rapor_durumu": str(row.get('durum', 'Tamamlandı')), # İçe aktarılanlar genelde tamamlanmıştır
                    "owner_id": owner_id,
                    "assigned_to": [owner_id],
                    "steps": []
                }
                
                # TaskCreate nesnesi oluştur ve kaydet
                task_obj = TaskCreate(**task_data)
                await TaskService.create_task(task_obj)
                imported_count += 1
                
            return {"status": "success", "imported": imported_count}
        except Exception as e:
            print(f"Excel import error: {e}")
            return {"status": "error", "message": str(e)}
