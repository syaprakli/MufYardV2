from fastapi import APIRouter, Query, Depends
from typing import Any, Dict, List
from datetime import datetime
from app.lib.firebase_admin import db
from app.lib.auth import get_current_user

router = APIRouter()

@router.get("/{audit_id}")
def get_audit_trail(audit_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    logs_ref = db.collection("audit_trail").where("audit_id", "==", audit_id)
    logs = []
    for doc in logs_ref.stream():
        data = doc.to_dict()
        logs.append({
            "id": doc.id,
            "audit_id": data.get("audit_id"),
            "user": data.get("user"),
            "action": data.get("action"),
            "timestamp": data.get("timestamp"),
            "details": data.get("diff", "") or data.get("details", "")
        })
    # Python in-memory sorting by timestamp descending
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return logs

# Güncelleme sırasında log kaydı için yardımcı fonksiyon (kendi update endpoint'inizde çağırmalısınız)
def log_audit_change(audit_id: str, user: str, action: str, diff: str = ""):
    db.collection("audit_trail").add({
        "audit_id": audit_id,
        "user": user,
        "action": action,
        "diff": diff,
        "timestamp": datetime.utcnow().isoformat()
    })
