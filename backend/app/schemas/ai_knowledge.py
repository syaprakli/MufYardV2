from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AIKnowledgeBase(BaseModel):
    category: str = Field(..., example="Yurt İşlemleri")
    topic: str = Field(..., example="Asansör Denetimi")
    description: str = Field(..., example="Asansörlerin yeşil etiket almamış olması.")
    standard_remark: str = Field(..., example="...asansörlerin periyodik kontrol neticesinde uygunluk ifade eden Yeşil etiket almadığı görülmüş olup...")
    tags: List[str] = []

class AIKnowledgeCreate(AIKnowledgeBase):
    pass

class AIKnowledgeUpdate(BaseModel):
    category: Optional[str] = None
    topic: Optional[str] = None
    description: Optional[str] = None
    standard_remark: Optional[str] = None
    tags: Optional[List[str]] = None

class AIKnowledgeResponse(AIKnowledgeBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
