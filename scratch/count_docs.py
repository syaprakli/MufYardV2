import os
import firebase_admin
from firebase_admin import credentials, firestore

def count_docs():
    cert_path = "backend/firebase-credentials.json"
    if not firebase_admin._apps:
        cred = credentials.Certificate(cert_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    collections = ['contacts', 'posts', 'tasks', 'legislation']
    for coll in collections:
        docs = db.collection(coll).stream()
        count = sum(1 for _ in docs)
        print(f"Collection {coll}: {count} documents")

if __name__ == "__main__":
    count_docs()
