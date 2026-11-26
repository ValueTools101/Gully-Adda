/**
 * Firebase client: anonymous auth + callable Cloud Functions + Firestore reads.
 * The client never writes game state; it only calls functions and reads
 * the room doc, its own view doc, and chat messages addressed to it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence, connectAuthEmulator, getAuth, initializeAuth, onAuthStateChanged, signInAnonymously,
  type Auth, type Persistence, type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { Platform } from 'react-native';

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-south1';
const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === 'true';
const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const onlineConfigured = !!(cfg.apiKey && cfg.projectId && cfg.appId) || USE_EMULATORS;

interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  fns: Functions;
}
let fb: Fb | null = null;

export function firebase(): Fb {
  if (fb) return fb;
  if (!onlineConfigured) throw new Error('online_not_configured');
  const app = getApps().length ? getApp() : initializeApp(USE_EMULATORS && !cfg.projectId ? { ...cfg, projectId: 'demo-gully-adda', apiKey: 'demo' } : cfg);
  let auth: Auth;
  try {
    if (Platform.OS === 'web') auth = initializeAuth(app, { persistence: browserLocalPersistence });
    else {
      // Exported by firebase/auth's React Native build.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getReactNativePersistence } = require('firebase/auth') as { getReactNativePersistence: (s: unknown) => Persistence };
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    }
  } catch {
    auth = getAuth(app);
  }
  const db = getFirestore(app);
  const fns = getFunctions(app, REGION);
  if (USE_EMULATORS) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectFunctionsEmulator(fns, EMULATOR_HOST, 5001);
  }
  fb = { app, auth, db, fns };
  return fb;
}

/** Anonymous sign-in (no email or password in v1). Reuses the persisted user. */
export async function ensureSignedIn(): Promise<User> {
  const { auth } = firebase();
  if (auth.currentUser) return auth.currentUser;
  const existing = await new Promise<User | null>((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
  if (existing) return existing;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function call<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
  await ensureSignedIn();
  const fn = httpsCallable<TReq, TRes>(firebase().fns, name);
  const res = await fn(data);
  return res.data;
}

/** Deletes the anonymous account and everything tied to it on the server. */
export async function deleteMyOnlineData(): Promise<void> {
  if (!onlineConfigured) return;
  const { auth } = firebase();
  if (!auth.currentUser) {
    const u = await new Promise<User | null>((resolve) => {
      const off = onAuthStateChanged(auth, (x) => {
        off();
        resolve(x);
      });
    });
    if (!u) return; // never signed in: nothing stored
  }
  await call('deleteMyData', {});
  await auth.signOut().catch(() => {});
  await AsyncStorage.removeItem('gully-adda/online/seq').catch(() => {});
}
