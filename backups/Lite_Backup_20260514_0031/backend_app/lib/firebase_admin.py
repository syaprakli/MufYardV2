import firebase_admin
from firebase_admin import credentials, firestore, storage, messaging
import os
import uuid
import logging
import json
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_db = None
_bucket = None
_messaging = None
is_mock = True

try:
    cred = None
    _cred_dict: dict = {}
    
    # 1. Try from Environment Variable (JSON String) - Best for Railway/Cloud
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            cred_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            _cred_dict = cred_dict
            cred = credentials.Certificate(cred_dict)
            logger.info("Firebase: Using credentials from Environment Variable.")
        except Exception as json_err:
            logger.error(f"Firebase: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {json_err}")

    # 2. Try from Local Secrets File (Internal)
    if not cred:
        try:
            from app.lib.firebase_secrets import FIREBASE_CONFIG
            if FIREBASE_CONFIG:
                # Normalize private key line endings (CRLF → LF for Linux/Docker)
                config_copy = dict(FIREBASE_CONFIG)
                if config_copy.get('private_key'):
                    config_copy['private_key'] = config_copy['private_key'].replace('\r\n', '\n').replace('\r', '\n')
                cred = credentials.Certificate(config_copy)
                logger.info("Firebase: Using credentials from app.lib.firebase_secrets.")
        except (ImportError, Exception) as secrets_err:
            logger.error(f"Firebase: firebase_secrets loading failed: {secrets_err}")
            pass

    # 3. Try from Local File Path
    if not cred and os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        logger.info(f"Firebase: Using credentials from file: {settings.FIREBASE_SERVICE_ACCOUNT_PATH}")

    if cred:
        if not firebase_admin._apps:
            init_kwargs = {}
            if settings.FIREBASE_STORAGE_BUCKET:
                init_kwargs["storageBucket"] = settings.FIREBASE_STORAGE_BUCKET
            elif _cred_dict.get('project_id'):
                # Auto-derive bucket name from service account project_id
                auto_bucket = f"{_cred_dict['project_id']}.appspot.com"
                init_kwargs["storageBucket"] = auto_bucket
                logger.info(f"Firebase: Auto-derived storageBucket = {auto_bucket}")
            firebase_admin.initialize_app(cred, init_kwargs)
            
            try:
                _db = firestore.client()
                _messaging = messaging
                is_mock = False
                logger.info("Firebase initialized successfully.")
            except Exception as db_err:
                logger.error(f"Firebase Client Error (Quota?): {db_err}")
                is_mock = True

            if not is_mock:
                try:
                    app = firebase_admin.get_app()
                    bucket_name = settings.FIREBASE_STORAGE_BUCKET or app.options.get("storageBucket")
                    if not bucket_name:
                        project_id = getattr(app, "project_id", None)
                        if project_id:
                            bucket_name = f"{project_id}.appspot.com"

                    _bucket = storage.bucket(bucket_name) if bucket_name else storage.bucket()
                    logger.info(f"Firebase Storage initialized with bucket: {bucket_name or 'default'}")
                except Exception as bucket_err:
                    logger.warning(f"Storage bucket could not be initialized: {bucket_err}")
    else:
        logger.warning("Firebase certificate not found. Using Demo Mock DB.")
        is_mock = True
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}. Falling back to Mock DB.")
    is_mock = True

# --- MOCK DB Fallback (Geri Dönüş) Kodları ---
_MOCK_DATA = {}

class MockDocument:
    def __init__(self, doc_id, data=None):
        self._id = doc_id
        self.exists = data is not None
        self._data = data or {}
        
    def to_dict(self):
        return self._data
        
    @property
    def id(self):
        return self._id

class MockQuery:
    def __init__(self, data_list=None):
        self._data = data_list or []
        
    def stream(self):
        return [MockDocument(d.get('id', 'mock'), d) for d in self._data]
        
    def get(self):
        return [MockDocument(d.get('id', 'mock'), d) for d in self._data]

class MockDocRef:
    def __init__(self, collection_name, doc_id):
        self.collection_name = collection_name
        self.doc_id = doc_id

    def get(self):
        data = _MOCK_DATA.get(self.collection_name, {}).get(self.doc_id)
        return MockDocument(self.doc_id, data)

    def set(self, data, merge=False):
        if self.collection_name not in _MOCK_DATA:
            _MOCK_DATA[self.collection_name] = {}
        if merge:
            existing = _MOCK_DATA[self.collection_name].get(self.doc_id, {})
            existing.update(data)
            _MOCK_DATA[self.collection_name][self.doc_id] = existing
        else:
            _MOCK_DATA[self.collection_name][self.doc_id] = data

    def delete(self):
        if self.collection_name in _MOCK_DATA and self.doc_id in _MOCK_DATA[self.collection_name]:
            del _MOCK_DATA[self.collection_name][self.doc_id]

    def update(self, data):
        self.set(data, merge=True)

    def collection(self, sub_collection):
        return MockCollection(f"{self.collection_name}/{self.doc_id}/{sub_collection}")

class MockCollection:
    def __init__(self, name):
        self.name = name

    def document(self, doc_id=None):
        return MockDocRef(self.name, doc_id or str(uuid.uuid4()))

    def order_by(self, field, direction="ASCENDING"):
        return self

    def limit(self, count):
        return self

    def stream(self):
        docs = _MOCK_DATA.get(self.name, {}).values()
        return [MockDocument(d.get('id', 'mock'), d) for d in docs]

    def get(self):
        return self.stream()

    def where(self, field, op, val):
        docs = _MOCK_DATA.get(self.name, {}).values()
        filtered = []
        for d in docs:
            d_val = d.get(field)
            if op == "==" and d_val == val: filtered.append(d)
        return MockQuery(filtered or [])

# Eğer gerçek DB yoksa Mock DB döndür
if is_mock:
    class MockFirestore:
        def collection(self, name):
            return MockCollection(name)
    
    class MockBucket:
        def blob(self, name):
            class MockBlob:
                def upload_from_file(self, *args, **kwargs): pass
                def upload_from_string(self, *args, **kwargs): pass
                def make_public(self): pass
                @property
                def public_url(self): return f"https://mock-storage.google.com/{name}"
            return MockBlob()
            
    class MockMessaging:
        def send(self, message):
            logger.info(f"MOCK FCM: Notification sent to {message.token}")
            return "mock-message-id"
            
    db = MockFirestore()
    bucket = MockBucket()
    messenger = MockMessaging()
else:
    db = _db
    bucket = _bucket
    messenger = _messaging
