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

        task_data = doc.to_dict() or {}
        owner_id = task_data.get("owner_id")
        is_owner_or_admin = role in ["admin", "moderator"] or owner_id in identity_keys

        if is_owner_or_admin:
            await TaskService.delete_task(task_id)
            return {"status": "success", "message": "Görev silindi."}
        else:
            assigned_to = task_data.get("assigned_to", [])
            shared_with = task_data.get("shared_with", [])
            pending_collaborators = task_data.get("pending_collaborators", [])
            accepted_collaborators = task_data.get("accepted_collaborators", [])

            is_collaborator = (
                any(id in assigned_to for id in identity_keys) or
                any(id in shared_with for id in identity_keys) or
                any(id in pending_collaborators for id in identity_keys) or
                any(id in accepted_collaborators for id in identity_keys)
            )

            if is_collaborator:
                new_assigned = [id for id in assigned_to if id not in identity_keys]
                new_shared = [id for id in shared_with if id not in identity_keys]
                new_pending = [id for id in pending_collaborators if id not in identity_keys]
                new_accepted = [id for id in accepted_collaborators if id not in identity_keys]

                await asyncio.to_thread(doc_ref.update, {
                    "assigned_to": new_assigned,
                    "shared_with": new_shared,
                    "pending_collaborators": new_pending,
                    "accepted_collaborators": new_accepted
                })

                # Also remove from associated audits
                try:
                    audits_ref = db.collection('audits').where('task_id', '==', task_id)
                    audits_docs = await asyncio.to_thread(audits_ref.get)
                    for doc_aud in audits_docs:
                        audit_data = doc_aud.to_dict() or {}
                        aud_assigned = audit_data.get("assigned_to", [])
                        aud_shared = audit_data.get("shared_with", [])
                        aud_pending = audit_data.get("pending_collaborators", [])
                        aud_accepted = audit_data.get("accepted_collaborators", [])

                        aud_doc_ref = db.collection('audits').document(doc_aud.id)
                        await asyncio.to_thread(aud_doc_ref.update, {
                            "assigned_to": [id for id in aud_assigned if id not in identity_keys],
                            "shared_with": [id for id in aud_shared if id not in identity_keys],
                            "pending_collaborators": [id for id in aud_pending if id not in identity_keys],
                            "accepted_collaborators": [id for id in aud_accepted if id not in identity_keys]
                        })
                except Exception as ae:
                    print(f"Failed to remove collaborator from associated audits: {ae}")

                return {"status": "success", "message": "Görev paylaşımlarınızdan kaldırıldı."}
            else:
                raise HTTPException(status_code=403, detail="Bu görevi silme veya terk etme yetkiniz yok.")
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
