import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.contact_service import ContactService
from app.services.inspector_service import InspectorService

async def main():
    print("--- Manuel Senkronizasyon Basladi ---")
    
    print("1. Rehber (Contacts) senkronize ediliyor...")
    res_contacts = await ContactService.sync_from_rdb_rehber_v6()
    print(f"Rehber Sonucu: {res_contacts}")
    
    print("\n2. Mufettis Listesi senkronize ediliyor...")
    # sync_from_contacts uses the contacts we just imported
    res_inspectors = await InspectorService.sync_from_contacts()
    print(f"Mufettis Sonucu: {res_inspectors}")
    
    print("\n--- Islem Tamamlandi ---")

if __name__ == "__main__":
    asyncio.run(main())
