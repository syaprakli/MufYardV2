import asyncio
import os
import sys

# Backend yolunu ekle
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.lib.firebase_admin import db

async def revert_premium(email: str):
    print(f"--- {email} Hesabı Basic Moda Döndürülüyor ---")
    
    try:
        # E-posta ile kullanıcıyı bul
        profiles_ref = db.collection('profiles')
        query = profiles_ref.where('email', '==', email).limit(1)
        docs = await asyncio.to_thread(query.get)
        
        if not docs:
            print(f"HATA: {email} adresiyle bir profil bulunamadı.")
            return
            
        for doc in docs:
            uid = doc.id
            print(f"Kullanıcı bulundu (UID: {uid})")
            
            # Premium durumunu kapat
            await asyncio.to_thread(profiles_ref.document(uid).set, {
                'has_premium_ai': False,
                'trial_started': False # İstersen true kalsın ama basic olsun dersen burayı elleme
            }, merge=True)
            
            print(f"BAŞARILI: {email} artık Basic kullanıcı.")
            
    except Exception as e:
        print(f"KRİTİK HATA: {e}")

if __name__ == "__main__":
    target_email = "yapraklisefa@gmail.com"
    asyncio.run(revert_premium(target_email))
