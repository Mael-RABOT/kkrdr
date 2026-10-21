import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocFromServer,
  getDocs,
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
} from 'firebase/firestore';
import { db } from './firebase';
import type { Poop, PoopDoc } from './types';

const poops = collection(db, 'poops');

function toPoop(snap: DocumentSnapshot): Poop {
  // 'estimate' gives entries still waiting for the server a local createdAt.
  const d = snap.data({ serverTimestamps: 'estimate' }) as PoopDoc;
  return { ...d, id: snap.id, at: d.at.toDate(), createdAt: d.createdAt?.toDate() };
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

/** One entry, or null if it does not exist (served from the local cache when offline). */
export async function getPoop(id: string): Promise<Poop | null> {
  const snap = await getDoc(doc(poops, id));
  return snap.exists() ? toPoop(snap) : null;
}

export function deletePoop(id: string) {
  return deleteDoc(doc(poops, id));
}

export function subscribeAll(cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, orderBy('at', 'desc')),
    (snap) => cb(snap.docs.map(toPoop)),
    onError,
  );
}

/** The newest n entries by the given field, live. */
export function subscribeRecent(n: number, sort: FeedSort, cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, orderBy(sort, 'desc'), limit(n)),
    (snap) => cb(snap.docs.map(toPoop)),
    onError,
  );
}

/** Entries since a date, live. */
export function subscribeSince(since: Date, cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, where('at', '>=', Timestamp.fromDate(since))),
    (snap) => cb(snap.docs.map(toPoop)),
    onError,
  );
}

/** Set, change or (with null) remove your vote on someone else's entry. */
export function vote(poopId: string, userId: string, value: 1 | -1 | null) {
  return updateDoc(doc(poops, poopId), { [`votes.${userId}`]: value ?? deleteField() });
}

// ---- avatars ----

const avatars = collection(db, 'avatars');

function avatarUrl(d: { img: Bytes; type: string }) {
  return `data:${d.type};base64,${d.img.toBase64()}`;
}

/** Every profile picture as a data URL, by user id, live. */
export function subscribeAvatars(cb: (m: Map<string, string>) => void, onError: (e: Error) => void) {
  return onSnapshot(
    avatars,
    (snap) => {
      const m = new Map<string, string>();
      snap.forEach((d) => m.set(d.id, avatarUrl(d.data() as { img: Bytes; type: string })));
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
  return `${location.origin}/welcome?key=${key}`;
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
