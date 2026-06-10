import sys
import os

# Backend klasörünü path'e ekle
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Firebase Admin'i başlatan modülü çağır
try:
    from app.lib.firebase_admin import db
    import firebase_admin
    from firebase_admin import auth
except ImportError:
    print("[ERROR] Firebase Admin başlatılamadı. Lütfen backend klasörünün olduğu dizinde bu komutu çalıştırın.")
    sys.exit(1)

def verify_user(email):
    email = email.strip()
    try:
        user = auth.get_user_by_email(email)
        auth.update_user(user.uid, email_verified=True)
        print(f"\n[SUCCESS] {email} kullanıcısının e-posta doğrulaması (email_verified) MANUEL olarak AKTİF edildi! 🚀")
        print(f"Kullanıcı UID: {user.uid}")
    except auth.UserNotFoundError:
        print(f"\n[ERROR] '{email}' adresine sahip bir kullanıcı Firebase Authentication üzerinde bulunamadı.")
        print("Kullanıcının önce uygulamadan kayıt (register) olduğundan emin olun.")
    except Exception as e:
        print(f"\n[ERROR] Bir hata oluştu: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kullanım: python verify_gsb_user.py <eposta_adresi>")
        print("Örnek: python verify_gsb_user.py sefa.yaprakli@gsb.gov.tr")
    else:
        verify_user(sys.argv[1])
