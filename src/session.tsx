import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User } from './types';

type Status = 'loading' | 'unlinked' | 'ready';

interface Session {
  status: Status;
  authReady: boolean;
  error: string | null;
  me: User | null;
  users: Map<string, User>;
  link: (key: string) => Promise<void>;
  unlink: () => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

// Firestore retries forever when the backend is unreachable or misconfigured; fail visibly instead.
function withTimeout<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Could not reach the database. Check your connection and the Firebase setup.')), ms),
    ),
  ]);
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside provider');
  return s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [linkedChecked, setLinkedChecked] = useState(false);
  const [users, setUsers] = useState<Map<string, User> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Silent anonymous sign-in: gives this device a stable uid.
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) setUid(u.uid);
        else signInAnonymously(auth).catch((e) => setError(String(e.message ?? e)));
      }),
    [],
  );

  // Which user (if any) this device is linked to.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'sessions', uid),
      (snap) => {
        setUserId(snap.exists() ? (snap.data().userId as string) : null);
        setLinkedChecked(true);
      },
      (e) => {
        setError(e.message);
        setLinkedChecked(true);
      },
    );
  }, [uid]);

  // All users (small group); fails with permission-denied if the key was revoked.
  useEffect(() => {
    if (!userId) {
      setUsers(null);
      return;
    }
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const m = new Map<string, User>();
        snap.forEach((d) => m.set(d.id, { id: d.id, ...(d.data() as Omit<User, 'id'>) }));
        setUsers(m);
      },
      () => {
        setUsers(null);
        setUserId(null);
        setError('Your access was revoked or your key changed. Ask an admin for a new key.');
      },
    );
  }, [userId]);

  const link = useCallback(
    async (rawKey: string) => {
      const key = rawKey.trim();
      if (!uid || !key) throw new Error('Enter a key');
      const k = await withTimeout(getDoc(doc(db, 'keys', key)));
      if (!k.exists()) throw new Error('Unknown key');
      await withTimeout(setDoc(doc(db, 'sessions', uid), { key, userId: k.data().userId, createdAt: serverTimestamp() }));
      setError(null);
    },
    [uid],
  );

  const unlink = useCallback(async () => {
    if (uid) await deleteDoc(doc(db, 'sessions', uid));
  }, [uid]);

  const me = userId && users ? (users.get(userId) ?? null) : null;
  let status: Status = 'loading';
  if (linkedChecked && !userId) status = 'unlinked';
  else if (users) status = me?.active ? 'ready' : 'unlinked';

  const shownError = error ?? (users && me && !me.active ? 'This account is deactivated.' : null);

  return (
    <Ctx.Provider value={{ status, authReady: uid !== null, error: shownError, me: status === 'ready' ? me : null, users: users ?? new Map(), link, unlink }}>
      {children}
    </Ctx.Provider>
  );
}
