import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { readLocal, writeLocal } from './localCache';
import type { User } from './types';

type Status = 'loading' | 'unlinked' | 'ready';

interface Session {
  status: Status;
  authReady: boolean;
  /** Still loading after a while: the boot screen offers retry / reset. */
  slow: boolean;
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
      setTimeout(() => reject(new Error('welcome.unreachable')), ms),
    ),
  ]);
}

// ---- last known session, so the app opens instantly (and offline) without waiting for Firestore ----

const CACHE = 'session-cache';

interface CachedSession {
  uid: string;
  userId: string;
  users: User[];
}

function readCache(): CachedSession | null {
  const c = readLocal<CachedSession>(CACHE);
  return c?.uid && c.userId && Array.isArray(c.users) ? c : null;
}

const writeCache = (c: CachedSession | null) => writeLocal(CACHE, c);

const toMap = (list: User[]) => new Map(list.map((u) => [u.id, u]));

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside provider');
  return s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [cached] = useState(readCache);
  const [uid, setUid] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(cached?.userId ?? null);
  const [linkedChecked, setLinkedChecked] = useState(false);
  const [users, setUsers] = useState<Map<string, User> | null>(cached ? toMap(cached.users) : null);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [slow, setSlow] = useState(false);

  // Silent anonymous sign-in: gives this device a stable uid (kept offline once created).
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) {
          setAuthFailed(false);
          setUid(u.uid);
        } else
          signInAnonymously(auth).catch((e) => {
            setAuthFailed(true);
            setError(navigator.onLine ? String(e.message ?? e) : 'welcome.offlineFirstTime');
          });
      }),
    [],
  );

  // The cached session belongs to another device identity: drop it.
  useEffect(() => {
    if (uid && cached && cached.uid !== uid) {
      writeCache(null);
      setUserId(null);
      setUsers(null);
    }
  }, [uid, cached]);

  // Which user (if any) this device is linked to. A missing doc only counts once the server says so.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'sessions', uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) setUserId(snap.data().userId as string);
        else if (!snap.metadata.fromCache || !readCache()) {
          setUserId(null);
          writeCache(null);
        }
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
    // Wait for the device identity, or the rules would reject an unauthenticated listen.
    if (!uid) return;
    return onSnapshot(
      collection(db, 'users'),
      { includeMetadataChanges: true },
      (snap) => {
        // An empty cache (first launch offline) says nothing: keep what we had.
        if (snap.metadata.fromCache && snap.empty) return;
        const list: User[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<User, 'id'>) }));
        setUsers(toMap(list));
        if (!snap.metadata.fromCache) {
          const active = list.some((u) => u.id === userId && u.active);
          writeCache(active ? { uid, userId, users: list } : null);
        }
      },
      (e) => {
        if (e.code !== 'permission-denied') return setError(e.message);
        writeCache(null);
        setUsers(null);
        setUserId(null);
        setError('welcome.revoked');
      },
    );
  }, [userId, uid]);

  const link = useCallback(
    async (rawKey: string) => {
      const key = rawKey.trim();
      if (!uid || !key) throw new Error('welcome.enterKey');
      if (!navigator.onLine) throw new Error('welcome.offline');
      const k = await withTimeout(getDoc(doc(db, 'keys', key)));
      if (!k.exists()) throw new Error('welcome.unknownKey');
      await withTimeout(setDoc(doc(db, 'sessions', uid), { key, userId: k.data().userId, createdAt: serverTimestamp() }));
      setError(null);
    },
    [uid],
  );

  const unlink = useCallback(async () => {
    writeCache(null);
    setUserId(null);
    if (uid) await deleteDoc(doc(db, 'sessions', uid));
  }, [uid]);

  const me = userId && users ? (users.get(userId) ?? null) : null;
  let status: Status = 'loading';
  if (users && me?.active) status = 'ready';
  else if ((linkedChecked && !userId) || authFailed) status = 'unlinked';
  else if (users) status = 'unlinked';

  // Never sit on the loading screen silently.
  useEffect(() => {
    if (status !== 'loading') return setSlow(false);
    const id = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(id);
  }, [status]);

  const shownError = error ?? (users && me && !me.active ? 'welcome.deactivated' : null);

  return (
    <Ctx.Provider
      value={{ status, authReady: uid !== null, slow, error: shownError, me: status === 'ready' ? me : null, users: users ?? new Map(), link, unlink }}
    >
      {children}
    </Ctx.Provider>
  );
}
