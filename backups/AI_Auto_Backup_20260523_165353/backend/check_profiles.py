import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.lib.firebase_admin import db

async def main():
    print("--- Tüm Profiller ve Durumlar ---")
    profiles_ref = db.collection('profiles')
    docs = list(profiles_ref.stream())
    
    found = False
    for doc in docs:
        d = doc.to_dict()
        email = str(d.get('email', '')).lower()
        name = d.get('full_name', d.get('name', 'Isimsiz'))
        print(f"PROFIL: {name} | Email: {email} | Role: {d.get('role')} | UID: {doc.id}")
        
        if "diri" in email or "diri" in name.lower():
            found = True
            print(">>> HEDEF BULUNDU!")
            
    if not found:
        print("\n!!! UYARI: 'Diri' isminde veya e-postasinda bir profil bulunamadi.")
        print("Bu kullanici Firebase Auth'da kayitli olabilir ama 'profiles' koleksiyonunda kaydi olmayabilir.")

if __name__ == "__main__":
    asyncio.run(main())
