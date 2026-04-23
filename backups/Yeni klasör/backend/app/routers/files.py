import os
import uuid
import shutil
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.lib.folder_manager import FolderManager, BASE_REPORTS_DIR, STANDARD_SUBFOLDERS

router = APIRouter(tags=["files"])



class FileItem(BaseModel):
    id: str
    name: str
    type: str # 'file' | 'folder'
    parentId: Optional[str] = None
    size: Optional[str] = None
    date: Optional[str] = None

class UploadResponse(BaseModel):
    url: str
    name: str
    type: str
    path: str

class CreateFolderRequest(BaseModel):
    parentId: Optional[str] = None
    name: str

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...), 
    path: str = Query(None, description="Relative path from Raporlar root")
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
        relative_url = os.path.relpath(file_path, os.path.dirname(os.path.dirname(os.path.dirname(__file__)))).replace("\\", "/")
        
        return {
            "url": f"/{relative_url}",
            "name": os.path.basename(file_path),
            "type": media_type,
            "path": os.path.relpath(file_path, BASE_REPORTS_DIR).replace("\\", "/")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tree", response_model=List[FileItem])
async def get_file_tree():
    """Returns the actual file hierarchy from the Raporlar directory."""
    try:
        return await asyncio.to_thread(FolderManager.get_tree)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-folder")
async def create_folder(req: CreateFolderRequest):
    try:
        base = BASE_REPORTS_DIR
        if req.parentId:
            safe_parent = req.parentId.replace("..", "").strip("/")
            base = os.path.join(BASE_REPORTS_DIR, safe_parent)
        
        new_path = os.path.join(base, req.name)
        await asyncio.to_thread(os.makedirs, new_path, exist_ok=True)
        return {"id": os.path.relpath(new_path, BASE_REPORTS_DIR).replace("\\", "/"), "name": req.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{file_id:path}")
async def delete_item(file_id: str):
    try:
        safe_item_path = file_id.replace("..", "").strip("/")
        full_path = os.path.join(BASE_REPORTS_DIR, safe_item_path)
        
        if not await asyncio.to_thread(os.path.exists, full_path):
            raise HTTPException(status_code=404, detail="Item not found")
            
        if await asyncio.to_thread(os.path.isdir, full_path):
            await asyncio.to_thread(shutil.rmtree, full_path)
        else:
            await asyncio.to_thread(os.remove, full_path)
            
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
        elif os.name == 'posix': # Mac/Linux (just in case)
            import subprocess
            try:
                import platform
                if platform.system() == 'Darwin':
                    subprocess.run(['open', target_path])
                else:
                    subprocess.run(['xdg-open', target_path])
            except:
                pass
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
