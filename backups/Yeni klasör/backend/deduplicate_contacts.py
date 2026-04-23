from app.lib.firebase_admin import db
from collections import defaultdict

def deduplicate():
    print("Rehber tekilleştirme işlemi başlatılıyor...")
    contacts_ref = db.collection('contacts')
    docs = contacts_ref.get()
    
    # İsimlere göre grupla (Büyük-küçük harf duyarsız)
    by_name = defaultdict(list)
    for doc in docs:
        data = doc.to_dict()
        raw_name = data.get('name', '').strip()
        if raw_name:
            # İsmi agresif normalize et: Sadece A-Z karakterleri tut
            import re
            normalized_name = re.sub(r'[^A-Z]', '', raw_name.upper().replace('İ', 'I').replace('ı', 'I').replace('Ğ', 'G').replace('Ü', 'U').replace('Ş', 'S').replace('Ö', 'O').replace('Ç', 'C'))
            by_name[normalized_name].append((doc.id, data))

    to_delete = []
    kept_count = 0

    for name, entries in by_name.items():
        if len(entries) > 1:
            # En "iyi" kaydı seç (e-postası olan veya en son güncellenen)
            # Burada e-postası "-" veya boş olmayanları tercih edelim
            entries.sort(key=lambda x: (
                x[1].get('email', '') not in [None, '', '-'],
                x[1].get('updated_at', '0')
            ), reverse=True)
            
            best_id = entries[0][0]
            # Diğerlerini silme listesine ekle
            for doc_id, _ in entries[1:]:
                to_delete.append(doc_id)
            kept_count += 1
        else:
            kept_count += 1

    print(f"Toplam {len(by_name)} benzersiz isim bulundu.")
    print(f"Silinecek mükerrer kayıt sayısı: {len(to_delete)}")

    # Firestore Batch silme
    batch = db.batch()
    count = 0
    for doc_id in to_delete:
        batch.delete(contacts_ref.document(doc_id))
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    
    if count % 400 != 0:
        batch.commit()

    print(f"İşlem tamamlandı. {count} kayıt silindi. Kalan kayıt sayısı: {kept_count}")

if __name__ == "__main__":
    deduplicate()
