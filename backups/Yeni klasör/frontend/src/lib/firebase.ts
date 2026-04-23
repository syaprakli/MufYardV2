import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword as firebaseSignIn, createUserWithEmailAndPassword as firebaseSignUp, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = null; // Mobil Bildirimler Devre Dışı

// Electron environment detection
export const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron');

export const requestForToken = async () => null;

export const onMessageListener = () => new Promise(() => {});

// Geliştirici Giriş Fonksiyonu (Hızlı Test İçin)
export const signIn = async (email: string, pass: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. ÖNCELİKLİ BYPASS: Sabit hesap doğrudan geçer
  if (normalizedEmail === "mufettis@gsb.gov.tr" && pass === "123456") {
    console.log("✅ Sabit hesap bypass aktif.");
    return { 
      user: { 
        email: normalizedEmail, 
        uid: "mufettis-gsb-unique-id", 
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
    if (normalizedEmail === "mufettis@gsb.gov.tr" && pass === "123456") {
       return { user: { email: normalizedEmail, uid: "mufettis-gsb-unique-id", displayName: "Sefa Yapraklı" } };
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
