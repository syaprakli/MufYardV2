from fastapi import APIRouter, Query
from firebase_admin import firestore
from typing import List
from datetime import datetime

router = APIRouter()

db = firestore.client()

@router.get("/{audit_id}")
def get_audit_trail(audit_id: str):
    logs_ref = db.collection("audit_trail").where("audit_id", "==", audit_id).order_by("timestamp", direction=firestore.Query.DESCENDING)
    logs = []
    for doc in logs_ref.stream():
        data = doc.to_dict()
        logs.append({
            "user": data.get("user"),
            "action": data.get("action"),
            "timestamp": data.get("timestamp"),
            "diff": data.get("diff", "")
        })
    return {"logs": logs}

# Güncelleme sırasında log kaydı için yardımcı fonksiyon (kendi update endpoint'inizde çağırmalısınız)
def log_audit_change(audit_id: str, user: str, action: str, diff: str = ""):
    db.collection("audit_trail").add({
        "audit_id": audit_id,
        "user": user,
        "action": action,
        "diff": diff,
        "timestamp": datetime.utcnow().isoformat()
    })
