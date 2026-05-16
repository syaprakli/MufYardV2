import asyncio
import os
import sys
from datetime import datetime

# Path setup
sys.path.append(os.getcwd())
from app.lib.firebase_admin import db

async def check_user_profile(email):
    print(f"\n--- USER PROFILE CHECK: {email} ---")
    
    # 1. Check profiles collection
    docs = db.collection('profiles').where('email', '==', email).stream()
    profile_found = False
    for doc in docs:
        profile_found = True
        data = doc.to_dict()
        print(f"UID: {doc.id}")
        print(f"Full Name: {data.get('full_name')}")
        print(f"Role: {data.get('role')}")
        print(f"Has Premium AI: {data.get('has_premium_ai')}")
        print(f"Premium Type: {data.get('premium_type')}")
        print(f"Premium Until: {data.get('premium_until')}")
        print(f"Trial Started: {data.get('trial_started')}")
        
    if not profile_found:
        print("Profile NOT FOUND in 'profiles' collection.")

    # 2. Check license_keys collection for this email
    print(f"\n--- USED LICENSES FOR {email} ---")
    keys = db.collection('license_keys').where('used_by_email', '==', email).stream()
    key_found = False
    for key in keys:
        key_found = True
        data = key.to_dict()
        print(f"KEY: {key.id}")
        print(f"Duration Label: {data.get('duration_label')}")
        print(f"Used At: {data.get('used_at')}")
    
    if not key_found:
        print("No used keys found for this email.")

if __name__ == "__main__":
    email = "yapraklisefa@gmail.com"
    asyncio.run(check_user_profile(email))
