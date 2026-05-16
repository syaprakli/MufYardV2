import asyncio
import os
import sys

# Backend dizinini path'e ekle
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.lib.firebase_admin import db

async def seed_keys():
    print("Lisans anahtarları oluşturuluyor...")
    keys = [
        "MUFYARD-PRO-2026-TEST",
        "GSB-MUFYARD-2026-XYZ",
        "PRO-AKTIF-9988-7766",
        "MUFYARD-PRO-2026" # Eski sabit anahtar da olsun
    ]
    
    for k in keys:
        doc_ref = db.collection('license_keys').document(k)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            await asyncio.to_thread(doc_ref.set, {
                "key": k,
                "is_used": False,
                "used_by": None,
                "used_at": None,
                "created_at": "2026-05-15T11:30:00"
            })
            print(f"Oluşturuldu: {k}")
        else:
            print(f"Zaten mevcut: {k}")

if __name__ == "__main__":
    asyncio.run(seed_keys())
