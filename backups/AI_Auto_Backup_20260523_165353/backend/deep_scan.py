import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.lib.firebase_admin import db

async def main():
    print("--- DERIN TARAMA: MEHMET DIRI ---")
    
    # 1. Müfettişler
    print("\n[INSPECTORS]")
    inspectors = list(db.collection('inspectors').stream())
    for doc in inspectors:
        d = doc.to_dict()
        if "diri" in str(d).lower() or "uid" in d:
            print(f"ID: {doc.id} | AD: {d.get('name')} | EMAIL: {d.get('email')} | UID: {d.get('uid', 'YOK')}")

    # 2. Rehber
    print("\n[CONTACTS]")
    contacts = list(db.collection('contacts').stream())
    for doc in contacts:
        d = doc.to_dict()
        if "diri" in str(d).lower():
            print(f"ID: {doc.id} | AD: {d.get('name')} | EMAIL: {d.get('email')}")

    # 3. Profiller
    print("\n[PROFILES]")
    profiles = list(db.collection('profiles').stream())
    for doc in profiles:
        d = doc.to_dict()
        print(f"ID: {doc.id} | AD: {d.get('full_name')} | EMAIL: {d.get('email')}")

if __name__ == "__main__":
    asyncio.run(main())
