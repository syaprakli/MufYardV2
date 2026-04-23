import os
import asyncio
import sys
from datetime import datetime

# Proje kök dizinini path'e ekleyelim
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.lib.firebase_admin import db, bucket
except ImportError:
    print("[X] HATA: Firebase yapılandırması bulunamadı. Lütfen backend dizininde olduğunuzdan emin olun.")
    sys.exit(1)

IMPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "import_mevzuat")

async def bulk_import():
    if not os.path.exists(IMPORT_DIR):
        os.makedirs(IMPORT_DIR)
        print(f"[*] '{IMPORT_DIR}' klasörü oluşturuldu.\n")
        return

    # Tüm dosyaları alt klasörlerle birlikte tara
    all_files = []
    for root, dirs, files in os.walk(IMPORT_DIR):
        if "islenenler" in root: continue # İşlenenleri atla
        for f in files:
            all_files.append(os.path.join(root, f))
    
    if not all_files:
        print("[!] İçeri aktarılacak dosya bulunamadı.")
        print(f"İpucu: Dosyalarınızı 'Kategori/Tür/Dosya.pdf' şeklinde klasörleyebilirsiniz.")
        return

    print(f"[*] Toplam {len(all_files)} dosya bulundu. Aktarım başlıyor...\n")

    success_count = 0
    fail_count = 0

    for file_path in all_files:
        filename = os.path.basename(file_path)
        name, ext = os.path.splitext(filename)
        
        # Klasör yapısından Kategori ve Tür çıkar
        # import_mevzuat/KATEGORI/TUR/dosya.pdf
        relative_path = os.path.relpath(file_path, IMPORT_DIR)
        path_parts = relative_path.split(os.sep)
        
        category = "Genel"
        doc_type = "Yazı"
        
        if len(path_parts) >= 3:
            category = path_parts[0]
            doc_type = path_parts[1]
        elif len(path_parts) == 2:
            category = path_parts[0]
            # Eğer 2 parça varsa, ilk parça kategori, dosya türü varsayılan kalır
        
        # Dosya adından başlık oluştur
        title = name.replace("_", " ").replace("-", " ").title()
        
        try:
            print(f"--- İşleniyor: {filename} [{category} > {doc_type}] ---")
            
            # 1. Firebase Storage'a yükle
            timestamp = int(datetime.utcnow().timestamp())
            blob_path = f"mevzuat/{category}/{doc_type}/{name}_{timestamp}{ext}"
            blob = bucket.blob(blob_path)
            
            with open(file_path, "rb") as f:
                blob.upload_from_file(f)
            
            blob.make_public()
            public_url = blob.public_url

            # 2. Firestore'a kaydet
            leg_data = {
                "title": title,
                "category": category,
                "doc_type": doc_type,
                "summary": f"{title} dosyası toplu aktarım ile '{category}' kategorisine eklendi.",
                "tags": [category, doc_type, "Toplu Aktarım"],
                "official_gazette_info": "",
                "document_url": "",
                "local_path": public_url,
                "is_pinned": False,
                "is_public": True,
                "is_archived": False,
                "created_at": datetime.utcnow()
            }
            
            await asyncio.to_thread(db.collection('legislations').add, leg_data)
            
            # 3. Dosyayı taşı
            processed_dir = os.path.join(IMPORT_DIR, "islenenler", category, doc_type)
            os.makedirs(processed_dir, exist_ok=True)
            os.rename(file_path, os.path.join(processed_dir, filename))
            
            print(f"   [OK] Aktarıldı.")
            success_count += 1
            
        except Exception as e:
            print(f"   [X] HATA: {filename}! Sebep: {str(e)}")
            fail_count += 1
            
        except Exception as e:
            print(f"   [X] HATA: {filename} aktarılamadı! Sebep: {str(e)}")
            fail_count += 1

    print(f"\n[!] İşlem tamamlandı.")
    print(f"   - Başarılı: {success_count}")
    print(f"   - Hatalı: {fail_count}")
    if success_count > 0:
        print(f"\nUygulamayı açıp Mevzuat bölümünden 'Genel' kategorisini seçerek dosyaları görebilirsiniz.")

if __name__ == "__main__":
    asyncio.run(bulk_import())
