import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Poop, PoopDoc } from './types';

const poops = collection(db, 'poops');

function toPoop(id: string, d: PoopDoc): Poop {
  return { ...d, id, at: d.at.toDate() };
}

export type NewPoop = Omit<Poop, 'id' | 'userId'>;

export function addPoop(userId: string, p: NewPoop) {
  const data: Record<string, unknown> = { ...p, userId, at: Timestamp.fromDate(p.at), createdAt: serverTimestamp() };
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k];
  return addDoc(poops, data);
}

export function deletePoop(id: string) {
  return deleteDoc(doc(poops, id));
}

export function subscribeFeed(n: number, cb: (p: Poop[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(poops, orderBy('at', 'desc'), limit(n)),
    (snap) => cb(snap.docs.map((d) => toPoop(d.id, d.data() as PoopDoc))),
    onError,
  );
}

export async function fetchSince(since: Date | null): Promise<Poop[]> {
  const q = since ? query(poops, where('at', '>=', Timestamp.fromDate(since))) : poops;
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPoop(d.id, d.data() as PoopDoc));
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
  const refs = [...entries.docs.map((d) => d.ref), ...userKeys.map((k) => doc(keys, k)), doc(users, userId)];
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}
