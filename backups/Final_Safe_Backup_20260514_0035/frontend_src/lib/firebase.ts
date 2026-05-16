import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword as firebaseSignIn, createUserWithEmailAndPassword as firebaseSignUp, GoogleAuthProvider, signInWithPopup, updateProfile, sendEmailVerification } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const isDummy = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === "AIzaSy_FAKE_KEY_PLEASE_CHANGE";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  app = { options: {} } as any;
}

export const auth = getAuth(app);

// Offline Persistence with new API (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);
export const messaging = null; // Mobil Bildirimler Devre Dışı

// Electron environment detection
// User-Agent bazli kontrol bazi makinelerde false donebiliyor.
// Bu nedenle process.versions.electron ve renderer tipi ile birlikte kontrol ediyoruz.
export const isElectron = (() => {
  if (typeof window === 'undefined') return false;

  const maybeProcess = (window as any).process;
  const hasElectronProcess = !!maybeProcess?.versions?.electron;
  const isRendererProcess = maybeProcess?.type === 'renderer';
  const hasElectronUA = window.navigator.userAgent.includes('Electron');

  return hasElectronProcess || isRendererProcess || hasElectronUA;
})();

export const requestForToken = async () => null;

export const onMessageListener = () => new Promise(() => {});

// Geliştirici Giriş Fonksiyonu (Hızlı Test İçin)
export const signIn = async (email: string, pass: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. ÖNCELİKLİ BYPASS: Sabit hesap doğrudan geçer
  if (normalizedEmail === "sefa.yaprakli@gsb.gov.tr" && pass === "123456") {
    console.log("✅ Sabit hesap bypass aktif.");
    return { 
      user: { 
        email: normalizedEmail, 
        uid: "sefa-yaprakli-gsb-unique-id", 
        displayName: "Sefa Yapraklı",
        photoURL: null
      } 
    };
  }

  // 2. NORMAL FLOW + FAIL-SAFE
  try {
    if (isDummy) {
      return { user: { email, uid: "demo-user-123" } };
    }
    return await firebaseSignIn(auth, email, pass);
  } catch (error) {
    // Firebase hata verse bile eğer bu bizim özel hesabımızsa içeri al
    if (normalizedEmail === "sefa.yaprakli@gsb.gov.tr" && pass === "123456") {
       return { user: { email: normalizedEmail, uid: "sefa-yaprakli-gsb-unique-id", displayName: "Sefa Yapraklı" } };
    }
    throw error;
  }
};

export const signUp = async (email: string, pass: string, name: string) => {
  try {
    if (isDummy) {
      return { user: { email, uid: "demo-user-" + Date.now(), displayName: name } };
    }
    const result = await firebaseSignUp(auth, email, pass);
    if (result.user) {
      await updateProfile(result.user, { displayName: name });
      // Kayıt sonrası doğrulama maili gönder
      await sendEmailVerification(result.user);
    }
    return result;
  } catch (error) {
    throw error;
  }
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};
export default app;
