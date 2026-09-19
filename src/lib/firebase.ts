// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
};

// 유효한 Firebase 설정이 있는지 확인
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.databaseURL && 
  firebaseConfig.projectId
);

let app = null;
let db: Database | null = null;
let auth: Auth | null = null;

if (typeof window !== 'undefined' && isFirebaseConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
  auth = getAuth(app);
}

export { app, db, auth };
