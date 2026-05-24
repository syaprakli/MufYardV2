import asyncio
from app.lib.firebase_admin import db

async def check_db():
    print("--- Database Content Check ---")
    
    # Check Contacts
    contacts = list(db.collection('contacts').stream())
    print(f"Total Contacts: {len(contacts)}")
    if contacts:
        first = contacts[0].to_dict()
        print(f"Sample Contact: {first.get('name')} (is_shared: {first.get('is_shared')})")
    
    # Check Inspectors
    inspectors = list(db.collection('inspectors').stream())
    print(f"Total Inspectors: {len(inspectors)}")
    if inspectors:
        first = inspectors[0].to_dict()
        print(f"Sample Inspector: {first.get('name')}")

    # Check Tasks
    tasks = list(db.collection('tasks').stream())
    print(f"Total Tasks: {len(tasks)}")

if __name__ == "__main__":
    asyncio.run(check_db())
