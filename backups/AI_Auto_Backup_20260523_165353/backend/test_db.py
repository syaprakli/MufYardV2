import os
import firebase_admin
from firebase_admin import credentials, firestore
import time

def test_firestore():
    cert_path = "firebase-credentials.json"
    if not os.path.exists(cert_path):
        print(f"Error: {cert_path} not found.")
        return

    print(f"Connecting to Firestore using {cert_path}...")
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        start = time.time()
        print("Fetching 'posts' collection...")
        # Try a quick stream with a limit
        docs = db.collection('posts').limit(1).stream()
        for doc in docs:
            print(f"Success! Found document with ID: {doc.id}")
            break
        else:
            print("Success! Collection is empty.")
        
        print(f"Query took {time.time() - start:.2f} seconds.")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_firestore()
