import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

def test_firebase():
    cred_path = os.path.join(os.getcwd(), "backend", "firebase-credentials.json")
    print(f"Checking credentials at: {cred_path}")
    
    if not os.path.exists(cred_path):
        print("ERROR: Credentials file not found!")
        return

    try:
        with open(cred_path, "r") as f:
            data = json.load(f)
            print(f"Project ID in JSON: {data.get('project_id')}")
            
        cred = credentials.Certificate(cred_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        # Try to list a collection
        collections = db.collections()
        print("Connected successfully! Collections found:")
        for coll in collections:
            print(f"- {coll.id}")
            
    except Exception as e:
        print(f"FAILED to connect: {e}")

if __name__ == "__main__":
    test_firebase()
