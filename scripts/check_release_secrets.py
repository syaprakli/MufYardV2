"""Sürüm paketinde gizli anahtar olmadığını doğrular; bulursa sıfırdan farklı kodla çıkar.

Kullanım: python scripts/check_release_secrets.py <klasör> [<klasör> ...]
Eski kurulum dosyaları Firebase yönetici anahtarını ve .env'yi pakete koyuyordu; bu denetim
build_release.bat içinde PyInstaller ve electron-builder çıktılarına uygulanır.
"""
import os
import re
import sys

FORBIDDEN_NAMES = re.compile(r"^(\.env(\..*)?|firebase-credentials.*\.json|credentials\.json|service-account.*\.json)$", re.I)
# Yalnızca ardından gerçek anahtar verisi (base64) gelen başlıklar sayılır; kütüphane belgelerindeki
# açıklama metinleri ("-----BEGIN RSA PRIVATE KEY----- ile başlayan ...") alarm vermez.
# JSON içinde satır sonu "\n" olarak (ters bölü + n) yazıldığı için ikisi de kabul edilir.
PRIVATE_KEY = re.compile(rb"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----(?:\\n|\\r|\s)+[A-Za-z0-9+/=]{40,}")
SERVICE_ACCOUNT = re.compile(rb'"type"\s*:\s*"service_account"')
GOOGLE_API_KEY = re.compile(rb"AIza[0-9A-Za-z_-]{35}")
TEXT_EXT = {".json", ".py", ".env", ".txt", ".js", ".cjs", ".mjs", ".yaml", ".yml", ".ini", ".cfg", ".toml", ".pem", ""}
MAX_SCAN = 20 * 1024 * 1024


def scan(root):
    problems = []
    is_backend = "backend" in root.replace("\\", "/").lower()
    for dirpath, _, files in os.walk(root):
        for name in files:
            path = os.path.join(dirpath, name)
            if FORBIDDEN_NAMES.match(name):
                problems.append(f"yasak dosya: {path}")
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in TEXT_EXT or os.path.getsize(path) > MAX_SCAN:
                continue
            try:
                with open(path, "rb") as f:
                    data = f.read()
            except OSError:
                continue
            if PRIVATE_KEY.search(data):
                problems.append(f"özel anahtar: {path}")
            elif SERVICE_ACCOUNT.search(data) and b"private_key" in data:
                problems.append(f"servis hesabı kimliği: {path}")
            # Firebase web API anahtarı (AIza…) frontend paketinde bilerek bulunur; yalnızca backend'de aranır.
            elif is_backend and GOOGLE_API_KEY.search(data):
                problems.append(f"Google API anahtarı: {path}")
    return problems


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    problems = []
    for root in argv[1:]:
        if not os.path.isdir(root):
            print(f"[UYARI] klasör yok: {root}")
            continue
        problems += scan(root)
    if problems:
        print("[X] Sürüm paketinde gizli bilgi bulundu, derleme durduruldu:")
        for p in problems:
            print("   - " + p)
        return 1
    print("[OK] Sürüm paketinde gizli anahtar bulunmadı.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
