import asyncio
import os
import sys

sys.path.append(os.getcwd())
from app.lib.firebase_admin import db

async def list_all_used_keys():
    print("Listing ALL used licenses...")
    docs = db.collection('license_keys').where('is_used', '==', True).stream()
    for doc in docs:
        data = doc.to_dict()
        print(f"Key: {doc.id} | Email: {data.get('used_by_email')} | Name: {data.get('used_by_name')}")

if __name__ == "__main__":
    asyncio.run(list_all_used_keys())
