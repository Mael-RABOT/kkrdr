import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentSnapshot,
  addDoc,
  updateDoc,
  deleteField,
  setDoc,
  Bytes,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Report, ReportData } from './reports';
import type { Poop, PoopDoc } from './types';

const poops = collection(db, 'poops');

function toPoop(snap: DocumentSnapshot): Poop {
  // 'estimate' gives entries still waiting for the server a local createdAt.
  const d = snap.data({ serverTimestamps: 'estimate' }) as PoopDoc;
  const p: Poop = { ...d, id: snap.id, at: d.at.toDate(), createdAt: d.createdAt?.toDate() };
  // Logged, edited or voted on this device and not on the server yet.
  if (snap.metadata.hasPendingWrites) p.pending = true;
  return p;
}

export type NewPoop = Omit<Poop, 'id' | 'userId' | 'createdAt'>;

/** Feed order: when it happened, or when it was posted. */
export type FeedSort = 'at' | 'createdAt';

export function addPoop(userId: string, p: NewPoop) {
  const data: Record<string, unknown> = { ...p, userId, at: Timestamp.fromDate(p.at), createdAt: serverTimestamp() };
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k];
  return addDoc(poops, data);
}

const OPTIONAL = ['placeNote', 'duration', 'rating', 'color', 'note', 'perfect'] as const;

/** Owner edit: every field is rewritten, empty optional ones removed. Votes, author and createdAt stay. */
export function updatePoop(id: string, p: NewPoop) {
  const data: Record<string, unknown> = { at: Timestamp.fromDate(p.at), type: p.type, size: p.size, place: p.place };
  for (const k of OPTIONAL) data[k] = p[k] === undefined || p[k] === '' ? deleteField() : p[k];
  return updateDoc(doc(poops, id), data);
}

/** One entry, or null if it does not exist. The local cache answers first, so a bad connection doesn't stall. */
export async function getPoop(id: string): Promise<Poop | null> {
  const cached = await getDocFromCache(doc(poops, id)).catch(() => null);
  if (cached?.exists()) return toPoop(cached);
  const snap = await getDoc(doc(poops, id));
  return snap.exists() ? toPoop(snap) : null;
}

export function deletePoop(id: string) {
  return deleteDoc(doc(poops, id));
}

export function subscribeAll(cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, orderBy('at', 'desc')),
    // Metadata changes too, so the pending flag clears once the server has the entry.
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map(toPoop)),
    onError,
  );
}

/** Entries since a date, live. */
export function subscribeSince(since: Date, cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, where('at', '>=', Timestamp.fromDate(since))),
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map(toPoop)),
    onError,
  );
}

/** Entries in [start, end), straight from the server (for a report, which must not miss any). */
export async function fetchPeriod(start: Date, end: Date): Promise<Poop[]> {
  const snap = await getDocsFromServer(
    query(poops, where('at', '>=', Timestamp.fromDate(start)), where('at', '<', Timestamp.fromDate(end))),
  );
  return snap.docs.map(toPoop);
}

/** The newest entries by the given field from `from` on, live. */
export function subscribeFrom(from: Date, sort: FeedSort, cb: (p: Poop[], fromServer: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, where(sort, '>=', Timestamp.fromDate(from)), orderBy(sort, 'desc')),
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map(toPoop), !snap.metadata.fromCache),
    onError,
  );
}

/** The newest entry before `before` by the given field, or null if there is none. */
export async function newestBefore(before: Date, sort: FeedSort): Promise<Poop | null> {
  const snap = await getDocs(query(poops, where(sort, '<', Timestamp.fromDate(before)), orderBy(sort, 'desc'), limit(1)));
  return snap.docs[0] ? toPoop(snap.docs[0]) : null;
}

/** Set, change or (with null) remove your vote on someone else's entry. */
export function vote(poopId: string, userId: string, value: 1 | -1 | null) {
  return updateDoc(doc(poops, poopId), { [`votes.${userId}`]: value ?? deleteField() });
}

// ---- reports ----

const reports = collection(db, 'reports');

/** Every week / month report, live. `fromServer` once the list is known to be complete. */
export function subscribeReports(cb: (r: Report[], fromServer: boolean) => void, onError: (e: Error) => void) {
  return onSnapshot(
    reports,
    // Metadata changes too: a server answer equal to the cache must still say the list is complete.
    { includeMetadataChanges: true },
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const r = d.data() as ReportData & { start: Timestamp; end: Timestamp };
          return { ...r, id: d.id, start: r.start.toDate(), end: r.end.toDate() };
        }),
        !snap.metadata.fromCache,
      ),
    onError,
  );
}

/**
 * Writes a report unless someone already did. A transaction needs the server, so nothing is
 * queued offline; the rules refuse a second write, the first client wins.
 */
export function createReport(id: string, r: Omit<ReportData, 'createdAt'> & { start: Date; end: Date }) {
  const ref = doc(reports, id);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return;
    tx.set(ref, { ...r, start: Timestamp.fromDate(r.start), end: Timestamp.fromDate(r.end), createdAt: serverTimestamp() });
  });
}

// ---- avatars ----

const avatars = collection(db, 'avatars');

function avatarUrl(d: { img: Bytes; type: string }) {
  return `data:${d.type};base64,${d.img.toBase64()}`;
}

/** Every profile picture as a data URL, by user id, live. */
export function subscribeAvatars(cb: (m: Map<string, string>) => void, onError: (e: Error) => void) {
  // Base64-encoding every picture on each snapshot is wasted work: reuse unchanged ones.
  const memo = new Map<string, { version: number; url: string }>();
  return onSnapshot(
    avatars,
    (snap) => {
      const m = new Map<string, string>();
      snap.forEach((d) => {
        const data = d.data({ serverTimestamps: 'estimate' }) as { img: Bytes; type: string; updatedAt?: Timestamp };
        const version = data.updatedAt?.toMillis() ?? 0;
        let hit = memo.get(d.id);
        if (!hit || hit.version !== version) memo.set(d.id, (hit = { version, url: avatarUrl(data) }));
        m.set(d.id, hit.url);
      });
      cb(m);
    },
    onError,
  );
}

/** One picture straight from the server (not the cache), or null if there is none. */
export async function fetchAvatar(userId: string): Promise<string | null> {
  const snap = await getDocFromServer(doc(avatars, userId));
  return snap.exists() ? avatarUrl(snap.data() as { img: Bytes; type: string }) : null;
}

export function setAvatar(userId: string, img: Uint8Array, type: string) {
  return setDoc(doc(avatars, userId), { img: Bytes.fromUint8Array(img), type, updatedAt: serverTimestamp() });
}

export function removeAvatar(userId: string) {
  return deleteDoc(doc(avatars, userId));
}

// ---- admin ----

const users = collection(db, 'users');
const keys = collection(db, 'keys');

export function newKey(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function inviteLink(key: string) {
  return `${location.origin}/?key=${key}`;
}

export async function createUser(name: string): Promise<string> {
  const userRef = doc(users);
  const key = newKey();
  const batch = writeBatch(db);
  batch.set(userRef, { name, admin: false, active: true, createdAt: serverTimestamp() });
  batch.set(doc(keys, key), { userId: userRef.id, createdAt: serverTimestamp() });
  await batch.commit();
  return key;
}

export async function keysFor(userId: string): Promise<string[]> {
  const snap = await getDocs(query(keys, where('userId', '==', userId)));
  return snap.docs.map((d) => d.id);
}

export async function regenerateKey(userId: string): Promise<string> {
  const old = await keysFor(userId);
  const key = newKey();
  const batch = writeBatch(db);
  old.forEach((k) => batch.delete(doc(keys, k)));
  batch.set(doc(keys, key), { userId, createdAt: serverTimestamp() });
  await batch.commit();
  return key;
}

export async function revokeKeys(userId: string) {
  const old = await keysFor(userId);
  const batch = writeBatch(db);
  old.forEach((k) => batch.delete(doc(keys, k)));
  await batch.commit();
}

export function updateUser(userId: string, patch: { name?: string; admin?: boolean; active?: boolean }) {
  return updateDoc(doc(users, userId), patch);
}

export async function countPoops(userId: string): Promise<number> {
  const snap = await getCountFromServer(query(poops, where('userId', '==', userId)));
  return snap.data().count;
}

/** Deletes a user, their keys and all their entries. The user doc goes last so a failure can be retried. */
export async function removeUser(userId: string) {
  const [entries, userKeys] = await Promise.all([
    getDocs(query(poops, where('userId', '==', userId))),
    keysFor(userId),
  ]);
  const refs = [
    ...entries.docs.map((d) => d.ref),
    ...userKeys.map((k) => doc(keys, k)),
    doc(avatars, userId),
    doc(users, userId),
  ];
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}
