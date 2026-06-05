import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.lib.firebase_admin import db

async def check_db():
    print("--- Database Content Check ---")
    tasks = list(db.collection('tasks').stream())
    print(f"Total Tasks: {len(tasks)}\n")
    for t in tasks:
        d = t.to_dict()
        print(f"ID: {t.id}")
        print(f"  rapor_kodu: {d.get('rapor_kodu')}")
        print(f"  rapor_adi: {d.get('rapor_adi')}")
        print(f"  rapor_durumu: {d.get('rapor_durumu')}")
        print(f"  parent_task_id: {d.get('parent_task_id')}")
        print(f"  owner_id: {d.get('owner_id')}")
        print(f"  collaborators: {d.get('accepted_collaborators')}")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check_db())
