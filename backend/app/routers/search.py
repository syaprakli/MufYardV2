from fastapi import APIRouter, Query, Depends
from typing import List
from typing import Dict, Any
from app.lib.auth import get_current_user
from app.lib.firebase_admin import db

router = APIRouter()


@router.get("/search-reports")
def search_reports(
    q: str = Query(..., min_length=2),
    limit: int = 20,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    # Firestore'da tam metin arama (basit LIKE benzeri)
    audits_ref = db.collection("audits")
    results = []
    for doc in audits_ref.stream():
        data = doc.to_dict()
        if q.lower() in (data.get("report_content", "").lower() + " " + data.get("title", "").lower()):
            results.append({
                "id": doc.id,
                "title": data.get("title", ""),
                "snippet": data.get("report_content", "")[:200]
            })
            if len(results) >= limit:
                break
    return {"results": results}
