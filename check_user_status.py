import sys
import os
# Backend klasörünü path'e ekle
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Firebase'e bağlan
try:
    from app.firebase_config import db
except ImportError:
    from backend.app.firebase_config import db

docs = db.collection('profiles').where('email', '==', 'yapraklisefa@gmail.com').get()
if not docs:
    print("Kullanıcı bulunamadı.")
else:
    for d in docs:
        data = d.to_dict()
        print(f"UID: {d.id}")
        print(f"Email: {data.get('email')}")
        print(f"Pro (has_premium_ai): {data.get('has_premium_ai')}")
        print(f"Trial Started: {data.get('trial_started')}")
        print(f"Role: {data.get('role')}")
