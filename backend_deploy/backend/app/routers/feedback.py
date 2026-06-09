from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.services.collaboration_service import CollaborationService
from app.lib.firebase_admin import db
from app.lib.auth import get_current_user, require_roles
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="", tags=["feedback"])

class FeedbackCreate(BaseModel):
    rating: int
    comment: str
    user_id: str
    user_name: str
    user_email: str

@router.post("/")
async def submit_feedback(fb: FeedbackCreate, current_user: Dict[str, Any] = Depends(get_current_user)):
    try:
        feedback_text = (fb.comment or "").strip()
        if not feedback_text:
            raise HTTPException(status_code=400, detail="Yorum boş olamaz.")

        fb_data = {
            "rating": fb.rating,
            "comment": feedback_text,
            "user_id": current_user.get("uid") or "",
            "user_email": current_user.get("email") or "",
            "user_name": (current_user.get("email") or "kullanici").split("@")[0],
        }
        fb_data['created_at'] = datetime.utcnow()
        import asyncio
        await asyncio.to_thread(db.collection('feedbacks').add, fb_data)
        return {"status": "success"}
    except Exception:
        raise HTTPException(status_code=500, detail="Geri bildirim gönderilirken bir hata oluştu.")

@router.get("/")
async def get_feedbacks(current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator"))):
    import asyncio
    docs = await asyncio.to_thread(lambda: list(db.collection('feedbacks').order_by('created_at', direction='DESCENDING').limit(100).stream()))
    feedbacks = []
    for doc in docs:
        d = doc.to_dict()
        d['id'] = doc.id
        feedbacks.append(d)
    return feedbacks

@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str, current_user: Dict[str, Any] = Depends(require_roles("admin", "moderator"))):
    import asyncio
    try:
        await asyncio.to_thread(db.collection('feedbacks').document(feedback_id).delete)
        return {"status": "deleted"}
    except Exception:
        raise HTTPException(status_code=500, detail="Geri bildirim silinirken bir hata oluştu.")
