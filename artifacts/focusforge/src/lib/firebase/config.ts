import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: any = null;
if (firebaseConfig.apiKey) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export const auth = app ? getAuth(app) : {} as any;
export const db = app ? getFirestore(app) : {} as any;
export const googleProvider = app ? new GoogleAuthProvider() : {} as any;
