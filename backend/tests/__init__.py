# Backend security test package
#
# Testler her zaman mock Firebase ile ve geçici bir DATA_DIR üzerinde çalışır.
# Bu ayarlar app modülleri import edilmeden önce yapılmalıdır; unittest discover
# paketi test modüllerinden önce yüklediği için burada merkezi olarak yapılır.
# Yereldeki .env / firebase-credentials.json gerçek projeye bağlanmaz.
import os
import tempfile

_TEST_DATA_DIR = tempfile.mkdtemp(prefix="mufyard_tests_")
os.environ["DATA_DIR"] = _TEST_DATA_DIR
os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = ""
os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"] = os.path.join(_TEST_DATA_DIR, "missing-firebase.json")
os.environ["FIREBASE_PRIVATE_KEY"] = ""
os.environ.setdefault("MUFYARD_SIGNING_SECRET", "unit-test-signing-secret-0123456789abcdef")
