import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional, Dict, Any
from app.services.task_service import TaskService
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from app.lib.auth import get_current_user
from app.lib.firebase_admin import db

router = APIRouter(tags=["tasks"])


@router.get("/", response_model=List[TaskResponse])
async def get_tasks(current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        return await TaskService.get_tasks(current_user.get("uid"), current_user.get("email"))
    except Exception:
        raise HTTPException(status_code=500, detail="Beklenmeyen bir hata oluştu.")


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        task.owner_id = current_user.get("uid")
        return await TaskService.create_task(task)
    except Exception:
        raise HTTPException(status_code=500, detail="Görev oluşturulurken bir hata oluştu.")


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        role = (current_user.get("role") or "user").strip().lower()
        uid = current_user.get("uid")
        email = current_user.get("email")
        identity_keys = [value for value in [uid, email] if value]

        doc_ref = db.collection("tasks").document(task_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Görev bulunamadı.")

        data = doc.to_dict() or {}
        owner_id = data.get("owner_id")
        assigned_to = data.get("assigned_to", [])
        shared_with = data.get("shared_with", [])
        accepted = data.get("accepted_collaborators", [])

        can_edit = role in ["admin", "moderator"] or (
            owner_id in identity_keys
            or any(identity in assigned_to for identity in identity_keys)
            or any(identity in shared_with for identity in identity_keys)
            or any(identity in accepted for identity in identity_keys)
        )
        if not can_edit:
            raise HTTPException(status_code=403, detail="Bu görevi güncelleme yetkiniz yok.")

        updated = await TaskService.update_task(task_id, task_update)
        if not updated:
            raise HTTPException(status_code=404, detail="Görev bulunamadı.")
        return updated
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Görev güncellenirken bir hata oluştu.")


@router.post("/{task_id}/accept")
async def accept_task(task_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await TaskService.accept_task(task_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Görev kabul edilemedi veya bulunamadı.")
        return {"status": "success", "message": "Görev kabul edildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Görev kabul edilirken bir hata oluştu.")


@router.post("/{task_id}/reject")
async def reject_task(task_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        success = await TaskService.reject_task(task_id, current_user.get("uid"), current_user.get("email"))
        if not success:
            raise HTTPException(status_code=400, detail="Görev reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Görev reddedildi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Görev reddedilirken bir hata oluştu.")


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        role = (current_user.get("role") or "user").strip().lower()
        uid = current_user.get("uid")
        email = current_user.get("email")
        identity_keys = [value for value in [uid, email] if value]

        doc_ref = db.collection("tasks").document(task_id)
        doc = await asyncio.to_thread(doc_ref.get)
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Görev bulunamadı.")

        owner_id = (doc.to_dict() or {}).get("owner_id")
        can_delete = role in ["admin", "moderator"] or owner_id in identity_keys
        if not can_delete:
            raise HTTPException(status_code=403, detail="Bu görevi silme yetkiniz yok.")

        await TaskService.delete_task(task_id)
        return {"status": "success", "message": "Görev silindi."}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Görev silinirken bir hata oluştu.")

@router.post("/import")
async def import_tasks(file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    """Excel'den görev içe aktarır."""
    try:
        content = await file.read()
        result = await TaskService.import_tasks_from_excel(content, current_user.get("uid"))
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail="Görevler içe aktarılırken bir hata oluştu.")
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Görevler içe aktarılırken bir hata oluştu.")
