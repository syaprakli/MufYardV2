import os
import subprocess
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Depends
from typing import List, Optional, Dict, Any
import asyncio
from app.services.legislation_service import LegislationService
from app.services.extractor_service import ExtractorService
from app.services.legislation_crawler import LegislationCrawlerService
from app.lib.auth import get_current_user, require_roles
from app.config import get_settings
settings = get_settings()

MEVZUAT_DIR = settings.MEVZUAT_DIR

router = APIRouter(tags=["legislation"])


def _is_admin_like(current_user: Dict[str, Any]) -> bool:
    role = (current_user.get("role") or "user").strip().lower()
    return role in {"admin", "moderator"}

@router.post("/fetch-external")
async def fetch_external_legislation(data: dict, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Fetches legislation metadata from an external source like mevzuat.gov.tr"""
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL belirtilmedi.")
    
    result = await LegislationCrawlerService.fetch_from_mevzuat_gov_tr(url)
    if not result:
        raise HTTPException(status_code=400, detail="Mevzuat bilgileri çekilemedi. Lütfen URL'yi kontrol edin.")
    return result

@router.post("/open-folder")
async def open_legislation_folder(
    category: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Opens a Windows Explorer folder for the specified category/type or the root directory."""
    try:
        import sys
        path = MEVZUAT_DIR
        # Ensure default subfolders exist so user sees standard folders
        for sub in ["GSB", "KYK", "Federasyon", "Özel Yurt", "Spor Kulüpleri", "Genel"]:
            os.makedirs(os.path.join(MEVZUAT_DIR, sub), exist_ok=True)

        if category and category != "Tümü":
            if doc_type:
                path = os.path.join(MEVZUAT_DIR, category, doc_type)
            else:
                path = os.path.join(MEVZUAT_DIR, category)
            
        os.makedirs(path, exist_ok=True)
        abs_p = os.path.abspath(path)
            
        # Open in OS Explorer (exact same pattern as files.py)
        if os.name == 'nt':
            await asyncio.to_thread(os.startfile, abs_p)
        elif sys.platform == 'darwin':
            await asyncio.to_thread(subprocess.run, ['open', abs_p])
        else:
            await asyncio.to_thread(subprocess.run, ['xdg-open', abs_p])
        return {"status": "success", "path": abs_p}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-file-location")
async def open_file_location(
    file_path: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Opens Windows Explorer with the target file or its folder."""
    try:
        import sys
        target_path = None
        
        # 0. Check if file_path is a web URL
        is_web_url = bool(file_path and (file_path.startswith("http://") or file_path.startswith("https://")))
        if is_web_url:
            file_path = None  # Don't treat web URL as a local file path
        
        # 1. Resolve file path if given
        if file_path:
            clean_fp = file_path.replace("\\", "/")
            if "/Mevzuat/" in clean_fp:
                rel = clean_fp.split("/Mevzuat/", 1)[1]
                cand = os.path.join(MEVZUAT_DIR, rel.replace("/", os.sep))
                if os.path.exists(cand):
                    target_path = cand
            elif os.path.isabs(file_path) and os.path.exists(file_path):
                target_path = file_path
            else:
                cand = os.path.join(MEVZUAT_DIR, file_path.lstrip("/\\").replace("/", os.sep))
                if os.path.exists(cand):
                    target_path = cand
                elif category:
                    if doc_type:
                        cand2 = os.path.join(MEVZUAT_DIR, category, doc_type, os.path.basename(file_path))
                    else:
                        cand2 = os.path.join(MEVZUAT_DIR, category, os.path.basename(file_path))
                    if os.path.exists(cand2):
                        target_path = cand2

            # Search by filename if target_path doesn't exist yet
            if not target_path or not os.path.exists(target_path):
                fname = os.path.basename(clean_fp)
                if fname and not fname.startswith("http"):
                    for root, _, files in os.walk(MEVZUAT_DIR):
                        if fname in files:
                            target_path = os.path.join(root, fname)
                            break

        # 2. If file exists, open its parent directory or highlight
        if target_path and os.path.exists(target_path):
            abs_target = os.path.abspath(target_path)
            parent_dir = os.path.dirname(abs_target)
            if os.name == 'nt':
                # Try selecting the file; fallback to opening its parent directory
                try:
                    subprocess.Popen(['explorer.exe', f'/select,{abs_target}'])
                except Exception:
                    await asyncio.to_thread(os.startfile, parent_dir)
            elif sys.platform == 'darwin':
                await asyncio.to_thread(subprocess.run, ['open', '-R', abs_target])
            else:
                await asyncio.to_thread(subprocess.run, ['xdg-open', parent_dir])
            return {"status": "success", "type": "file", "path": abs_target}

        # 3. If file does not exist locally or is a web URL, open the category/doc_type folder
        dir_to_open = MEVZUAT_DIR
        if category and category != "Tümü":
            if doc_type:
                dir_to_open = os.path.join(MEVZUAT_DIR, category, doc_type)
            else:
                dir_to_open = os.path.join(MEVZUAT_DIR, category)
        elif target_path:
            dir_to_open = os.path.dirname(target_path)

        os.makedirs(dir_to_open, exist_ok=True)
        abs_dir = os.path.abspath(dir_to_open)
        if os.name == 'nt':
            await asyncio.to_thread(os.startfile, abs_dir)
        elif sys.platform == 'darwin':
            await asyncio.to_thread(subprocess.run, ['open', abs_dir])
        else:
            await asyncio.to_thread(subprocess.run, ['xdg-open', abs_dir])

        msg = "Bu mevzuat web üzerinden eklenmiş; ilgili mevzuat klasörü açıldı." if is_web_url else "Dosya yerel klasörde henüz yok, ilgili klasör açıldı."
        return {
            "status": "success",
            "type": "folder",
            "path": abs_dir,
            "message": msg
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-folder")
async def sync_legislation_folder(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Scans MEVZUAT_DIR for newly added files and registers them in Firestore."""
    try:
        from datetime import datetime
        from app.lib.firebase_admin import db
        os.makedirs(MEVZUAT_DIR, exist_ok=True)
        for sub in ["GSB", "KYK", "Federasyon", "Özel Yurt", "Spor Kulüpleri", "Genel"]:
            os.makedirs(os.path.join(MEVZUAT_DIR, sub), exist_ok=True)

        # 1. Fetch existing legislations from Firestore to avoid duplicate creation
        existing_docs = await asyncio.to_thread(lambda: list(db.collection('legislations').stream()))
        existing_paths = set()
        existing_titles = set()
        for d in existing_docs:
            data = d.to_dict()
            lp = data.get("local_path") or ""
            if lp:
                existing_paths.add(lp.lower().strip())
                existing_paths.add(os.path.basename(lp).lower().strip())
            title = data.get("title") or ""
            if title:
                existing_titles.add(title.lower().strip())

        supported_exts = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".rtf", ".png", ".jpg", ".jpeg"}
        
        imported_count = 0
        total_files = 0

        for root, dirs, files in os.walk(MEVZUAT_DIR):
            for file in files:
                if file.startswith("~$") or file.startswith("."):
                    continue # Skip office lock and hidden files
                name, ext = os.path.splitext(file)
                if ext.lower() not in supported_exts:
                    continue

                total_files += 1
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, MEVZUAT_DIR)
                rel_url = "/Mevzuat/" + rel_path.replace("\\", "/")

                # Check if already indexed
                if (rel_url.lower().strip() in existing_paths or 
                    file.lower().strip() in existing_paths):
                    continue

                # Determine category and doc_type
                parts = rel_path.split(os.sep)
                category = "Genel"
                doc_type = "Belge"

                if len(parts) >= 3:
                    category = parts[0]
                    doc_type = parts[1]
                elif len(parts) == 2:
                    category = parts[0]

                # If doc_type is still generic "Belge", infer from filename
                lower_name = name.lower()
                if "kanun" in lower_name:
                    doc_type = "Kanun"
                elif "khk" in lower_name:
                    doc_type = "KHK"
                elif "yonetmelik" in lower_name or "yönetmelik" in lower_name:
                    doc_type = "Yönetmelik"
                elif "genelge" in lower_name:
                    doc_type = "Genelge"
                elif "yonerge" in lower_name or "yönerge" in lower_name:
                    doc_type = "Yönerge"
                elif "talimat" in lower_name:
                    doc_type = "Talimat"
                elif "ozelge" in lower_name or "özelge" in lower_name:
                    doc_type = "Özelge"
                elif "rehber" in lower_name:
                    doc_type = "Rehber"
                elif "yazi" in lower_name or "yazı" in lower_name:
                    doc_type = "Yazı"

                # Generate clean readable title
                clean_title = name.replace("_", " ").replace("-", " ").strip()
                while "  " in clean_title:
                    clean_title = clean_title.replace("  ", " ")
                
                # Check if title already exists to avoid exact duplicate naming
                if clean_title.lower().strip() in existing_titles:
                    continue

                leg_data = {
                    "title": clean_title,
                    "category": category,
                    "doc_type": doc_type,
                    "summary": f"{clean_title} ({category} klasöründen senkronize edildi)",
                    "content": "",
                    "tags": [category, doc_type, "Mevzuat Klasörü"],
                    "document_url": "",
                    "local_path": rel_url,
                    "official_gazette_info": "",
                    "is_pinned": False,
                    "is_public": True,
                    "is_approved": True,
                    "is_archived": False,
                    "created_by_name": current_user.get("displayName") or current_user.get("email") or "Yerel Klasör",
                    "created_at": datetime.utcnow()
                }

                await asyncio.to_thread(db.collection('legislations').add, leg_data)
                existing_paths.add(rel_url.lower().strip())
                existing_paths.add(file.lower().strip())
                existing_titles.add(clean_title.lower().strip())
                imported_count += 1

        return {
            "status": "success",
            "imported_count": imported_count,
            "total_files": total_files,
            "folder_path": os.path.abspath(MEVZUAT_DIR),
            "message": f"{imported_count} yeni mevzuat belgesi klasörden başarıyla kütüphaneye eklendi." if imported_count > 0 else "Mevzuat klasörü taranmıştır, yeni eklenecek dosya bulunamadı."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Klasör senkronizasyon hatası: {str(e)}")

from app.schemas.legislation import LegislationCreate, LegislationUpdate, LegislationResponse

@router.post("/upload")
async def upload_legislation_file(
    file: UploadFile = File(...),
    category: str = Form(...),
    doc_type: str = Form(""),
    uid: Optional[str] = Form(None),
    is_public: bool = Form(True),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Uploads a file to Mevzuat. Can be shared (Genel) or Personal (Kisisel)."""
    try:
        # Validate extension
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']:
            raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı. (PDF, Word veya Resim yükleyin)")
            
        is_admin = _is_admin_like(current_user)
        caller_uid = current_user.get("uid")

        if not is_admin and is_public:
            raise HTTPException(status_code=403, detail="Genel mevzuat yükleme yalnızca yönetici/moderatör hesaplarına açıktır.")

        if not is_admin and uid and uid != caller_uid:
            raise HTTPException(status_code=403, detail="Başka kullanıcı adına mevzuat yükleyemezsiniz.")

        target_uid = uid
        if not is_public and not is_admin:
            target_uid = caller_uid

        file_url, local_path = await LegislationService.save_legislation_file(file, category, doc_type, target_uid, is_public)
        return {"file_url": file_url, "local_path": local_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_current_user)):
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
    category: Optional[str] = Query(None, description="Mevzuat kategorisi (Genel, Personel, vb.)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        is_admin = _is_admin_like(current_user)
        caller_uid = current_user.get("uid")
        if uid and not is_admin and uid != caller_uid:
            raise HTTPException(status_code=403, detail="Başka kullanıcının özel mevzuatına erişemezsiniz.")
        return await LegislationService.get_legislations(uid, category, is_admin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=LegislationResponse)
async def create_legislation(legislation: LegislationCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        is_admin = _is_admin_like(current_user)
        caller_uid = current_user.get("uid")

        if not is_admin and legislation.owner_id and legislation.owner_id != caller_uid:
            raise HTTPException(status_code=403, detail="Başka kullanıcı adına mevzuat oluşturamazsınız.")

        payload = legislation
        if not is_admin:
            payload = legislation.copy(update={"owner_id": caller_uid if not legislation.is_public else None})

        return await LegislationService.create_legislation(payload, is_admin)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{leg_id}/approve")
async def approve_legislation(
    leg_id: str,
    admin_name: str = Query(...),
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    success = await LegislationService.approve_legislation(leg_id, admin_name)
    if not success:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return {"status": "success"}

@router.post("/{leg_id}/reject")
async def reject_legislation(
    leg_id: str,
    current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator")),
):
    success = await LegislationService.reject_legislation(leg_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return {"status": "success"}

@router.patch("/{leg_id}", response_model=LegislationResponse)
async def update_legislation(
    leg_id: str,
    leg_update: LegislationUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    is_admin = _is_admin_like(current_user)
    caller_uid = current_user.get("uid")

    leg_data = await LegislationService.get_legislation_by_id(leg_id)
    if not leg_data:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")

    if not is_admin and leg_data.get("owner_id") != caller_uid:
        raise HTTPException(status_code=403, detail="Bu mevzuatı düzenleme yetkiniz yok.")

    updated = await LegislationService.update_legislation(leg_id, leg_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return updated

@router.delete("/{leg_id}")
async def delete_legislation(
    leg_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    is_admin = _is_admin_like(current_user)
    caller_uid = current_user.get("uid")

    leg_data = await LegislationService.get_legislation_by_id(leg_id)
    if not leg_data:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")

    if not is_admin and leg_data.get("owner_id") != caller_uid:
        raise HTTPException(status_code=403, detail="Bu mevzuatı silme yetkiniz yok.")

    success = await LegislationService.delete_legislation(leg_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mevzuat silinemedi.")
    return {"status": "success", "message": "Mevzuat silindi."}

@router.post("/{leg_id}/promote", response_model=LegislationResponse)
async def promote_legislation(
    leg_id: str,
    user_name: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Promotes a private legislation into the public shared library."""
    is_admin = _is_admin_like(current_user)
    caller_uid = current_user.get("uid")

    leg_data = await LegislationService.get_legislation_by_id(leg_id)
    if not leg_data:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")

    if not is_admin and leg_data.get("owner_id") != caller_uid:
        raise HTTPException(status_code=403, detail="Bu işlemi yapma yetkiniz yok.")

    promoted = await LegislationService.promote_to_public(leg_id, user_name)
    if not promoted:
        raise HTTPException(status_code=404, detail="Mevzuat bulunamadı.")
    return promoted



