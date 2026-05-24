import os
import sys
import asyncio
from typing import Dict, List

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.lib.firebase_admin import db

async def cleanup_duplicate_inspectors():
    print("Mükerrer Müfettiş temizliği başlatılıyor...")
    
    inspectors_ref = db.collection('inspectors')
    docs = await asyncio.to_thread(lambda: list(inspectors_ref.stream()))
    
    email_map: Dict[str, List[str]] = {}
    docs_data = {}
    
    # 1. E-posta adreslerini grupla
    for doc in docs:
        data = doc.to_dict()
        doc_id = doc.id
        docs_data[doc_id] = data
        
        email = data.get('email', '').strip().lower()
        if not email:
            # Fallback
            name = data.get('name', '').strip()
            if name:
                cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in name.lower().replace("ı", "i").replace("ş", "s").replace("ğ", "g").replace("ü", "u").replace("ö", "o").replace("ç", "c"))
                username = ".".join(part for part in cleaned.split() if part)
                email = f"{username}@gsb.gov.tr" if username else ""
        
        if email:
            if email not in email_map:
                email_map[email] = []
            email_map[email].append(doc_id)
            
    # 2. Mükerrerleri sil (en çok veriye sahip olanı tut)
    batch = db.batch()
    deleted_count = 0
    
    for email, doc_ids in email_map.items():
        if len(doc_ids) > 1:
            print(f"Mükerrer bulundu: {email} ({len(doc_ids)} adet)")
            
            # En "dolu" kaydı bul (telefon, oda vs. var mı diye bak)
            best_id = doc_ids[0]
            max_score = -1
            
            for d_id in doc_ids:
                data = docs_data[d_id]
                score = 0
                if data.get('phone'): score += 1
                if data.get('extension'): score += 1
                if data.get('room'): score += 1
                if data.get('title') and data.get('title') != "Personel": score += 1
                
                if score > max_score:
                    max_score = score
                    best_id = d_id
            
            # Diğerlerini sil
            for d_id in doc_ids:
                if d_id != best_id:
                    print(f"  Siliniyor: {d_id}")
                    batch.delete(inspectors_ref.document(d_id))
                    deleted_count += 1
                    
            # Best ID olanın email'ini normalize et (küçük harf)
            batch.update(inspectors_ref.document(best_id), {'email': email})

    if deleted_count > 0:
        print(f"Toplam {deleted_count} mükerrer kayıt siliniyor...")
        await asyncio.to_thread(batch.commit)
        print("İşlem tamamlandı.")
    else:
        print("Mükerrer kayıt bulunamadı.")

if __name__ == "__main__":
    asyncio.run(cleanup_duplicate_inspectors())
