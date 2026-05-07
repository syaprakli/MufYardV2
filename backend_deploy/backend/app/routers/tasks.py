from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.services.task_service import TaskService
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter(tags=["tasks"])


@router.get("/", response_model=List[TaskResponse])
async def get_tasks(user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        return await TaskService.get_tasks(user_id, user_email)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=TaskResponse)
async def create_task(task: TaskCreate):
    try:
        return await TaskService.create_task(task)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate):
    try:
        updated = await TaskService.update_task(task_id, task_update)
        if not updated:
            raise HTTPException(status_code=404, detail="Görev bulunamadı.")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/accept")
async def accept_task(task_id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await TaskService.accept_task(task_id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Görev kabul edilemedi veya bulunamadı.")
        return {"status": "success", "message": "Görev kabul edildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/reject")
async def reject_task(task_id: str, user_id: Optional[str] = None, user_email: Optional[str] = None):
    try:
        success = await TaskService.reject_task(task_id, user_id, user_email)
        if not success:
            raise HTTPException(status_code=400, detail="Görev reddedilemedi veya bulunamadı.")
        return {"status": "success", "message": "Görev reddedildi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    try:
        await TaskService.delete_task(task_id)
        return {"status": "success", "message": "Görev silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
