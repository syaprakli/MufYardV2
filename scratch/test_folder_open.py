import sys
import os
import asyncio
from datetime import datetime

sys.path.append(os.path.join(os.getcwd(), 'backend'))

async def main():
    try:
        from app.lib.firebase_admin import db
        from app.lib.folder_manager import FolderManager
        
        task_id = "GnytZEN2jx1DWFpODZTd"
        current_user = {
            "uid": "VKV8SfuNkWf9WeTYeSCTizd4oG83",
            "role": "inspector"
        }
        
        task_ref = db.collection('tasks').document(str(task_id))
        task_doc = await asyncio.to_thread(task_ref.get)
        if not task_doc.exists:
            print("ERROR: Task not found")
            return
            
        task_data = task_doc.to_dict() or {}
        print("Task Data resolved successfully.")
        
        # Calculate year, type, code, title
        start_date_str = task_data.get('baslama_tarihi')
        year = str(datetime.utcnow().year)
        if isinstance(start_date_str, str) and start_date_str:
            try:
                year = str(datetime.fromisoformat(start_date_str).year)
            except Exception:
                pass
                
        audit_type = task_data.get('rapor_turu', 'Diger') or 'Diger'
        audit_code = task_data.get('rapor_kodu', 'Kodsuz') or 'Kodsuz'
        audit_title = task_data.get('rapor_adi', 'Basliksiz') or 'Basliksiz'
        
        # Permission check based on task owner, assignees, collaborators
        owner_id = task_data.get('owner_id')
        assigned_to = task_data.get('assigned_to') or []
        accepted_collaborators = task_data.get('accepted_collaborators') or []
        shared_with = task_data.get('shared_with') or []
        
        uid = current_user["uid"]
        is_owner = uid == owner_id
        is_assigned = uid in assigned_to
        is_collaborator = uid in accepted_collaborators or uid in shared_with
        is_admin = current_user.get("role") == "admin"
        
        print(f"Permissions: is_owner={is_owner}, is_assigned={is_assigned}, is_collaborator={is_collaborator}, is_admin={is_admin}")
        
        if not (is_owner or is_assigned or is_collaborator or is_admin):
            print("ERROR: Unauthorized access")
            return
            
        audit_rel_path = FolderManager.get_audit_relative_path(
            year,
            audit_type,
            audit_code,
            audit_title
        )
        print("Audit Relative Path:", audit_rel_path)
        
        # Register/Sync permissions in file_permissions.json
        allowed_users = list(set([owner_id or uid] + assigned_to + accepted_collaborators + shared_with))
        permissions_dict = {
            "read": allowed_users,
            "write": allowed_users,
            "delete": [owner_id or uid]
        }
        print("Registering permissions for users:", allowed_users)
        await asyncio.to_thread(
            FolderManager.set_permission,
            audit_rel_path,
            owner_id or uid,
            allowed_users,
            permissions_dict
        )
        print("Permissions registered successfully.")
        
        # Calculate full path
        full_path = await asyncio.to_thread(
            FolderManager.get_audit_path,
            year,
            audit_type,
            audit_code,
            audit_title
        )
        print("Full Path:", full_path)
        
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
