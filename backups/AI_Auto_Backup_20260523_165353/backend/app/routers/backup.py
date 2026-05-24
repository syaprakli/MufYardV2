from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from app.lib.firebase_admin import db
from app.services.google_service import GoogleDriveService
import json
import os
import asyncio
from datetime import datetime
import tempfile
import io

router = APIRouter()

@router.post("/export")
async def export_data():
    """Exports all system data to a JSON file for local backup."""
    try:
        data = await _get_full_backup_data()
        
        # Create a temporary file
        fd, path = tempfile.mkstemp(suffix=".json")
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as tmp:
                json.dump(data, tmp, ensure_ascii=False, indent=4)
            
            filename = f"MufYard_Backup_{datetime.now().strftime('%d_%m_%Y')}.json"
            return FileResponse(path, filename=filename, media_type='application/json')
        except Exception as e:
            os.remove(path)
            raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/drive-backup")
async def drive_backup():
    """Uploads system backup to Google Drive."""
    try:
        data = await _get_full_backup_data()
        drive_service = GoogleDriveService()
        
        # Create temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=4)
            temp_path = tmp.name
            
        try:
            filename = f"MufYard_Backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            result = await drive_service.upload_backup(temp_path, filename)
            os.remove(temp_path)
            return result
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import")
async def import_data(file: UploadFile = File(...)):
    """Imports system data from a JSON file."""
    try:
        contents = await file.read()
        import_data = json.loads(contents)
        
        if not isinstance(import_data, dict):
            raise HTTPException(status_code=400, detail="Geçersiz yedek dosyası formatı.")
            
        results = {}
        for coll_name, items in import_data.items():
            # Firestore limits batches to 500 operations
            batch = db.batch()
            count = 0
            for item in items:
                doc_id = item.pop('id', None)
                if not doc_id: continue
                
                # Convert ISO strings back to datetime objects if needed
                for k, v in item.items():
                    if isinstance(v, str) and (k.endswith('_at') or k == 'date'):
                        try:
                            item[k] = datetime.fromisoformat(v)
                        except: pass
                
                doc_ref = db.collection(coll_name).document(doc_id)
                batch.set(doc_ref, item, merge=True)
                count += 1
                
                if count >= 450: # Commit in chunks to stay under 500 limit
                    await asyncio.to_thread(batch.commit)
                    batch = db.batch()
                    count = 0
            
            if count > 0:
                await asyncio.to_thread(batch.commit)
            results[coll_name] = len(items)
            
        return {"status": "success", "imported_counts": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _get_full_backup_data():
    """Helper to collect all data from Firestore with robust serialization."""
    collections = ['audits', 'tasks', 'contacts', 'ai_knowledge', 'legislation', 'profiles', 'notes', 'messages', 'posts']
    full_data = {}
    
    for coll_name in collections:
        try:
            docs = await asyncio.to_thread(db.collection(coll_name).get)
            items = []
            for doc in docs:
                item = doc.to_dict()
                item['id'] = doc.id
                # Convert non-serializable objects (datetimes, references, etc.)
                for k, v in item.items():
                    if hasattr(v, 'isoformat'):
                        item[k] = v.isoformat()
                    elif hasattr(v, 'path'): # Firestore DocumentReference
                        item[k] = v.path
                    elif isinstance(v, (list, dict)):
                        # Simple recursive check for nested dates/refs would be better, 
                        # but for now we'll handle top-level
                        pass
                items.append(item)
            full_data[coll_name] = items
        except Exception as e:
            print(f"Backup skip for {coll_name}: {e}")
            full_data[coll_name] = []
        
    return full_data
