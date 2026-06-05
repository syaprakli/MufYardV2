import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.lib.firebase_admin import db

async def clean_orphans():
    print("--- Cleaning Orphaned Tasks ---")
    tasks = list(db.collection('tasks').stream())
    
    task_ids = {t.id for t in tasks}
    print(f"Total tasks in database: {len(tasks)}")
    
    orphans = []
    for t in tasks:
        d = t.to_dict()
        parent_id = d.get('parent_task_id')
        if parent_id and parent_id not in task_ids:
            orphans.append((t.id, d.get('rapor_adi'), parent_id))
            
    print(f"Found {len(orphans)} orphaned tasks:")
    for oid, name, pid in orphans:
        print(f"  - ID: {oid}, Name: {name}, Parent ID: {pid} (Does not exist)")
        
    if orphans:
        print("\nDeleting orphaned tasks...")
        for oid, name, pid in orphans:
            db.collection('tasks').document(oid).delete()
            print(f"  Deleted task {oid} ({name})")
        print("Cleanup completed successfully.")
    else:
        print("No orphaned tasks found.")

if __name__ == "__main__":
    asyncio.run(clean_orphans())
