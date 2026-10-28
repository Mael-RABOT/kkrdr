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
  updateDoc,
  deleteField,
  setDoc,
  Bytes,
  runTransaction,
  increment,
  collectionGroup,
  arrayUnion,
  arrayRemove,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Report, ReportData } from './reports';
import type { Comment, Mention, Poop, PoopDoc } from './types';

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

/** A compressed photo for an entry (see encodePhoto). */
export type Photo = { bytes: Uint8Array<ArrayBuffer>; type: string };
/** A sound recording for an entry (see useRecorder), and its length in whole seconds. */
export type Sound = { bytes: Uint8Array<ArrayBuffer>; type: string; secs: number };
/** Media to change on save: a new one, null to remove it, undefined (or left out) to keep it. */
export type MediaChange = { photo?: Photo | null; sound?: Sound | null };

/** Photos live apart from their entry (pictures/{poopId}), so lists of entries stay light. */
const pictures = collection(db, 'pictures');

/** Recordings too (sounds/{poopId}). */
const sounds = collection(db, 'sounds');

/** Puts the media changes in the batch, and on the entry's data: versions, or deleteField() when removed. */
function setMedia(batch: WriteBatch, poopId: string, media: MediaChange, data: Record<string, unknown>) {
  const v = Date.now();
  if (media.photo) {
    batch.set(doc(pictures, poopId), { img: Bytes.fromUint8Array(media.photo.bytes), type: media.photo.type, v });
    data.photo = v;
  } else if (media.photo === null) {
    batch.delete(doc(pictures, poopId));
    data.photo = deleteField();
  }
  if (media.sound) {
    batch.set(doc(sounds, poopId), { audio: Bytes.fromUint8Array(media.sound.bytes), type: media.sound.type, v });
    data.sound = { v, secs: media.sound.secs };
  } else if (media.sound === null) {
    batch.delete(doc(sounds, poopId));
    data.sound = deleteField();
  }
}

/** A new entry, with its photo and sound in the same batch. */
export function addPoop(userId: string, p: NewPoop, media: MediaChange = {}) {
  const ref = doc(poops);
  const batch = writeBatch(db);
  const data: Record<string, unknown> = { ...p, userId, at: Timestamp.fromDate(p.at), createdAt: serverTimestamp() };
  for (const k of Object.keys(data)) if (data[k] === undefined || data[k] === '') delete data[k];
  // Nothing to remove on a new entry.
  setMedia(batch, ref.id, { photo: media.photo ?? undefined, sound: media.sound ?? undefined }, data);
  batch.set(ref, data);
  return batch.commit();
}

const OPTIONAL = ['placeNote', 'duration', 'rating', 'color', 'note', 'perfect', 'gif'] as const;

/**
 * Owner edit: every field is rewritten, empty optional ones removed. Votes, author and createdAt stay.
 * Photo and sound change only as `media` says.
 */
export function updatePoop(id: string, p: NewPoop, media: MediaChange = {}) {
  const batch = writeBatch(db);
  const data: Record<string, unknown> = { at: Timestamp.fromDate(p.at), type: p.type, size: p.size, place: p.place };
  for (const k of OPTIONAL) data[k] = p[k] === undefined || p[k] === '' ? deleteField() : p[k];
  setMedia(batch, id, media, data);
  batch.update(doc(poops, id), data);
  return batch.commit();
}

/** Object URLs of the photos and sounds already loaded, by path and version. */
const mediaUrls = new Map<string, string>();

/** A stored photo or sound as an object URL, or null if there is none. The local cache answers when it has that version. */
async function getMedia(ref: DocumentReference, v: number): Promise<string | null> {
  const key = `${ref.path}:${v}`;
  const hit = mediaUrls.get(key);
  if (hit) return hit;
  let snap = await getDocFromCache(ref).catch(() => null);
  if (!snap?.exists() || snap.data().v !== v) snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as { img?: Bytes; audio?: Bytes; type: string };
  const bytes = (d.img ?? d.audio)!.toUint8Array() as Uint8Array<ArrayBuffer>;
  const url = URL.createObjectURL(new Blob([bytes], { type: d.type }));
  mediaUrls.set(key, url);
  return url;
}

export const getPicture = (poopId: string, v: number) => getMedia(doc(pictures, poopId), v);
export const getSound = (poopId: string, v: number) => getMedia(doc(sounds, poopId), v);
export const getCommentSound = (poopId: string, commentId: string, v: number) => getMedia(commentSound(poopId, commentId), v);

/** One entry, or null if it does not exist. The local cache answers first, so a bad connection doesn't stall. */
export async function getPoop(id: string): Promise<Poop | null> {
  const cached = await getDocFromCache(doc(poops, id)).catch(() => null);
  if (cached?.exists()) return toPoop(cached);
  const snap = await getDoc(doc(poops, id));
  return snap.exists() ? toPoop(snap) : null;
}

/** Deletes an entry and its comments. Comments not in the local cache are missed when offline. */
export async function deletePoop(id: string) {
  const thread = await getDocs(commentsOf(id));
  const batch = writeBatch(db);
  thread.docs.forEach((d) => {
    if (d.data().sound) batch.delete(commentSound(id, d.id));
    batch.delete(d.ref);
  });
  batch.delete(doc(pictures, id));
  batch.delete(doc(sounds, id));
  batch.delete(doc(poops, id));
  return batch.commit();
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

// ---- comments ----

/** An entry's comments: poops/{id}/comments. The entry's commentCount changes in the same batch. */
const commentsOf = (poopId: string) => collection(poops, poopId, 'comments');

/** A voice comment's audio, apart from it (poops/{id}/commentSounds/{commentId}) so threads stay light. */
const commentSound = (poopId: string, commentId: string) => doc(poops, poopId, 'commentSounds', commentId);

function toComment(snap: DocumentSnapshot): Comment {
  const d = snap.data({ serverTimestamps: 'estimate' }) as Omit<Comment, 'id' | 'createdAt' | 'editedAt'> & { createdAt: Timestamp; editedAt?: Timestamp };
  const c: Comment = { id: snap.id, userId: d.userId, text: d.text, createdAt: d.createdAt.toDate(), editedAt: d.editedAt?.toDate(), mentions: d.mentions, sound: d.sound, likes: d.likes };
  if (snap.metadata.hasPendingWrites) c.pending = true;
  return c;
}

/** An entry's comments, oldest first, live. */
export function subscribeComments(poopId: string, cb: (c: Comment[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    query(commentsOf(poopId), orderBy('createdAt')),
    { includeMetadataChanges: true },
    (snap) => cb(snap.docs.map(toComment)),
    onError,
  );
}

/** `mentions`: who the text tags (see mentionedIds), stored so they can find it. `sound`: a voice message, with or without text. */
export function addComment(poopId: string, userId: string, text: string, mentions: string[], sound?: Sound) {
  const batch = writeBatch(db);
  const ref = doc(commentsOf(poopId));
  const data: Record<string, unknown> = { userId, text, createdAt: serverTimestamp(), ...(mentions.length && { mentions }) };
  if (sound) {
    const v = Date.now();
    batch.set(commentSound(poopId, ref.id), { audio: Bytes.fromUint8Array(sound.bytes), type: sound.type, v });
    data.sound = { v, secs: sound.secs };
  }
  batch.set(ref, data);
  batch.update(doc(poops, poopId), { commentCount: increment(1) });
  return batch.commit();
}

export function editComment(poopId: string, id: string, text: string, mentions: string[]) {
  return updateDoc(doc(commentsOf(poopId), id), { text, mentions: mentions.length ? mentions : deleteField(), editedAt: serverTimestamp() });
}

/** Like someone else's comment, or (with false) take the like back. */
export function likeComment(poopId: string, id: string, userId: string, on: boolean) {
  return updateDoc(doc(commentsOf(poopId), id), { likes: on ? arrayUnion(userId) : arrayRemove(userId) });
}

export function deleteComment(poopId: string, c: Comment) {
  const batch = writeBatch(db);
  if (c.sound) batch.delete(commentSound(poopId, c.id));
  batch.delete(doc(commentsOf(poopId), c.id));
  batch.update(doc(poops, poopId), { commentCount: increment(-1) });
  return batch.commit();
}

/** The newest n comments tagging a user, on any entry, newest first. */
const mentionsOf = (userId: string, n: number) =>
  query(collectionGroup(db, 'comments'), where('mentions', 'array-contains', userId), orderBy('createdAt', 'desc'), limit(n));

const toMention = (d: DocumentSnapshot): Mention => ({ poopId: d.ref.parent.parent!.id, comment: toComment(d) });

/** A user's mentions, live. */
export function subscribeMentions(userId: string, n: number, cb: (m: Mention[]) => void, onError: (e: Error) => void) {
  return onSnapshot(mentionsOf(userId, n), (snap) => cb(snap.docs.map(toMention)), onError);
}

/** A user's mentions straight from the server, not the local cache (on start and when the app comes back). */
export async function fetchMentions(userId: string, n: number): Promise<Mention[]> {
  const snap = await getDocsFromServer(mentionsOf(userId, n));
  return snap.docs.map(toMention);
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

/**
 * Every comment a user wrote. The collection group query needs its single-field index
 * (firestore.indexes.json); until that is deployed and built, it falls back to querying each thread.
 */
async function commentsBy(userId: string): Promise<QueryDocumentSnapshot[]> {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'comments'), where('userId', '==', userId)));
    return snap.docs;
  } catch (e) {
    if ((e as { code?: string }).code !== 'failed-precondition') throw e;
    const all = await getDocs(poops);
    const threads = await Promise.all(
      all.docs.map((d) => getDocs(query(commentsOf(d.id), where('userId', '==', userId)))),
    );
    return threads.flatMap((t) => t.docs);
  }
}

/**
 * Deletes a user, their keys, all their entries (with their comments) and their comments on other
 * entries. The user doc goes last so a failure can be retried.
 */
export async function removeUser(userId: string) {
  const [entries, userKeys, written] = await Promise.all([
    getDocs(query(poops, where('userId', '==', userId))),
    keysFor(userId),
    commentsBy(userId),
  ]);
  const own = new Set(entries.docs.map((d) => d.id));

  // Comments on other people's entries: one batch per entry, so its count goes down with them.
  const byPoop = new Map<string, QueryDocumentSnapshot[]>();
  for (const c of written) {
    const poopId = c.ref.parent.parent!.id;
    if (own.has(poopId)) continue;
    byPoop.set(poopId, [...(byPoop.get(poopId) ?? []), c]);
  }
  for (const [poopId, thread] of byPoop) {
    const batch = writeBatch(db);
    thread.forEach((c) => {
      if (c.data().sound) batch.delete(commentSound(poopId, c.id));
      batch.delete(c.ref);
    });
    batch.update(doc(poops, poopId), { commentCount: increment(-thread.length) });
    await batch.commit();
  }

  const threads = await Promise.all(entries.docs.map((d) => getDocs(commentsOf(d.id))));
  const refs = [
    // Each thread, photo and sound goes before its entry, in the same batch or an earlier one.
    ...entries.docs.flatMap((d, i) => [...threads[i].docs.flatMap((c) => (c.data().sound ? [commentSound(d.id, c.id), c.ref] : [c.ref])), doc(pictures, d.id), doc(sounds, d.id), d.ref]),
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
