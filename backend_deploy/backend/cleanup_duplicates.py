import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.lib.firebase_admin import db

async def main():
    print("--- Nokta Atisi Silme Basladi ---")
    
    # Hedef ID'ler
    to_delete_i = "Gh02jir8C0ylIW4WtM6c"
    to_delete_c = "d80e6b05eb667de9689c4760998682c6"
    
    db.collection('inspectors').document(to_delete_i).delete()
    print(f"SILINDI (Inspectors): {to_delete_i}")
    
    db.collection('contacts').document(to_delete_c).delete()
    print(f"SILINDI (Contacts): {to_delete_c}")
    
    print("--- Temizlik Bitti ---")

if __name__ == "__main__":
    asyncio.run(main())
