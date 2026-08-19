import os
import uuid
import shutil
import asyncio
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends, Request
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.lib.folder_manager import FolderManager, BASE_REPORTS_DIR, BASE_OTHER_DIR, STANDARD_SUBFOLDERS
from app.config import BASE_DIR
from app.config import settings, DATA_DIR
from app.lib.auth import get_current_user
from app.lib.rate_limiter import limiter


router = APIRouter(tags=["files"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    '.pdf', '.docx', '.xlsx', '.xls', '.doc', '.pptx', '.ppt',
    '.txt', '.csv', '.json', '.xml', '.html',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
    '.mp3', '.wav', '.webm', '.ogg', '.m4a',
    '.mp4', '.avi', '.mov', '.mkv',
    '.zip', '.rar', '.7z',
}
IS_DESKTOP = os.environ.get("MUFYARD_DESKTOP", "false").lower() == "true"



class FileItem(BaseModel):
    id: str
    name: str
    type: str # 'file' | 'folder'
    parentId: Optional[str] = None
    size: Optional[str] = None
    date: Optional[str] = None
    url: Optional[str] = None

class UploadResponse(BaseModel):
    url: str
    name: str
    type: str
    path: str

class CreateFolderRequest(BaseModel):
    parentId: Optional[str] = None
    name: str

class ShareFileRequest(BaseModel):
    file_id: str
    recipient_id: str

class TaskFolderMetadata(BaseModel):
    rapor_turu: Optional[str] = None
    rapor_kodu: Optional[str] = None
    rapor_adi: Optional[str] = None
    baslama_tarihi: Optional[str] = None

@router.post("/upload", response_model=UploadResponse)
@limiter.limit("5/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    path: str = Query(None, description="Relative path from root"),
    scope: str = Query("reports", description="reports or other"),
    current_user: dict = Depends(get_current_user)
):
    logger = logging.getLogger("app.files")
    try:
        user_id = current_user["uid"]
        logger.info(f"UPLOAD ATTEMPT: user_id={user_id}, filename={file.filename}, ip=UPLOAD_IP_PLACEHOLDER")
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        # Path traversal koruması
        target_dir = base_dir
        if path:
            safe_path = os.path.normpath(path).replace("..", "").lstrip(os.sep)
            target_dir = os.path.join(base_dir, safe_path)
            # Kök dizin dışına çıkış engeli
            if not os.path.abspath(target_dir).startswith(os.path.abspath(base_dir)):
                raise HTTPException(status_code=400, detail="Geçersiz hedef dizin.")

        if not await asyncio.to_thread(os.path.exists, target_dir):
            await asyncio.to_thread(os.makedirs, target_dir, exist_ok=True)

        # Dosya boyut kontrolü (10MB)
        file_bytes = await file.read()
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"Dosya boyutu çok büyük (max {MAX_UPLOAD_SIZE // (1024*1024)}MB).")
        await file.seek(0)

        # Dosya uzantı kontrolü
        _, ext = os.path.splitext(file.filename or "")
        if ext.lower() not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Bu dosya türü desteklenmiyor: {ext}")

        file_path = os.path.join(target_dir, file.filename)
        # Kök dizin dışına çıkış engeli
        if not os.path.abspath(file_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=400, detail="Geçersiz dosya yolu.")

        # If file exists, add a suffix
        if await asyncio.to_thread(os.path.exists, file_path):
            base, ext = os.path.splitext(file.filename)
            file_path = os.path.join(target_dir, f"{base}_{int(datetime.now().timestamp())}{ext}")

        # Binary type detection (simplified)
        mime_type = file.content_type or "application/octet-stream"
        media_type = "file"
        if mime_type.startswith("image/"): media_type = "image"
        elif mime_type.startswith("video/"): media_type = "video"
        elif mime_type.startswith("audio/"): media_type = "audio"
        elif "pdf" in mime_type: media_type = "pdf"

        if not IS_DESKTOP:
            from app.lib.firebase_admin import bucket
            timestamp = int(datetime.utcnow().timestamp())
            base, ext = os.path.splitext(file.filename)
            blob_path = f"uploads/{base}_{timestamp}{ext}"
            
            def _upload():
                blob = bucket.blob(blob_path)
                blob.upload_from_string(
                    file_bytes,
                    content_type=mime_type,
                )
                try:
                    blob.make_public()
                except Exception:
                    pass
                return blob.public_url
                
            public_url = await asyncio.to_thread(_upload)
            return {
                "url": public_url,
                "name": file.filename,
                "type": media_type,
                "path": blob_path
            }

        def save_file(f, p):
            with open(p, "wb") as buffer:
                buffer.write(file_bytes)

        await asyncio.to_thread(save_file, file, file_path)

        from app.config import DATA_DIR
        relative_path_from_data = os.path.relpath(file_path, DATA_DIR).replace("\\", "/")
        relative_url = f"/{relative_path_from_data}"

        # Dosya izinlerini kaydet
        rel_file_id = os.path.relpath(file_path, base_dir).replace("\\", "/")
        FolderManager.set_permission(
            file_id=rel_file_id,
            owner_id=user_id,
            allowed_users=[user_id],
            permissions={
                "read": [user_id],
                "write": [user_id],
                "delete": [user_id]
            }
        )
        return {
            "url": relative_url,
            "name": os.path.basename(file_path),
            "type": media_type,
            "path": os.path.relpath(file_path, base_dir).replace("\\", "/")
        }
    except Exception as e:
        logger.error(f"UPLOAD ERROR: user_id={user_id}, filename={file.filename}, error={str(e)}")
        raise HTTPException(status_code=500, detail="Dosya yükleme sırasında hata oluştu.")

@router.get("/tree", response_model=List[FileItem])
async def get_file_tree(scope: str = Query("reports"), current_user: dict = Depends(get_current_user)):
    """Kullanıcının okuma izni olan dosya/klasörleri döndürür."""
    try:
        user_id = current_user["uid"]
        is_admin = current_user.get("role") == "admin"
        start_path = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        all_items = await asyncio.to_thread(FolderManager.get_tree, start_path)
        visible_items = []
        for item in all_items:
            if is_admin or IS_DESKTOP or item["type"] == "folder" or FolderManager.check_permission(item["id"], user_id, "read"):
                visible_items.append(item)
        return visible_items
    except Exception as e:
        raise HTTPException(status_code=500, detail="Dosya ağacı alınırken hata oluştu.")

@router.post("/create-folder")
async def create_folder(
    req: CreateFolderRequest,
    scope: str = Query("reports"),
    current_user: dict = Depends(get_current_user)
):
    try:
        user_id = current_user["uid"]
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        base = base_dir
        if req.parentId:
            safe_parent = os.path.normpath(req.parentId).replace("..", "").lstrip(os.sep)
            base = os.path.join(base_dir, safe_parent)
            if not os.path.abspath(base).startswith(os.path.abspath(base_dir)):
                raise HTTPException(status_code=400, detail="Geçersiz üst klasör yolu.")

        new_path = os.path.join(base, req.name)
        if not os.path.abspath(new_path).startswith(os.path.abspath(base_dir)):
            raise HTTPException(status_code=400, detail="Geçersiz klasör yolu.")

        await asyncio.to_thread(os.makedirs, new_path, exist_ok=True)
        rel_folder_id = os.path.relpath(new_path, base_dir).replace("\\", "/")
        FolderManager.set_permission(
            file_id=rel_folder_id,
            owner_id=user_id,
            allowed_users=[user_id],
            permissions={
                "read": [user_id],
                "write": [user_id],
                "delete": [user_id]
            }
        )
        return {"id": rel_folder_id, "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Klasör oluşturulurken hata oluştu.")

@router.post("/share-to-user", response_model=UploadResponse)
@limiter.limit("5/minute")
async def share_file_to_user(
    request: Request,
    req: ShareFileRequest,
    scope: str = Query("reports"),
    current_user: dict = Depends(get_current_user)
):
    logger = logging.getLogger("app.files")
    """Paylasilan dosyayi aliciya ait klasore fiziksel olarak kopyalar."""
    try:
        user_id = current_user["uid"]
        safe_item_path = req.file_id.replace("..", "").strip("/")
        logger.info(f"SHARE ATTEMPT: user_id={user_id}, file_id={req.file_id}, recipient_id={req.recipient_id}")
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        source_path = os.path.normpath(os.path.join(base_dir, safe_item_path))

        if not source_path.startswith(os.path.normpath(base_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path")

        if not await asyncio.to_thread(os.path.exists, source_path):
            raise HTTPException(status_code=404, detail="Source file not found")

        if await asyncio.to_thread(os.path.isdir, source_path):
            raise HTTPException(status_code=400, detail="Folder sharing is not supported via this endpoint")

        filename = os.path.basename(source_path)
        recipient_safe = req.recipient_id.replace("..", "").replace("/", "_").replace("\\", "_").strip()
        target_dir = os.path.join(settings.UPLOADS_DIR, "shared", recipient_safe)
        await asyncio.to_thread(os.makedirs, target_dir, exist_ok=True)

        target_path = os.path.join(target_dir, filename)
        if await asyncio.to_thread(os.path.exists, target_path):
            base, ext = os.path.splitext(filename)
            target_path = os.path.join(target_dir, f"{base}_{int(datetime.now().timestamp())}{ext}")

        await asyncio.to_thread(shutil.copy2, source_path, target_path)

        relative_path_from_data = os.path.relpath(target_path, DATA_DIR).replace("\\", "/")
        relative_url = f"/{relative_path_from_data}"

        return {
            "url": relative_url,
            "name": os.path.basename(target_path),
            "type": "file",
            "path": os.path.relpath(target_path, base_dir).replace("\\", "/")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SHARE ERROR: user_id={user_id}, file_id={req.file_id}, recipient_id={req.recipient_id}, error={str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-item/{file_id:path}")
async def delete_item(
    file_id: str,
    scope: str = Query("reports"),
    current_user: dict = Depends(get_current_user)
):
    """Dosya veya klasörü zorla siler."""
    import logging
    logger = logging.getLogger("app.files")
    user_id = current_user["uid"]
    
    try:
        logger.info(f"SİLME TALEBİ: {file_id} (UID: {user_id})")
        
        safe_item_path = file_id.replace("..", "").strip("/")
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        full_path = os.path.normpath(os.path.join(base_dir, safe_item_path))
        
        if not os.path.exists(full_path):
            logger.error(f"SİLME HATASI: Yol bulunamadı -> {full_path}")
            return {"status": "success", "message": "Dosya zaten mevcut değil."}
            
        # Yetki kontrolü (Admin bypass dahil)
        is_admin = current_user.get("role") == "admin"
        if not (is_admin or IS_DESKTOP or FolderManager.check_permission(safe_item_path, user_id, "delete")):
            logger.warning(f"SİLME REDDEDİLDİ: Yetki yok -> {user_id}")
            raise HTTPException(status_code=403, detail="Bu dosyayı silme yetkiniz yok.")
            
        if os.path.isdir(full_path):
            # Klasörü ve içindekileri (kilitli/salt okunur olsa bile) sil
            def remove_readonly(func, path, _):
                import stat
                try:
                    os.chmod(path, stat.S_IWRITE)
                    func(path)
                except: pass

            await asyncio.to_thread(shutil.rmtree, full_path, onerror=remove_readonly)
            logger.info(f"KLASÖR SİLİNDİ: {full_path}")
        else:
            # Dosyayı sil
            try:
                import stat
                os.chmod(full_path, stat.S_IWRITE)
            except: pass
            await asyncio.to_thread(os.remove, full_path)
            logger.info(f"DOSYA SİLİNDİ: {full_path}")
            
        return {"status": "success", "message": "Başarıyla silindi"}
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"SİLME KRİTİK HATA: {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Silme Hatası: {error_msg}")

@router.post("/open-file/{file_id:path}")
async def open_file(
    file_id: str,
    scope: str = Query("reports"),
    current_user: dict = Depends(get_current_user)
):
    """Opens the specified file with the default OS application."""
    try:
        # Prevent traversal attacks
        safe_item_path = file_id.replace("..", "").strip("/")
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        full_path = os.path.normpath(os.path.join(base_dir, safe_item_path))

        is_admin = current_user.get("role") == "admin"
        if not (is_admin or IS_DESKTOP or FolderManager.check_permission(safe_item_path, current_user["uid"], "read")):
            raise HTTPException(status_code=403, detail="Bu dosyayı açma yetkiniz yok.")
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            raise HTTPException(status_code=404, detail="Item not found")
            
        if await asyncio.to_thread(os.path.isdir, full_path):
            # If it's a directory, use open_folder logic instead or just startfile
            pass
            
        # Open in default app (DESKTOP ONLY)
        if not IS_DESKTOP:
            raise HTTPException(status_code=403, detail="Dosya açma sadece masaüstü uygulamasında kullanılabilir.")
        if os.name == 'nt': # Windows
            await asyncio.to_thread(os.startfile, full_path)
        elif os.name == 'posix': # Mac/Linux
            import subprocess
            import platform
            if platform.system() == 'Darwin':
                subprocess.run(['open', full_path])
            else:
                subprocess.run(['xdg-open', full_path])
            
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Dosya açılırken hata oluştu.")

@router.post("/open-folder/{file_id:path}")
async def open_folder(
    file_id: str,
    scope: str = Query("reports"),
    current_user: dict = Depends(get_current_user)
):
    """Opens the specified folder (or the parent folder of a file) in the OS explorer."""
    try:
        # Prevent traversal attacks
        safe_item_path = file_id.replace("..", "").strip("/")
        base_dir = BASE_OTHER_DIR if scope == "other" else BASE_REPORTS_DIR
        full_path = os.path.normpath(os.path.join(base_dir, safe_item_path))

        is_admin = current_user.get("role") == "admin"
        if not (is_admin or IS_DESKTOP or FolderManager.check_permission(safe_item_path, current_user["uid"], "read")):
            raise HTTPException(status_code=403, detail="Bu klasoru açma yetkiniz yok.")
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            raise HTTPException(status_code=404, detail="Item not found")
            
        # If it's a file, open its parent directory
        is_dir = await asyncio.to_thread(os.path.isdir, full_path)
        target_path = full_path if is_dir else os.path.dirname(full_path)
            
        # Open in OS Explorer (DESKTOP ONLY)
        if not IS_DESKTOP:
            raise HTTPException(status_code=403, detail="Klasör açma sadece masaüstü uygulamasında kullanılabilir.")
        if os.name == 'nt': # Windows
            await asyncio.to_thread(os.startfile, target_path)
        elif os.name == 'posix': # Mac/Linux
            import subprocess
            import platform
            if platform.system() == 'Darwin':
                subprocess.run(['open', target_path])
            else:
                subprocess.run(['xdg-open', target_path])
            
        return {"status": "success"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail="Klasör açılırken hata oluştu.")


@router.post("/open-task-folder/{task_id}")
async def open_task_folder(
    task_id: str,
    metadata: Optional[TaskFolderMetadata] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Belirli bir göreve (Task) ait ana klasörü işletim sistemi gezgininde açar.
    """
    try:
        task_data = {}
        if metadata and (metadata.rapor_adi or metadata.rapor_kodu):
            task_data = {
                'baslama_tarihi': metadata.baslama_tarihi or datetime.utcnow().isoformat().split('T')[0],
                'rapor_turu': metadata.rapor_turu or 'Diger',
                'rapor_kodu': metadata.rapor_kodu or 'Kodsuz',
                'rapor_adi': metadata.rapor_adi or 'Basliksiz',
                'owner_id': current_user.get("uid"),
                'assigned_to': [current_user.get("uid")],
                'accepted_collaborators': [],
                'shared_with': []
            }
        else:
            from app.lib.firebase_admin import db
            task_ref = db.collection('tasks').document(str(task_id))
            task_doc = await asyncio.to_thread(task_ref.get)
            if not task_doc.exists:
                raise HTTPException(status_code=404, detail="Göreve ait klasör bilgisi bulunamadı.")
            task_data = task_doc.to_dict() or {}
        
        # Calculate year, type, code, title
        start_date_str = task_data.get('baslama_tarihi')
        year = FolderManager.extract_year(start_date_str)
                
        audit_type = task_data.get('rapor_turu', 'Diger') or 'Diger'
        audit_code = task_data.get('rapor_kodu', 'Kodsuz') or 'Kodsuz'
        audit_title = task_data.get('rapor_adi', 'Basliksiz') or 'Basliksiz'
        
        # Permission check based on task owner, assignees, collaborators
        owner_id = task_data.get('owner_id')
        assigned_to = task_data.get('assigned_to') or []
        accepted_collaborators = task_data.get('accepted_collaborators') or []
        shared_with = task_data.get('shared_with') or []
        
        uid = current_user["uid"]
        is_owner = uid == owner_id
        is_assigned = uid in assigned_to
        is_collaborator = uid in accepted_collaborators or uid in shared_with
        is_admin = current_user.get("role") == "admin"
        
        if not (is_owner or is_assigned or is_collaborator or is_admin):
            raise HTTPException(status_code=403, detail="Bu görev klasörünü açma yetkiniz yok.")
            
        audit_rel_path = FolderManager.get_audit_relative_path(
            year,
            audit_type,
            audit_code,
            audit_title
        )
        
        # Register/Sync permissions in file_permissions.json
        allowed_users = list(set([owner_id or uid] + assigned_to + accepted_collaborators + shared_with))
        permissions_dict = {
            "read": allowed_users,
            "write": allowed_users,
            "delete": [owner_id or uid]
        }
        await asyncio.to_thread(
            FolderManager.set_permission,
            audit_rel_path,
            owner_id or uid,
            allowed_users,
            permissions_dict
        )
        
        # Calculate full path
        full_path = await asyncio.to_thread(
            FolderManager.get_audit_path,
            year,
            audit_type,
            audit_code,
            audit_title
        )
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            # Create standard subfolders
            await asyncio.to_thread(os.makedirs, full_path, exist_ok=True)
            await asyncio.to_thread(
                FolderManager.ensure_audit_folders,
                year,
                audit_type,
                audit_code,
                audit_title
            )

        # Open in OS Explorer
        if os.name == 'nt': # Windows
            await asyncio.to_thread(os.startfile, full_path)
        elif os.name == 'posix': # Mac/Linux
            import subprocess
            import platform
            if platform.system() == 'Darwin':
                subprocess.run(['open', full_path])
            else:
                subprocess.run(['xdg-open', full_path])
            
        return {"status": "success", "path": full_path}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-task-folder/{task_id}")
async def create_task_folder_endpoint(
    task_id: str,
    metadata: Optional[TaskFolderMetadata] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Belirli bir göreve (Task) ait klasör yapısını (kabul edildiğinde) işletim sisteminde oluşturur (açmaz).
    """
    try:
        task_data = {}
        if metadata and (metadata.rapor_adi or metadata.rapor_kodu):
            task_data = {
                'baslama_tarihi': metadata.baslama_tarihi or datetime.utcnow().isoformat().split('T')[0],
                'rapor_turu': metadata.rapor_turu or 'Diger',
                'rapor_kodu': metadata.rapor_kodu or 'Kodsuz',
                'rapor_adi': metadata.rapor_adi or 'Basliksiz',
                'owner_id': current_user.get("uid"),
                'assigned_to': [current_user.get("uid")],
                'accepted_collaborators': [],
                'shared_with': []
            }
        else:
            from app.lib.firebase_admin import db
            task_ref = db.collection('tasks').document(str(task_id))
            task_doc = await asyncio.to_thread(task_ref.get)
            if not task_doc.exists:
                raise HTTPException(status_code=404, detail="Göreve ait klasör bilgisi bulunamadı.")
            task_data = task_doc.to_dict() or {}
        
        # Calculate year, type, code, title
        start_date_str = task_data.get('baslama_tarihi')
        year = FolderManager.extract_year(start_date_str)
                
        audit_type = task_data.get('rapor_turu', 'Diger') or 'Diger'
        audit_code = task_data.get('rapor_kodu', 'Kodsuz') or 'Kodsuz'
        audit_title = task_data.get('rapor_adi', 'Basliksiz') or 'Basliksiz'
        
        # Calculate full path
        full_path = await asyncio.to_thread(
            FolderManager.get_audit_path,
            year,
            audit_type,
            audit_code,
            audit_title
        )
        
        # Register/Sync permissions in file_permissions.json
        owner_id = task_data.get('owner_id')
        assigned_to = task_data.get('assigned_to') or []
        accepted_collaborators = task_data.get('accepted_collaborators') or []
        shared_with = task_data.get('shared_with') or []
        
        uid = current_user["uid"]
        allowed_users = list(set([owner_id or uid] + assigned_to + accepted_collaborators + shared_with))
        permissions_dict = {
            "read": allowed_users,
            "write": allowed_users,
            "delete": [owner_id or uid]
        }
        
        audit_rel_path = FolderManager.get_audit_relative_path(
            year,
            audit_type,
            audit_code,
            audit_title
        )
        await asyncio.to_thread(
            FolderManager.set_permission,
            audit_rel_path,
            owner_id or uid,
            allowed_users,
            permissions_dict
        )
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            await asyncio.to_thread(os.makedirs, full_path, exist_ok=True)
            await asyncio.to_thread(
                FolderManager.ensure_audit_folders,
                year,
                audit_type,
                audit_code,
                audit_title
            )
            
        return {"status": "success", "path": full_path, "message": "Klasörler oluşturuldu."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# New DOCX generation endpoints
from app.lib.docx_generator import (
    generate_kapak_docx,
    generate_dizi_docx,
    generate_evrak_talebi_docx,
    generate_degerlendirme_docx
)

class KapakDocxRequest(BaseModel):
    arsivNo: Optional[str] = ""
    raporSayisi: Optional[str] = ""
    raporTuru: Optional[str] = ""
    tarih: Optional[str] = ""
    yer: Optional[str] = ""
    onayTarihi: Optional[str] = ""
    onaySayisi: Optional[str] = ""
    gorevEmriTarihi: Optional[str] = ""
    gorevEmriSayisi: Optional[str] = ""
    sayfaAdedi: Optional[str] = ""
    ekAdedi: Optional[str] = ""
    ekSayfaAdedi: Optional[str] = ""
    ilgiliBirim: Optional[str] = ""
    konu: Optional[str] = ""
    evaluators: List[dict] = []
    htmlSnapshot: Optional[str] = ""
    scope: Optional[str] = "reports"
    path: Optional[str] = ""
    openAfterGenerate: Optional[bool] = True

class DiziDocxRequest(BaseModel):
    items: List[dict] = []
    evaluators: List[dict] = []
    scope: Optional[str] = "reports"
    path: Optional[str] = ""

class EvrakTalebiDocxRequest(BaseModel):
    olurTarihi: Optional[str] = ""
    olurSayisi: Optional[str] = ""
    gorevTarihi: Optional[str] = ""
    gorevSayisi: Optional[str] = ""
    mufettisAdi: Optional[str] = ""
    mufettisUnvani: Optional[str] = ""
    denetimDonemi: Optional[str] = ""
    denetimYili: Optional[str] = ""
    donemMusabaka: Optional[str] = ""
    teslimSuresi: Optional[str] = ""
    selectedItemsText: List[str] = []
    scope: Optional[str] = "reports"
    path: Optional[str] = ""

@router.post("/generate-docx-kapak")
async def generate_docx_kapak_endpoint(
    req: KapakDocxRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        template_path = os.path.join(project_root, "frontend", "public", "kapak.docx")
        
        base_dir = BASE_OTHER_DIR if req.scope == "other" else BASE_REPORTS_DIR
        output_dir = base_dir
        if req.path:
            safe_path = os.path.normpath(req.path).replace("..", "").lstrip(os.sep)
            output_dir = os.path.join(base_dir, safe_path)
            
        await asyncio.to_thread(os.makedirs, output_dir, exist_ok=True)
        filename = f"Rapor_Kapagi_{int(datetime.now().timestamp())}.docx"
        output_path = os.path.join(output_dir, filename)
        
        await asyncio.to_thread(generate_kapak_docx, template_path, output_path, req.dict())
        
        if req.openAfterGenerate and IS_DESKTOP and os.name == 'nt':
            await asyncio.to_thread(os.startfile, output_path)
            
        rel_path = os.path.relpath(output_path, base_dir).replace("\\", "/")
        return {"status": "success", "filename": filename, "path": rel_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-docx-dizi")
async def generate_docx_dizi_endpoint(
    req: DiziDocxRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        template_name = "dizi_pusulasi.docx" if os.path.exists(os.path.join(project_root, "frontend", "public", "dizi_pusulasi.docx")) else "dizi pusulası.docx"
        template_path = os.path.join(project_root, "frontend", "public", template_name)
        
        base_dir = BASE_OTHER_DIR if req.scope == "other" else BASE_REPORTS_DIR
        output_dir = base_dir
        if req.path:
            safe_path = os.path.normpath(req.path).replace("..", "").lstrip(os.sep)
            output_dir = os.path.join(base_dir, safe_path)
            
        await asyncio.to_thread(os.makedirs, output_dir, exist_ok=True)
        filename = f"Dizi_Pusulasi_{int(datetime.now().timestamp())}.docx"
        output_path = os.path.join(output_dir, filename)
        
        await asyncio.to_thread(generate_dizi_docx, template_path, output_path, req.dict())
        
        if IS_DESKTOP and os.name == 'nt':
            await asyncio.to_thread(os.startfile, output_path)
            
        rel_path = os.path.relpath(output_path, base_dir).replace("\\", "/")
        return {"status": "success", "filename": filename, "path": rel_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-docx-hazirlik")
async def generate_docx_hazirlik_endpoint(
    req: EvrakTalebiDocxRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        template_path = os.path.join(project_root, "frontend", "public", "Teftiş Öncesi Hazırlanılması İstenilen Hususlar.docx")
        
        base_dir = BASE_OTHER_DIR if req.scope == "other" else BASE_REPORTS_DIR
        output_dir = base_dir
        if req.path:
            safe_path = os.path.normpath(req.path).replace("..", "").lstrip(os.sep)
            output_dir = os.path.join(base_dir, safe_path)
            
        await asyncio.to_thread(os.makedirs, output_dir, exist_ok=True)
        filename = f"Evrak_Talebi_{int(datetime.now().timestamp())}.docx"
        output_path = os.path.join(output_dir, filename)
        
        await asyncio.to_thread(generate_evrak_talebi_docx, template_path, output_path, req.dict())
        
        if IS_DESKTOP and os.name == 'nt':
            await asyncio.to_thread(os.startfile, output_path)
            
        rel_path = os.path.relpath(output_path, base_dir).replace("\\", "/")
        return {"status": "success", "filename": filename, "path": rel_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class DegerlendirmeDocxRequest(BaseModel):
    date: Optional[str] = ""
    fullName: Optional[str] = ""
    title: Optional[str] = ""
    ratings: dict = {}
    notes: Optional[str] = ""
    evaluatorName: Optional[str] = ""
    evaluatorTitle: Optional[str] = ""
    signature: Optional[str] = ""
    scope: Optional[str] = "reports"
    path: Optional[str] = ""

@router.post("/generate-docx-degerlendirme")
async def generate_docx_degerlendirme_endpoint(
    req: DegerlendirmeDocxRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        base_dir = BASE_OTHER_DIR if req.scope == "other" else BASE_REPORTS_DIR
        output_dir = base_dir
        if req.path:
            safe_path = os.path.normpath(req.path).replace("..", "").lstrip(os.sep)
            output_dir = os.path.join(base_dir, safe_path)
            
        await asyncio.to_thread(os.makedirs, output_dir, exist_ok=True)
        filename = f"Degerlendirme_Formu_{int(datetime.now().timestamp())}.docx"
        output_path = os.path.join(output_dir, filename)
        
        await asyncio.to_thread(generate_degerlendirme_docx, output_path, req.dict())
        
        if IS_DESKTOP and os.name == 'nt':
            await asyncio.to_thread(os.startfile, output_path)
            
        rel_path = os.path.relpath(output_path, base_dir).replace("\\", "/")
        return {"status": "success", "filename": filename, "path": rel_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
