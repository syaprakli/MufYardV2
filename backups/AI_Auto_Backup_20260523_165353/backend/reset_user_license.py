import asyncio
import os
import sys

sys.path.append(os.getcwd())
from app.lib.firebase_admin import db

async def reset_user_license(email):
    print(f"Searching for keys used by {email}...")
    docs = db.collection('license_keys').where('used_by_email', '==', email).stream()
    found = False
    for doc in docs:
        print(f"FOUND KEY: {doc.id}")
        # Delete the key so it's gone from the list
        db.collection('license_keys').document(doc.id).delete()
        print(f"Deleted key {doc.id}")
        found = True
        
    if not found:
        print(f"No keys found for {email}")

if __name__ == "__main__":
    email = "yapraklisefa@gmail.com"
    asyncio.run(reset_user_license(email))
