// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

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

  // [보안] 데이터베이스 규칙이 "로그인한 사용자만" 허용하도록 잠겨 있습니다.
  // 학생·교사 모두 구글 로그인을 쓰지 않으므로 익명 세션을 미리 만들어 둡니다.
  // (Firebase 콘솔 > Authentication > Sign-in method > 익명(Anonymous) 을 켜야 동작하고,
  //  꺼져 있으면 경고만 남기고 기존과 같이 동작합니다.)
  if (!auth.currentUser) {
    signInAnonymously(auth).catch((error) => {
      console.warn(
        '[Firebase] 익명 로그인을 사용할 수 없습니다. Firebase 콘솔에서 익명(Anonymous) 로그인을 켜 주세요:',
        error && (error.code || error.message)
      );
    });
  }
}

export { app, db, auth };
