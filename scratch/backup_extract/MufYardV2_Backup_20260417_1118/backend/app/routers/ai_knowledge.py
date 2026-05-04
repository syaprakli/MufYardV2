from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from app.schemas.ai_knowledge import AIKnowledgeBase, AIKnowledgeCreate, AIKnowledgeUpdate, AIKnowledgeResponse
from app.lib.firebase_admin import db
from app.lib.auth import get_current_user, require_roles
import asyncio
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[AIKnowledgeResponse])
async def get_ai_knowledge(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Fetches all AI knowledge items (Tenkit Maddeleri) from Firestore."""
    try:
        query = db.collection('ai_knowledge')
        if category:
            query = query.where('category', '==', category)
            
        docs = await asyncio.to_thread(query.stream)
        items = []
        for doc in docs:
            d = doc.to_dict()
            d['id'] = doc.id
            items.append(d)
        
        # Sort in memory: newest first
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return items
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=AIKnowledgeResponse)
async def create_ai_knowledge(
    item: AIKnowledgeCreate,
    current_user: dict = Depends(require_roles("admin", "editor")),
):
    """Creates a new AI knowledge item (Tenkit Maddesi)."""
    try:
        data = item.dict()
        data['created_at'] = datetime.utcnow()
        data['updated_at'] = datetime.utcnow()
        
        doc_ref = await asyncio.to_thread(db.collection('ai_knowledge').add, data)
        new_doc = await asyncio.to_thread(doc_ref[1].get)
        
        res = new_doc.to_dict()
        res['id'] = new_doc.id
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{item_id}", response_model=AIKnowledgeResponse)
async def update_ai_knowledge(
    item_id: str,
    update: AIKnowledgeUpdate,
    current_user: dict = Depends(require_roles("admin", "editor")),
):
    """Updates an existing AI knowledge item."""
    try:
        doc_ref = db.collection('ai_knowledge').document(item_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            raise HTTPException(status_code=404, detail="Bilgi maddesi bulunamadı.")
            
        update_data = {k: v for k, v in update.dict().items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        
        await asyncio.to_thread(doc_ref.update, update_data)
        updated_doc = await asyncio.to_thread(doc_ref.get)
        
        res = updated_doc.to_dict()
        res['id'] = updated_doc.id
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{item_id}")
async def delete_ai_knowledge(
    item_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    """Deletes an AI knowledge item."""
    try:
        doc_ref = db.collection('ai_knowledge').document(item_id)
        exists = await asyncio.to_thread(lambda: doc_ref.get().exists)
        if not exists:
            raise HTTPException(status_code=404, detail="Bilgi maddesi bulunamadı.")
            
        await asyncio.to_thread(doc_ref.delete)
        return {"status": "success", "message": "Tenkit maddesi silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
