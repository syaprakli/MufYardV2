from datetime import datetime
import asyncio
import logging
from typing import List, Optional, Dict, Any
import uuid
from app.lib.firebase_admin import db
from app.schemas.inspector import InspectorCreate
import hashlib

logger = logging.getLogger(__name__)

class InspectorService:
    @staticmethod
    def _normalize_text(value: str) -> str:
        return (
            (value or "")
            .strip()
            .lower()
            .replace("ı", "i")
            .replace("ş", "s")
            .replace("ğ", "g")
            .replace("ü", "u")
            .replace("ö", "o")
            .replace("ç", "c")
        )

    @staticmethod
    def _is_target_title(title: str) -> bool:
        normalized = InspectorService._normalize_text(title)
        return (
            "basmufettis" in normalized
            or "mufettis yardimcisi" in normalized
            or normalized == "mufettis"
            or normalized.startswith("mufettis ")
        )

    @staticmethod
    def _generate_email_from_name(name: str) -> str:
        normalized = InspectorService._normalize_text(name)
        cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in normalized)
        username = ".".join(part for part in cleaned.split() if part)
        return f"{username}@gsb.gov.tr".lower() if username else ""

    @staticmethod
    async def get_inspectors() -> List[Dict[str, Any]]:
        try:
            docs = await asyncio.to_thread(db.collection('inspectors').limit(300).stream)
            inspectors = []
            now = datetime.utcnow().isoformat()
            
            for doc in docs:
                data = doc.to_dict()
                if not data: continue
                
                # Ensure required fields exist for schema validation
                if 'name' not in data: data['name'] = "İsimsiz"
                if 'email' not in data: data['email'] = InspectorService._generate_email_from_name(data['name'])
                data['email'] = str(data['email']).lower()
                if 'title' not in data: data['title'] = "Müfettiş"
                if 'created_at' not in data:
                    data['created_at'] = now
                    # Arka planda güncelle, isteği bloke etme
                    asyncio.create_task(asyncio.to_thread(doc.reference.update, {'created_at': now}))
                
                if not str(data.get('email', '')).strip() and str(data.get('name', '')).strip():
                    fallback_email = InspectorService._generate_email_from_name(str(data.get('name', '')))
                    if fallback_email:
                        data['email'] = fallback_email
                        asyncio.create_task(asyncio.to_thread(doc.reference.update, {'email': fallback_email}))
                else:
                    if 'email' in data and data['email']:
                        # Ensure stored in DB as lowercase
                        lowered_email = data['email'].lower()
                        if data['email'] != lowered_email:
                            data['email'] = lowered_email
                            asyncio.create_task(asyncio.to_thread(doc.reference.update, {'email': lowered_email}))
                
                data['id'] = doc.id
                inspectors.append(data)
            
            # Default inspectors if none exist
            if not inspectors:
                default_data = [
                    {"name": "Sefa YAPRAKLI", "email": "sefa.yaprakli@gsb.gov.tr", "title": "Müfettiş", "uid": "sefa.yaprakli@gsb.gov.tr"},
                    {"name": "Mehmet YILMAZ", "email": "mehmet@gsb.gov.tr", "title": "Müfettiş", "uid": "mehmet@gsb.gov.tr"},
                    {"name": "Ali DEMİR", "email": "ali@gsb.gov.tr", "title": "Müfettiş", "uid": "ali@gsb.gov.tr"},
                    {"name": "Ayşe KAYA", "email": "ayse@gsb.gov.tr", "title": "Müfettiş", "uid": "ayse@gsb.gov.tr"}
                ]
                for d in default_data:
                    d['created_at'] = now
                    await asyncio.to_thread(db.collection('inspectors').add, d)
                return await InspectorService.get_inspectors()

            return inspectors
        except Exception as e:
            logger.error(f"Error getting inspectors: {e}")
            return []

    @staticmethod
    async def add_inspector(inspector: InspectorCreate) -> Dict[str, Any]:
        data = inspector.dict()
        if data.get('email'):
            data['email'] = data['email'].lower()
        data['created_at'] = datetime.utcnow().isoformat()
        try:
            res = await asyncio.to_thread(db.collection('inspectors').add, data)
            data['id'] = res[1].id
            return data
        except Exception:
            data['id'] = str(uuid.uuid4())
            return data

    @staticmethod
    async def add_inspectors_bulk(inspectors: List[InspectorCreate]) -> int:
        """Adds multiple inspectors using a Firestore batch operation."""
        batch = db.batch()
        count = 0
        now = datetime.utcnow().isoformat()
        
        for inspector in inspectors:
            doc_ref = db.collection('inspectors').document()
            data = inspector.dict()
            if data.get('email'):
                data['email'] = data['email'].lower()
            data['created_at'] = now
            batch.set(doc_ref, data)
            count += 1
            
        await asyncio.to_thread(batch.commit)
        return count

    @staticmethod
    async def delete_inspector(inspector_id: str) -> bool:
        try:
            await asyncio.to_thread(db.collection('inspectors').document(inspector_id).delete)
            return True
        except Exception:
            return False

    @staticmethod
    async def update_inspector(inspector_id: str, inspector: InspectorCreate) -> Optional[Dict[str, Any]]:
        try:
            data = inspector.dict()
            if data.get('email'):
                data['email'] = data['email'].lower()
            await asyncio.to_thread(db.collection('inspectors').document(inspector_id).update, data)
            data['id'] = inspector_id
            return data
        except Exception:
            return None

    @staticmethod
    async def sync_from_excel(file_path: str = None) -> Dict[str, Any]:
        """
        rehber.xlsx dosyasını okuyarak Müfettiş listesini ünvan bazlı senkronize eder.
        """
        import os
        import pandas as pd
        import hashlib
        from app.config import BASE_DIR
        
        if file_path is None:
            file_path = os.path.join(BASE_DIR, "rehber.xlsx")
            
        if not os.path.exists(file_path):
            return {"status": "error", "message": "rehber.xlsx dosyası bulunamadı."}
            
        try:
            # Sadece ilk 200 satırı oku
            df = await asyncio.to_thread(pd.read_excel, file_path, nrows=200)
            
            # Ünvan filtreleme (Büyük/Küçük harf duyarlı olabilir, temizleyelim)
            target_titles = ["BAŞMÜFETTİŞ", "MÜFETTİŞ", "MÜFETTİŞ YARDIMCISI"]
            
            sync_count = 0
            batch = db.batch()
            inspectors_ref = db.collection('inspectors')
            now = datetime.utcnow().isoformat()
            
            for _, row in df.iterrows():
                if pd.isna(row.get('AD/SOYAD')) or pd.isna(row.get('UNVAN')):
                    continue
                    
                title = str(row.get('UNVAN')).strip().upper().replace('İ', 'İ').replace('I', 'I') # Basit normalizasyon
                
                # Hedef ünvanlardan biri mi?
                if not any(t in title for t in target_titles):
                    continue
                
                name = str(row.get('AD/SOYAD')).strip()
                email = str(row.get('E-MAİL', '')).strip().lower() if not pd.isna(row.get('E-MAİL')) else f"{name.lower().replace(' ', '.')}@gsb.gov.tr"
                dahili = str(row.get('DAHİLİ NO', '')).replace('.0', '').strip() if not pd.isna(row.get('DAHİLİ NO')) else ""
                oda = str(row.get('ODA ', '')).replace('.0', '').strip() if not pd.isna(row.get('ODA ')) else ""
                
                inspector_data = {
                    "name": name,
                    "email": email,
                    "title": str(row.get('UNVAN')).strip(), # Orijinal yazımı koru
                    "phone": str(row.get('CEP NO', '')).strip() if not pd.isna(row.get('CEP NO')) else "",
                    "extension": dahili,
                    "room": oda,
                    "uid": email, # E-posta UID olarak kullanılabilir
                    "created_at": now
                }
                
                # Benzersiz ID (email hash)
                unique_id = hashlib.md5(email.encode()).hexdigest()
                doc_ref = inspectors_ref.document(unique_id)
                batch.set(doc_ref, inspector_data, merge=True)
                sync_count += 1
                
            await asyncio.to_thread(batch.commit)
            logger.info(f"Müfettiş senkronizasyonu tamamlandı. {sync_count} kayıt aktarıldı.")
            return {"status": "success", "processed": sync_count, "message": f"{sync_count} müfettiş başarıyla senkronize edildi."}
            
        except Exception as e:
            logger.error(f"Müfettiş senkronizasyon hatası: {str(e)}")
            return {"status": "error", "message": f"Müfettiş senkronizasyon hatası: {str(e)}"}

    @staticmethod
    async def sync_from_rdb_rehber_full(file_path: str = None) -> Dict[str, Any]:
        """
        Processes Rdb_rehber.xlsx using a dual-column layout extraction.
        Imports everyone found in the sheet.
        """
        import os
        import pandas as pd
        import hashlib
        from app.config import BASE_DIR
        
        if file_path is None:
            file_path = os.path.join(BASE_DIR, "Rdb_rehber.xlsx")
            
        if not os.path.exists(file_path):
            return {"status": "error", "message": "Rdb_rehber.xlsx dosyası bulunamadı."}
            
        try:
            # Sadece ilk 300 satırı oku
            df = await asyncio.to_thread(pd.read_excel, file_path, nrows=300)
            
            sync_count = 0
            batch = db.batch()
            inspectors_ref = db.collection('inspectors')
            now = datetime.utcnow().isoformat()
            
            # Helper to process a record
            def process_record(name_val, title_val, phone_val, ext_val, room_val):
                if pd.isna(name_val) or str(name_val).strip() == "" or "BAŞKANLIK" in str(name_val):
                    return None
                
                name = str(name_val).strip()
                title = str(title_val).strip() if not pd.isna(title_val) else "Personel"
                email = f"{name.lower().replace(' ', '.').replace('ı', 'i').replace('ş', 's').replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o').replace('ç', 'c')}@gsb.gov.tr"
                
                return {
                    "name": name,
                    "email": email,
                    "title": title,
                    "phone": str(phone_val).strip() if not pd.isna(phone_val) else "",
                    "extension": str(ext_val).replace('.0', '').strip() if not pd.isna(ext_val) else "",
                    "room": str(room_val).replace('.0', '').strip() if not pd.isna(room_val) else "",
                    "uid": email,
                    "created_at": now
                }

            for _, row in df.iterrows():
                # Table A (Indices 1-5)
                # Table B (Indices 7-11)
                # Note: df.iloc indices might vary if headers are merged. 
                # We'll use absolute positions from the row values.
                vals = row.values.tolist()
                
                if len(vals) < 12:
                    continue
                
                # Table A
                rec_a = process_record(vals[1], vals[2], vals[3], vals[4], vals[5])
                if rec_a:
                    unique_id = hashlib.md5(rec_a['email'].encode()).hexdigest()
                    batch.set(inspectors_ref.document(unique_id), rec_a, merge=True)
                    sync_count += 1
                
                # Table B
                rec_b = process_record(vals[7], vals[8], vals[9], vals[10], vals[11])
                if rec_b:
                    unique_id = hashlib.md5(rec_b['email'].encode()).hexdigest()
                    batch.set(inspectors_ref.document(unique_id), rec_b, merge=True)
                    sync_count += 1
            
            if sync_count > 0:
                await asyncio.to_thread(batch.commit)
            
            return {"status": "success", "processed": sync_count, "message": f"{sync_count} personel başarıyla senkronize edildi."}
            
        except Exception as e:
            return {"status": "error", "message": f"Rdb Rehber senkronizasyon hatası: {str(e)}"}

    @staticmethod
    async def sync_from_contacts() -> Dict[str, Any]:
        """
        Kurumsal rehberden (contacts) sadece hedef unvanları inspectors koleksiyonuna ekler/günceller.
        Hedef unvanlar: Başmüfettiş, Müfettiş, Müfettiş Yardımcısı.
        """
        try:
            contacts_docs = await asyncio.to_thread(
                lambda: list(db.collection("contacts").where("is_shared", "==", True).stream())
            )

            existing_inspectors = await asyncio.to_thread(
                lambda: list(db.collection("inspectors").stream())
            )

            existing_key_to_id: Dict[str, str] = {}
            for insp_doc in existing_inspectors:
                insp = insp_doc.to_dict() or {}
                insp_name = str(insp.get("name", "")).strip()
                insp_title = str(insp.get("title", "")).strip()
                if not insp_name:
                    continue
                key = f"{InspectorService._normalize_text(insp_name)}|{InspectorService._normalize_text(insp_title)}"
                existing_key_to_id[key] = insp_doc.id

            if not contacts_docs:
                return {
                    "status": "success",
                    "processed": 0,
                    "message": "Kurumsal rehberde senkronize edilecek kayıt bulunamadı."
                }

            batch = db.batch()
            inspectors_ref = db.collection("inspectors")
            now = datetime.utcnow().isoformat()
            sync_count = 0

            for doc in contacts_docs:
                data = doc.to_dict() or {}
                title = str(data.get("title", "")).strip()

                if not InspectorService._is_target_title(title):
                    continue

                name = str(data.get("name", "")).strip()
                if not name:
                    continue

                email = str(data.get("email", "")).strip().lower()
                if not email:
                    email = InspectorService._generate_email_from_name(name)

                if not email:
                    continue
                email = email.lower()
                phone = str(data.get("phone", "")).strip()

                extension = ""
                room = ""
                unit_text = str(data.get("unit", ""))
                unit_parts = [part.strip() for part in unit_text.split("|") if part.strip()]
                for part in unit_parts:
                    if part.lower().startswith("dahili:"):
                        extension = part.split(":", 1)[1].strip()
                    if part.lower().startswith("oda:"):
                        room = part.split(":", 1)[1].strip()

                key = f"{InspectorService._normalize_text(name)}|{InspectorService._normalize_text(title)}"
                uid_seed = email or f"{name}|{title}|{phone}|{extension}|{room}"
                unique_id = existing_key_to_id.get(key) or hashlib.md5(uid_seed.encode("utf-8")).hexdigest()

                inspector_data = {
                    "name": name,
                    "email": email,
                    "title": title,
                    "phone": phone,
                    "extension": extension,
                    "room": room,
                    "uid": email or unique_id,
                    "created_at": now,
                }

                batch.set(inspectors_ref.document(unique_id), inspector_data, merge=True)
                sync_count += 1

                if sync_count % 400 == 0:
                    await asyncio.to_thread(batch.commit)
                    batch = db.batch()

            if sync_count % 400 != 0:
                await asyncio.to_thread(batch.commit)

            return {
                "status": "success",
                "processed": sync_count,
                "message": f"Rehberden {sync_count} müfettiş kaydı senkronize edildi."
            }
        except Exception as e:
            return {"status": "error", "message": f"Rehber senkronizasyon hatası: {str(e)}"}

