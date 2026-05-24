import asyncio
import os
import sys

sys.path.append(os.getcwd())
from app.lib.firebase_admin import db

async def debug_keys():
    print("Listing ALL documents in 'license_keys'...")
    try:
        docs = db.collection('license_keys').get()
        print(f"Count: {len(docs)}")
        for doc in docs:
            data = doc.to_dict()
            print(f"ID: {doc.id}")
            print(f"  is_used: {data.get('is_used')} ({type(data.get('is_used'))})")
            print(f"  email: {data.get('used_by_email')}")
            print(f"  name: {data.get('used_by_name')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_keys())
