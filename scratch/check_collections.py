import os
import firebase_admin
from firebase_admin import credentials, firestore
import json

def diagnostic():
    cert_path = "backend/firebase-credentials.json"
    if not os.path.exists(cert_path):
        print(f"Error: {cert_path} not found.")
        return

    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        collections = ['contacts', 'posts', 'tasks', 'profiles', 'notes', 'legislation']
        results = {}
        
        for coll_name in collections:
            print(f"Checking collection: {coll_name}...")
            try:
                # Use a small limit to avoid consuming too much quota if it's tight
                docs = list(db.collection(coll_name).limit(5).stream())
                results[coll_name] = {
                    "count_sample": len(docs),
                    "status": "OK",
                    "sample_ids": [doc.id for doc in docs]
                }
            except Exception as coll_e:
                results[coll_name] = {
                    "status": "ERROR",
                    "error": str(coll_e)
                }
        
        print("\nDIAGNOSTIC RESULTS:")
        print(json.dumps(results, indent=2))

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    diagnostic()
