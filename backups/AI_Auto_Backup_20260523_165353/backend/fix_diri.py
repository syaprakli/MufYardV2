import asyncio
import os
import sys
from firebase_admin import auth

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.lib.firebase_admin import db

async def fix():
    email = "mehmet.diri@gsb.gov.tr"
    try:
        # Auth'dan UID çek
        user = auth.get_user_by_email(email)
        uid = user.uid
        print(f"BAŞARI: Kullanıcı Auth'da bulundu. UID: {uid}")

        # Profili geri yükle
        profile_data = {
            "full_name": "Mehmet Diri",
            "email": email,
            "role": "moderator",
            "is_verified": True,
            "created_at": "2024-05-06T12:00:00Z"
        }
        db.collection('profiles').document(uid).set(profile_data)
        print("BAŞARI: Profil dökümanı oluşturuldu.")

        # Müfettiş kaydını güncelle (UID eşleştirme)
        # ID: f50427f78dc0f87dcae230f2c2090832 (Önceki taramadan bildiğimiz ID)
        insp_ref = db.collection('inspectors').document("f50427f78dc0f87dcae230f2c2090832")
        insp_ref.update({"uid": uid})
        print("BAŞARI: Müfettiş kaydı hesapla eşleştirildi.")
        
    except Exception as e:
        print(f"HATA: {e}")

if __name__ == "__main__":
    asyncio.run(fix())
