import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword as firebaseSignIn, createUserWithEmailAndPassword as firebaseSignUp, GoogleAuthProvider, signInWithPopup, updateProfile, sendEmailVerification } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
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

// Singleton initialization to prevent HMR errors
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let _db;
try {
  _db = getFirestore(app);
} catch (e) {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}
export const db = _db;

export const storage = getStorage(app);
export const messaging = null; 

// Electron environment detection
// contextIsolation: true ile window.process erişilemez.
// preload.cjs üzerinden window.electronAPI.isElectron kontrolü yapılır.
export const isElectron = (() => {
  if (typeof window === 'undefined') return false;

  // Preload script tarafından sağlanan güvenli API
  if ((window as any).electronAPI?.isElectron) return true;

  // Fallback: User-Agent kontrolü
  return window.navigator.userAgent.includes('Electron');
})();

export const requestForToken = async () => null;

export const onMessageListener = () => new Promise(() => {});

export const signIn = async (email: string, pass: string) => {
  if (isDummy) {
    throw new Error("Firebase yapılandırması eksik. Kimlik doğrulama devre dışı bırakıldı.");
  }
  return firebaseSignIn(auth, email, pass);
};

export const signUp = async (email: string, pass: string, name: string) => {
  if (isDummy) {
    throw new Error("Firebase yapılandırması eksik. Kayıt işlemi devre dışı bırakıldı.");
  }

  const result = await firebaseSignUp(auth, email, pass);
  if (result.user) {
    await updateProfile(result.user, { displayName: name });
    // Kayıt sonrası doğrulama maili gönder
    await sendEmailVerification(result.user);
  }
  return result;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};
export default app;
