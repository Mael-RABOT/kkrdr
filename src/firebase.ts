import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore';

const env = import.meta.env;
const emulators = env.VITE_USE_EMULATORS === 'true';

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  // The emulators and seed script always use the demo project.
  projectId: emulators ? 'demo-kkrdr' : env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
// Local cache: data stays readable offline and writes are queued until the connection is back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (emulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/** Local copies kept in localStorage for an instant start (see session.tsx, feed.tsx, avatars.tsx). */
export const LOCAL_CACHES = ['session-cache', 'feed-cache', 'avatars-cache'];

/**
 * Last resort when the app is stuck loading (e.g. the local database is blocked after an update):
 * wipes the Firestore cache, the app's local copies and the service worker, then reloads.
 * Preferences (theme, language) are kept. Entries not yet synced are lost.
 */
export async function resetLocalData() {
  try {
    for (const k of LOCAL_CACHES) {
      try {
        localStorage.removeItem(k);
      } catch {
        // storage unavailable
      }
    }
    await terminate(db);
    await clearIndexedDbPersistence(db);
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {
    // reload anyway
  } finally {
    location.reload();
  }
}
