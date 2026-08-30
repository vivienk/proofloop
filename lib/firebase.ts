import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

function app() {
  if (!firebaseConfigured) {
    throw new Error(
      "Google sign-in is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* variables in Vercel.",
    );
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function watchProofLoopUser(callback: (user: User | null) => void) {
  if (!firebaseConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(getAuth(app()), callback);
}

export async function signInToProofLoop() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await signInWithPopup(getAuth(app()), provider)).user;
}

export async function signOutOfProofLoop() {
  if (!firebaseConfigured) return;
  await signOut(getAuth(app()));
}

export type { User };
