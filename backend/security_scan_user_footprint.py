import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set


CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)


try:
    from firebase_admin import auth
except Exception:  # pragma: no cover
    auth = None

from app.lib.firebase_admin import db, is_mock


DEFAULT_COLLECTIONS = [
    "users",
    "profiles",
    "roles",
    "licenses",
    "inspectors",
    "audit",
    "calendar",
    "notes",
    "feedback",
    "tasks",
    "settings",
    "messages",
    "files",
    "contacts",
    "notifications",
]

UID_FIELDS = [
    "uid",
    "user_id",
    "owner_id",
    "created_by",
    "author_id",
    "assigned_to",
    "used_by",
    "sender_id",
    "receiver_id",
]

EMAIL_FIELDS = [
    "email",
    "user_email",
    "owner_email",
    "author_email",
    "created_by_email",
    "used_by_email",
    "sender_email",
    "receiver_email",
]

ARRAY_FIELDS = [
    "emails",
    "members",
    "participants",
    "participant_ids",
]


def json_safe(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, list):
        return [json_safe(v) for v in value[:20]]
    if isinstance(value, dict):
        clean: Dict[str, Any] = {}
        for idx, (k, v) in enumerate(value.items()):
            if idx >= 20:
                break
            clean[str(k)] = json_safe(v)
        return clean
    return str(value)


def safe_preview(data: Dict[str, Any], max_keys: int = 12) -> Dict[str, Any]:
    keys = list(data.keys())[:max_keys]
    preview: Dict[str, Any] = {}
    for key in keys:
        value = data.get(key)
        preview[key] = json_safe(value)
    return preview


def normalize_email(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def scan_auth(email: Optional[str], uid: Optional[str]) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "checked": True,
        "by_uid": None,
        "by_email": None,
        "errors": [],
    }

    if auth is None:
        result["checked"] = False
        result["errors"].append("firebase_admin.auth import edilemedi")
        return result

    if uid:
        try:
            user = auth.get_user(uid)
            result["by_uid"] = {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "disabled": user.disabled,
            }
        except Exception as exc:
            result["errors"].append(f"UID sorgusu hatasi: {exc}")

    if email:
        try:
            user = auth.get_user_by_email(email)
            result["by_email"] = {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "disabled": user.disabled,
            }
        except Exception as exc:
            result["errors"].append(f"E-posta sorgusu hatasi: {exc}")

    return result


def check_array_match(value: Any, uid: Optional[str], email: Optional[str]) -> bool:
    if not isinstance(value, list):
        return False
    normalized: Set[str] = set()
    for item in value:
        normalized.add(str(item).strip().lower())
    if uid and uid.strip().lower() in normalized:
        return True
    if email and email.strip().lower() in normalized:
        return True
    return False


def scan_collection(collection_name: str, uid: Optional[str], email: Optional[str]) -> Dict[str, Any]:
    report: Dict[str, Any] = {
        "collection": collection_name,
        "matches": [],
        "errors": [],
    }

    coll = db.collection(collection_name)

    # 1) Dokuman ID eslesmesi (uid)
    if uid:
        try:
            doc = coll.document(uid).get()
            if doc.exists:
                payload = doc.to_dict() or {}
                report["matches"].append(
                    {
                        "doc_id": doc.id,
                        "matched_on": ["document_id"],
                        "preview": safe_preview(payload),
                    }
                )
        except Exception as exc:
            report["errors"].append(f"document_id kontrol hatasi: {exc}")

    # 2) Esitlik sorgulari
    queries: List[Dict[str, str]] = []
    if uid:
        for field in UID_FIELDS:
            queries.append({"field": field, "value": uid, "type": "uid_field"})
    if email:
        for field in EMAIL_FIELDS:
            queries.append({"field": field, "value": email, "type": "email_field"})

    seen: Set[str] = {m["doc_id"] for m in report["matches"]}

    for query in queries:
        try:
            docs = coll.where(query["field"], "==", query["value"]).stream()
            for doc in docs:
                payload = doc.to_dict() or {}
                if doc.id in seen:
                    for item in report["matches"]:
                        if item["doc_id"] == doc.id:
                            item["matched_on"].append(query["field"])
                            break
                    continue
                report["matches"].append(
                    {
                        "doc_id": doc.id,
                        "matched_on": [query["field"]],
                        "preview": safe_preview(payload),
                    }
                )
                seen.add(doc.id)
        except Exception as exc:
            report["errors"].append(f"{query['field']} sorgu hatasi: {exc}")

    # 3) Dizi alanlari icin sinirli tarama (sadece hala eslesme yoksa)
    if not report["matches"] and (uid or email):
        try:
            docs = coll.limit(1000).stream()
            for doc in docs:
                payload = doc.to_dict() or {}
                matched_fields: List[str] = []
                for field in ARRAY_FIELDS:
                    if check_array_match(payload.get(field), uid, email):
                        matched_fields.append(field)
                if matched_fields:
                    report["matches"].append(
                        {
                            "doc_id": doc.id,
                            "matched_on": matched_fields,
                            "preview": safe_preview(payload),
                        }
                    )
        except Exception as exc:
            report["errors"].append(f"array tarama hatasi(limit=1000): {exc}")

    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Firestore/Auth olay inceleme taramasi (yalnizca read-only)."
    )
    parser.add_argument("--email", type=str, default="", help="Taranacak e-posta")
    parser.add_argument("--uid", type=str, default="", help="Taranacak UID")
    parser.add_argument(
        "--collections",
        type=str,
        default=",".join(DEFAULT_COLLECTIONS),
        help="Virgulle ayrilmis koleksiyon listesi",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="",
        help="JSON cikti dosyasi (varsayilan: backend/security_reports/...)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    email = normalize_email(args.email)
    uid = args.uid.strip()

    if not email and not uid:
        print("HATA: En az bir parametre verin: --email veya --uid")
        return 2

    if is_mock:
        print("HATA: Firebase mock modda. Gercek servis hesabi ile calistirin.")
        return 3

    collections = [c.strip() for c in args.collections.split(",") if c.strip()]
    started_at = datetime.now(timezone.utc).isoformat()

    print("== INCIDENT RESPONSE TARAMA BASLADI ==")
    if uid:
        print(f"UID    : {uid}")
    if email:
        print(f"E-POSTA: {email}")
    print(f"Koleksiyon sayisi: {len(collections)}")

    auth_report = scan_auth(email=email or None, uid=uid or None)

    collection_reports: List[Dict[str, Any]] = []
    total_matches = 0
    for collection_name in collections:
        report = scan_collection(collection_name, uid=uid or None, email=email or None)
        collection_reports.append(report)
        total_matches += len(report["matches"])
        print(f"- {collection_name}: {len(report['matches'])} eslesme")

    final_report = {
        "started_at": started_at,
        "query": {"uid": uid or None, "email": email or None},
        "auth": auth_report,
        "total_matches": total_matches,
        "collections": collection_reports,
    }

    if args.out:
        out_path = args.out
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_dir = os.path.join(CURRENT_DIR, "security_reports")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"footprint_{stamp}.json")

    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(final_report, handle, ensure_ascii=False, indent=2)

    print("== TARAMA TAMAMLANDI ==")
    print(f"Toplam eslesme: {total_matches}")
    print(f"Rapor dosyasi: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())