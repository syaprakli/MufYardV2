import os
import uuid
import shutil
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.lib.folder_manager import FolderManager, BASE_REPORTS_DIR, STANDARD_SUBFOLDERS
from app.config import BASE_DIR
from app.config import settings, DATA_DIR
def get_current_user_id(uid: Optional[str] = Query(None)):
    # Query parametresinden uid varsa onu kullan, yoksa fallback
    return uid or "user_1"

router = APIRouter(tags=["files"])



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

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...), 
    path: str = Query(None, description="Relative path from Raporlar root"),
    user_id: str = Depends(get_current_user_id)
):
    try:
        # Determine target directory
        target_dir = BASE_REPORTS_DIR
        if path:
            # Clean path to prevent traversal attacks
            safe_path = path.replace("..", "").strip("/")
            target_dir = os.path.join(BASE_REPORTS_DIR, safe_path)
        
        if not await asyncio.to_thread(os.path.exists, target_dir):
            await asyncio.to_thread(os.makedirs, target_dir, exist_ok=True)

        file_path = os.path.join(target_dir, file.filename)
        
        # If file exists, add a suffix
        if await asyncio.to_thread(os.path.exists, file_path):
            base, ext = os.path.splitext(file.filename)
            file_path = os.path.join(target_dir, f"{base}_{int(datetime.now().timestamp())}{ext}")

        def save_file(f, p):
            with open(p, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
        
        await asyncio.to_thread(save_file, file, file_path)
        
        # Binary type detection (simplified)
        mime_type = file.content_type
        media_type = "file"
        if mime_type.startswith("image/"): media_type = "image"
        elif mime_type.startswith("video/"): media_type = "video"
        elif mime_type.startswith("audio/"): media_type = "audio"
        elif "pdf" in mime_type: media_type = "pdf"

        # Return relative URL for front-end access if mounted
        # We use the mount points defined in main.py (/Raporlar, /uploads, etc.)
        from app.config import DATA_DIR
        relative_path_from_data = os.path.relpath(file_path, DATA_DIR).replace("\\", "/")
        relative_url = f"/{relative_path_from_data}"
        
        # Dosya izinlerini kaydet
        rel_file_id = os.path.relpath(file_path, BASE_REPORTS_DIR).replace("\\", "/")
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
            "path": os.path.relpath(file_path, BASE_REPORTS_DIR).replace("\\", "/")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tree", response_model=List[FileItem])
async def get_file_tree(user_id: str = Depends(get_current_user_id)):
    """Tüm dosya/klasörleri döndürür."""
    try:
        all_items = await asyncio.to_thread(FolderManager.get_tree)
        return all_items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-folder")
async def create_folder(req: CreateFolderRequest, user_id: str = Depends(get_current_user_id)):
    try:
        base = BASE_REPORTS_DIR
        if req.parentId:
            safe_parent = req.parentId.replace("..", "").strip("/")
            base = os.path.join(BASE_REPORTS_DIR, safe_parent)
        
        new_path = os.path.join(base, req.name)
        await asyncio.to_thread(os.makedirs, new_path, exist_ok=True)
        rel_folder_id = os.path.relpath(new_path, BASE_REPORTS_DIR).replace("\\", "/")
        # Klasör izinlerini ata
        from app.lib.folder_manager import FolderManager
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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/share-to-user", response_model=UploadResponse)
async def share_file_to_user(req: ShareFileRequest, user_id: str = Depends(get_current_user_id)):
    """Paylasilan dosyayi aliciya ait klasore fiziksel olarak kopyalar."""
    try:
        safe_item_path = req.file_id.replace("..", "").strip("/")
        source_path = os.path.normpath(os.path.join(BASE_REPORTS_DIR, safe_item_path))

        if not source_path.startswith(os.path.normpath(BASE_REPORTS_DIR)):
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
            "path": os.path.relpath(target_path, BASE_REPORTS_DIR).replace("\\", "/")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-item/{file_id:path}")
async def delete_item(file_id: str, uid: Optional[str] = Query(None)):
    """Dosya veya klasörü zorla siler."""
    import logging
    logger = logging.getLogger("app.files")
    user_id = uid or "user_1"
    
    try:
        logger.info(f"SİLME TALEBİ: {file_id} (UID: {user_id})")
        
        safe_item_path = file_id.replace("..", "").strip("/")
        full_path = os.path.normpath(os.path.join(BASE_REPORTS_DIR, safe_item_path))
        
        if not os.path.exists(full_path):
            logger.error(f"SİLME HATASI: Yol bulunamadı -> {full_path}")
            return {"status": "success", "message": "Dosya zaten mevcut değil."}
            
        # Yetki kontrolü (Admin bypass dahil)
        if not FolderManager.check_permission(safe_item_path, user_id, "delete"):
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
async def open_file(file_id: str):
    """Opens the specified file with the default OS application."""
    try:
        # Prevent traversal attacks
        safe_item_path = file_id.replace("..", "").strip("/")
        full_path = os.path.normpath(os.path.join(BASE_REPORTS_DIR, safe_item_path))
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            raise HTTPException(status_code=404, detail="Item not found")
            
        if await asyncio.to_thread(os.path.isdir, full_path):
            # If it's a directory, use open_folder logic instead or just startfile
            pass
            
        # Open in default app
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-folder/{file_id:path}")
async def open_folder(file_id: str):
    """Opens the specified folder (or the parent folder of a file) in the OS explorer."""
    try:
        # Prevent traversal attacks
        safe_item_path = file_id.replace("..", "").strip("/")
        full_path = os.path.normpath(os.path.join(BASE_REPORTS_DIR, safe_item_path))
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            raise HTTPException(status_code=404, detail="Item not found")
            
        # If it's a file, open its parent directory
        is_dir = await asyncio.to_thread(os.path.isdir, full_path)
        target_path = full_path if is_dir else os.path.dirname(full_path)
            
        # Open in OS Explorer
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-task-folder/{task_id}")
async def open_task_folder(task_id: str):
    """
    Belirli bir göreve (Task) ait ana klasörü işletim sistemi gezgininde açar.
    """
    try:
        from app.services.audit_service import AuditService
        context = await AuditService._resolve_task_folder_context(task_id)
        if not context:
            raise HTTPException(status_code=404, detail="Göreve ait klasör bilgisi bulunamadı.")
        
        # FolderManager üzerinden tam yolu hesapla
        full_path = await asyncio.to_thread(
            FolderManager.get_audit_path,
            context['year'],
            context['audit_type'],
            context['audit_code'],
            context['audit_title']
        )
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            # Klasör henüz oluşturulmamış olabilir, oluşturup açalım mı? 
            # Kullanıcı beklentisi açılması yönünde olduğu için oluşturuyoruz.
            await asyncio.to_thread(os.makedirs, full_path, exist_ok=True)
            # Standart alt klasörleri de garanti edelim
            await asyncio.to_thread(
                FolderManager.ensure_audit_folders,
                context['year'],
                context['audit_type'],
                context['audit_code'],
                context['audit_title']
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
