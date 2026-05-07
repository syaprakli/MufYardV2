from datetime import datetime, timedelta
import asyncio
from typing import List, Optional, Dict, Any
import uuid
from app.lib.firebase_admin import db
from app.schemas.audit import AuditCreate, AuditUpdate

class AuditService:
    @staticmethod
    async def get_all_audits(user_id: Optional[str] = None, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        audits_ref = db.collection('audits')
        
        if not user_id and not user_email:
            fields = ['title', 'date', 'status', 'inspector', 'location', 'owner_id', 
                      'assigned_to', 'shared_with', 'task_id', 'report_seq', 'is_public', 'created_at']
            docs = await asyncio.to_thread(lambda: audits_ref.where('is_public', '==', True).limit(200).select(fields).stream())
            return [ {**doc.to_dict(), 'id': doc.id} for doc in docs]

        # 2. Admin/Demo bypass
        admin_id = "sefa.yaprakli@gsb.gov.tr"
        if user_id == admin_id or user_email == admin_id or user_id == "admin":
            fields = ['title', 'date', 'status', 'inspector', 'location', 'owner_id', 
                      'assigned_to', 'shared_with', 'task_id', 'report_seq', 'is_public', 'created_at']
            docs = await asyncio.to_thread(lambda: audits_ref.order_by('created_at', direction='DESCENDING').limit(500).select(fields).stream())
            return [ {**doc.to_dict(), 'id': doc.id} for doc in docs]

        # 3. Parallel Queries with asyncio.gather
        async def run_query(q):
            if q is None: return []
            # Optimization: Select only metadata fields to avoid fetching large 'report_content'
            fields = ['title', 'date', 'status', 'inspector', 'location', 'owner_id', 
                      'assigned_to', 'shared_with', 'task_id', 'report_seq', 'is_public', 'created_at']
            return await asyncio.to_thread(lambda: list(q.select(fields).stream()))

        queries = [
            audits_ref.where('owner_id', '==', user_id) if user_id else None,
            audits_ref.where('owner_id', '==', user_email) if user_email else None,
            audits_ref.where('assigned_to', 'array_contains', user_id) if user_id else None,
            audits_ref.where('assigned_to', 'array_contains', user_email) if user_email else None,
            audits_ref.where('shared_with', 'array_contains', user_id) if user_id else None,
            audits_ref.where('shared_with', 'array_contains', user_email) if user_email else None,
            audits_ref.where('accepted_collaborators', 'array_contains', user_id) if user_id else None,
            audits_ref.where('accepted_collaborators', 'array_contains', user_email) if user_email else None,
            audits_ref.where('pending_collaborators', 'array_contains', user_id) if user_id else None,
            audits_ref.where('pending_collaborators', 'array_contains', user_email) if user_email else None
        ]
        
        results = await asyncio.gather(*(run_query(q) for q in queries))
        
        all_docs = []
        for res in results: all_docs.extend(res)

        unique_audits = {}
        for doc in all_docs:
            if doc.id not in unique_audits:
                d = doc.to_dict()
                d['id'] = doc.id
                unique_audits[doc.id] = d
        
        sorted_audits = list(unique_audits.values())
        sorted_audits.sort(key=lambda x: x.get('created_at') or x.get('date') or '', reverse=True)
        return sorted_audits

    @staticmethod
    async def get_audit(audit_id: str) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('audits').document(audit_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if doc.exists:
            audit_data = doc.to_dict()
            audit_data['id'] = doc.id
            return audit_data
        return None

    @staticmethod
    async def create_audit(audit: AuditCreate) -> Dict[str, Any]:
        audit_data = audit.dict()
        audit_data['created_at'] = datetime.utcnow().isoformat()
        
        try:
            # Add to Firestore (returns (update_time, doc_ref) tuple)
            result = await asyncio.to_thread(db.collection('audits').add, audit_data)
            if result and result[1]:
                doc = await asyncio.to_thread(result[1].get)
                if doc and doc.exists:
                    new_audit = doc.to_dict() or {}
                    new_audit['id'] = result[1].id
                    new_audit.setdefault('created_at', datetime.utcnow().isoformat())
                    return new_audit
        except Exception:
            pass
        
        # Fallback for Mock DB or any failure
        new_id = str(uuid.uuid4())
        audit_data['id'] = new_id
        return audit_data

    @staticmethod
    async def update_audit(audit_id: str, audit: AuditUpdate) -> Optional[Dict[str, Any]]:
        doc_ref = db.collection('audits').document(audit_id)
        current_doc = await asyncio.to_thread(doc_ref.get)
        if not current_doc.exists:
            return None
        current_data = current_doc.to_dict()
            
        update_data = {k: v for k, v in audit.dict().items() if v is not None}
        now = datetime.utcnow()
        update_data['updated_at'] = now.isoformat()
        
        # --- Smart Versioning Logic ---
        if 'report_content' in update_data:
            versions_ref = doc_ref.collection('versions')
            # blocking queries wrapped in thread
            last_version_docs = await asyncio.to_thread(lambda: list(versions_ref.order_by('created_at', direction='DESCENDING').limit(1).get()))
            
            should_create_version = True
            if last_version_docs:
                last_v = last_version_docs[0].to_dict()
                last_time_raw = last_v.get('created_at')
                try:
                    if isinstance(last_time_raw, str):
                        last_time = datetime.fromisoformat(last_time_raw)
                    else:
                        last_time = last_time_raw # Firestore Timestamp if exists
                    
                    if (now - last_time) < timedelta(minutes=30):
                        should_create_version = False
                except Exception:
                    pass
            
            if should_create_version:
                version_data = {
                    "version_name": f"v.{now.strftime('%H:%M')}",
                    "report_content": current_data.get('report_content', ''),
                    "created_at": now.isoformat(),
                    "user": "Müfettiş"
                }
                await asyncio.to_thread(versions_ref.add, version_data)

        await asyncio.to_thread(doc_ref.update, update_data)
        
        updated_doc_res = await asyncio.to_thread(doc_ref.get)
        updated_doc = updated_doc_res.to_dict()
        updated_doc['id'] = audit_id
        return updated_doc

    @staticmethod
    async def get_audit_versions(audit_id: str) -> List[Dict[str, Any]]:
        versions_ref = db.collection('audits').document(audit_id).collection('versions')
        docs = await asyncio.to_thread(lambda: versions_ref.order_by('created_at', direction='DESCENDING').limit(50).stream())
        
        versions = []
        for doc in docs:
            v_data = doc.to_dict()
            v_data['id'] = doc.id
            versions.append(v_data)
        return versions

    @staticmethod
    async def restore_audit_version(audit_id: str, version_id: str) -> Optional[Dict[str, Any]]:
        audit_ref = db.collection('audits').document(audit_id)
        version_ref = audit_ref.collection('versions').document(version_id)
        
        v_doc = await asyncio.to_thread(version_ref.get)
        if not v_doc.exists:
            return None
            
        v_data = v_doc.to_dict()
        restore_content = v_data.get('report_content', '')
        
        await asyncio.to_thread(audit_ref.update, {
            "report_content": restore_content,
            "updated_at": datetime.utcnow().isoformat()
        })
        
        return await AuditService.get_audit(audit_id)

    @staticmethod
    async def delete_audit(audit_id: str) -> bool:
        doc_ref = db.collection('audits').document(audit_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            return False
            
        await asyncio.to_thread(doc_ref.delete)
        return True

    @staticmethod
    async def accept_audit(audit_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('audits').document(audit_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            audit_data = doc.to_dict()
            pending = audit_data.get('pending_collaborators', [])
            accepted = audit_data.get('accepted_collaborators', [])
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
    async def reject_audit(audit_id: str, user_id: Optional[str], user_email: Optional[str] = None) -> bool:
        try:
            doc_ref = db.collection('audits').document(audit_id)
            doc = await asyncio.to_thread(doc_ref.get)
            if not doc.exists:
                return False
            
            audit_data = doc.to_dict()
            pending = audit_data.get('pending_collaborators', [])
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
