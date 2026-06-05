import os
import firebase_admin
from firebase_admin import credentials, firestore

def check_tasks():
    cert_path = "backend/firebase-credentials.json"
    if not firebase_admin._apps:
        cred = credentials.Certificate(cert_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    docs = db.collection('tasks').stream()
    print("ALL TASKS IN FIRESTORE:")
    for doc in docs:
        d = doc.to_dict()
        print(f"ID: {doc.id}")
        for k, v in d.items():
            print(f"  {k}: {v}")
        print("-" * 40)

if __name__ == "__main__":
    check_tasks()
