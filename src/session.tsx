import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { readLocal, writeLocal } from './localCache';
import { useOnline } from './useOnline';
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

// ---- the key this device was linked with ----
// Some browsers drop the anonymous auth identity between launches (privacy settings, storage eviction):
// the device then gets a new uid with no session. Keeping the key lets it re-link silently.
// The key is no more secret than the sessions/{uid} doc, which this device can already read.

const DEVICE_KEY = 'device-key';
const readKey = () => readLocal<string>(DEVICE_KEY);
const writeKey = (k: string | null) => writeLocal(DEVICE_KEY, k);

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
  const [savedKey, setSavedKey] = useState(readKey);
  const [relinkFailed, setRelinkFailed] = useState(false);
  const online = useOnline();

  const rememberKey = useCallback((k: string | null) => {
    writeKey(k);
    setSavedKey(k);
  }, []);

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
        if (snap.exists()) {
          setUserId(snap.data().userId as string);
          // Also backfills devices linked before the key was kept locally.
          if (typeof snap.data().key === 'string' && snap.data().key !== readKey()) rememberKey(snap.data().key);
        } else if (!snap.metadata.fromCache || !readCache()) {
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
  }, [uid, rememberKey]);

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
        rememberKey(null);
        setUsers(null);
        setUserId(null);
        setError('welcome.revoked');
      },
    );
  }, [userId, uid, rememberKey]);

  const link = useCallback(
    async (rawKey: string) => {
      const key = rawKey.trim();
      if (!uid || !key) throw new Error('welcome.enterKey');
      if (!navigator.onLine) throw new Error('welcome.offline');
      const k = await withTimeout(getDoc(doc(db, 'keys', key)));
      if (!k.exists()) throw new Error('welcome.unknownKey');
      await withTimeout(setDoc(doc(db, 'sessions', uid), { key, userId: k.data().userId, createdAt: serverTimestamp() }));
      rememberKey(key);
      setError(null);
    },
    [uid, rememberKey],
  );

  // This device lost its session (new uid) but remembers its key: link again without asking.
  const relinking = !!uid && linkedChecked && !userId && !!savedKey && !relinkFailed && online;
  useEffect(() => {
    if (!relinking || !savedKey) return;
    link(savedKey).catch((e) => {
      if (e instanceof Error && e.message === 'welcome.unknownKey') rememberKey(null);
      setRelinkFailed(true);
    });
  }, [relinking, savedKey, link, rememberKey]);

  const unlink = useCallback(async () => {
    writeCache(null);
    rememberKey(null);
    setUserId(null);
    if (uid) await deleteDoc(doc(db, 'sessions', uid));
  }, [uid, rememberKey]);

  const me = userId && users ? (users.get(userId) ?? null) : null;
  let status: Status = 'loading';
  if (users && me?.active) status = 'ready';
  else if (relinking) status = 'loading';
  else if ((linkedChecked && !userId) || authFailed) status = 'unlinked';
  else if (users) status = 'unlinked';

  // Ask the browser not to evict this site's storage (auth identity included) under pressure.
  useEffect(() => {
    if (status === 'ready') void navigator.storage?.persist?.().catch(() => {});
  }, [status]);

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
