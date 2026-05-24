import sys
import os
import asyncio

# Proje kök dizinini ekle
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.lib.firebase_admin import db

async def set_version(version_str):
    try:
        config_ref = db.collection('system').document('config')
        await asyncio.to_thread(config_ref.set, {
            'latest_version': version_str,
            'updated_at': asyncio.to_thread(lambda: None)() # placeholder or actual datetime
        }, merge=True)
        
        # Datetime fix
        from datetime import datetime
        await asyncio.to_thread(config_ref.update, {
            'updated_at': datetime.utcnow()
        })
        
        print(f"[*] BASARILI: En güncel sürüm '{version_str}' olarak ayarlandı.")
        print("[*] Artık bu sürümden eski sürüm kullananlara güncelleme uyarısı gidecektir.")
    except Exception as e:
        print(f"[X] HATA: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kullanım: python set_latest_version.py <versiyon>")
        print("Örnek: python set_latest_version.py 2.1.0")
    else:
        version = sys.argv[1]
        asyncio.run(set_version(version))
