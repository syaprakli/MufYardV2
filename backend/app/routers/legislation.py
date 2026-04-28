import os
import subprocess
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from typing import List, Optional
import asyncio
from app.services.legislation_service import LegislationService
from app.services.extractor_service import ExtractorService
from app.config import get_settings
settings = get_settings()

MEVZUAT_DIR = settings.MEVZUAT_DIR

router = APIRouter(tags=["legislation"])

@router.post("/open-folder")
async def open_legislation_folder(
    category: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None)
):
    """Opens a Windows Explorer folder for the specified category/type or the root directory."""
    try:
        path = MEVZUAT_DIR
        if category and category != "Tümü":
            if doc_type:
                path = os.path.join(MEVZUAT_DIR, category, doc_type)
            else:
                path = os.path.join(MEVZUAT_DIR, category)
            
        if not os.path.exists(path):
            os.makedirs(path, exist_ok=True)
            
        # os.startfile is non-blocking on Windows
        os.startfile(os.path.abspath(path))
        return {"status": "success", "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.schemas.legislation import LegislationCreate, LegislationUpdate, LegislationResponse

@router.post("/upload")
async def upload_legislation_file(
    file: UploadFile = File(...),
    category: str = Form(...),
    doc_type: str = Form(""),
    uid: Optional[str] = Form(None),
    is_public: bool = Form(True)
):
    """Uploads a file to Mevzuat. Can be shared (Genel) or Personal (Kisisel)."""
    try:
        # Validate extension
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']:
            raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı. (PDF, Word veya Resim yükleyin)")
            
        file_url = await LegislationService.save_legislation_file(file, category, doc_type, uid, is_public)
        return {"file_url": file_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Extracts text from an uploaded PDF or Word document."""
    try:
        text = await ExtractorService.extract_text(file)
        return {"text": text}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metin ayıklama sırasında hata oluştu: {str(e)}")

@router.get("/", response_model=List[LegislationResponse])
async def get_legislations(
    uid: Optional[str] = Query(None),
    category: Optional[str] = Query(None, description="Mevzuat kategorisi (Genel, Personel, vb.)")
):
    try:
        return await LegislationService.get_legislations(uid, category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=LegislationResponse)
async def create_legislation(legislation: LegislationCreate):
    try:
        return await LegislationService.create_legislation(legislation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{leg_id}", response_model=LegislationResponse)
async def update_legislation(leg_id: str, leg_update: LegislationUpdate):
    updated = await LegislationService.update_legislation(leg_id, leg_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return updated

@router.delete("/{leg_id}")
async def delete_legislation(leg_id: str):
    success = await LegislationService.delete_legislation(leg_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mevzuat silinemedi.")
    return {"status": "success", "message": "Mevzuat silindi."}

@router.post("/{leg_id}/promote", response_model=LegislationResponse)
async def promote_legislation(leg_id: str, user_name: str = Query(...)):
    """Promotes a private legislation into the public shared library."""
    promoted = await LegislationService.promote_to_public(leg_id, user_name)
    if not promoted:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return promoted

