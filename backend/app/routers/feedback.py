from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from app.services.collaboration_service import CollaborationService
from app.lib.firebase_admin import db
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
async def submit_feedback(fb: FeedbackCreate):
    try:
        fb_data = fb.dict()
        fb_data['created_at'] = datetime.utcnow()
        import asyncio
        await asyncio.to_thread(db.collection('feedbacks').add, fb_data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_feedbacks():
    # Only for admins (logic checked in frontend for now, or add dependency here)
    import asyncio
    docs = await asyncio.to_thread(lambda: list(db.collection('feedbacks').order_by('created_at', direction='DESCENDING').stream()))
    feedbacks = []
    for doc in docs:
        d = doc.to_dict()
        d['id'] = doc.id
        feedbacks.append(d)
    return feedbacks

@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str):
    import asyncio
    try:
        await asyncio.to_thread(db.collection('feedbacks').document(feedback_id).delete)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
