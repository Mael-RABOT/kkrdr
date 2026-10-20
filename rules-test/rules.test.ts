import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kkrdr-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { name: 'Alice', admin: true, active: true });
    await setDoc(doc(db, 'users/bob'), { name: 'Bob', admin: false, active: true });
    await setDoc(doc(db, 'keys/alicekey'), { userId: 'alice' });
    await setDoc(doc(db, 'keys/bobkey'), { userId: 'bob' });
    await setDoc(doc(db, 'poops/a1'), { userId: 'alice', at: Timestamp.now(), type: 4, size: 'M', place: 'home', createdAt: Timestamp.now() });
  });
});

const db = (uid: string) => env.authenticatedContext(uid).firestore();
const link = (uid: string, key: string, userId: string) =>
  setDoc(doc(db(uid), 'sessions', uid), { key, userId, createdAt: serverTimestamp() });
const poop = (userId: string, extra: object = {}) => ({
  userId, at: Timestamp.now(), type: 3, size: 'L', place: 'work', createdAt: serverTimestamp(), ...extra,
});

describe('linking', () => {
  it('rejects an unknown key or a mismatched user', async () => {
    await assertFails(link('dev1', 'nope', 'bob'));
    await assertFails(link('dev1', 'bobkey', 'alice'));
  });
  it('accepts a valid key and allows reading the feed afterwards', async () => {
    await assertFails(getDocs(collection(db('dev1'), 'poops')));
    await assertSucceeds(getDoc(doc(db('dev1'), 'keys/bobkey')));
    await assertSucceeds(link('dev1', 'bobkey', 'bob'));
    await assertSucceeds(getDocs(collection(db('dev1'), 'poops')));
  });
  it('unauthenticated access is denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'keys/bobkey')));
  });
});

describe('as a regular user', () => {
  beforeEach(() => link('dev1', 'bobkey', 'bob'));

  it('cannot list keys or write users', async () => {
    await assertFails(getDocs(collection(db('dev1'), 'keys')));
    await assertFails(updateDoc(doc(db('dev1'), 'users/bob'), { admin: true }));
  });
  it('can log own poop but not for someone else', async () => {
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/b1'), poop('bob')));
    await assertFails(setDoc(doc(db('dev1'), 'poops/b2'), poop('alice')));
  });
  it('validates poop fields', async () => {
    await assertFails(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { type: 9 })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { size: 'XXL' })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { hack: true })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { note: 'x'.repeat(281) })));
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { rating: 5, duration: 3, note: 'ok' })));
  });
  it('can delete only own poops', async () => {
    await assertFails(deleteDoc(doc(db('dev1'), 'poops/a1')));
    await setDoc(doc(db('dev1'), 'poops/b1'), poop('bob'));
    await assertSucceeds(deleteDoc(doc(db('dev1'), 'poops/b1')));
  });
  it('loses access when the key is deleted', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'keys/bobkey')));
    await assertFails(getDocs(collection(db('dev1'), 'poops')));
  });
  it('loses access when deactivated', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/bob'), { active: false }));
    await assertFails(getDocs(collection(db('dev1'), 'poops')));
  });
});

describe('as admin', () => {
  beforeEach(() => link('dev2', 'alicekey', 'alice'));

  it('can manage users and keys', async () => {
    await assertSucceeds(getDocs(collection(db('dev2'), 'keys')));
    await assertSucceeds(setDoc(doc(db('dev2'), 'users/carol'), { name: 'Carol', admin: false, active: true }));
    await assertSucceeds(setDoc(doc(db('dev2'), 'keys/carolkey'), { userId: 'carol' }));
    await assertSucceeds(updateDoc(doc(db('dev2'), 'users/bob'), { active: false }));
    await assertSucceeds(deleteDoc(doc(db('dev2'), 'keys/bobkey')));
  });
  it('can delete anyone\'s poop', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'poops/b9'), { userId: 'bob', at: Timestamp.now(), type: 1, size: 'S', place: 'home', createdAt: Timestamp.now() }));
    await assertSucceeds(deleteDoc(doc(db('dev2'), 'poops/b9')));
  });
});

describe('first-admin setup', () => {
  const bootstrap = (uid: string, userId: string, key: string) => {
    const d = db(uid);
    const batch = writeBatch(d);
    batch.set(doc(d, 'users', userId), { name: 'Root', admin: true, active: true });
    batch.set(doc(d, 'keys', key), { userId });
    batch.set(doc(d, 'config/setup'), { userId, key });
    return batch.commit();
  };

  it('allows creating the first admin once, then never again', async () => {
    await assertSucceeds(bootstrap('dev9', 'root', 'rootkey123'));
    await assertSucceeds(link('dev9', 'rootkey123', 'root'));
    await assertSucceeds(getDocs(collection(db('dev9'), 'keys')));
    await assertFails(bootstrap('dev8', 'evil', 'evilkey123'));
  });
  it('cannot be used to write users or keys without creating config/setup', async () => {
    await assertFails(setDoc(doc(db('dev9'), 'users/evil'), { name: 'Evil', admin: true, active: true }));
    await assertFails(setDoc(doc(db('dev9'), 'keys/evilkey'), { userId: 'alice' }));
  });
  it('cannot attach a key to an existing user during setup', async () => {
    const d = db('dev7');
    const batch = writeBatch(d);
    batch.set(doc(d, 'keys/stolen123'), { userId: 'alice' });
    batch.set(doc(d, 'config/setup'), { userId: 'alice', key: 'stolen123' });
    await assertFails(batch.commit());
  });
});

describe('removing a user', () => {
  it('admin can delete a user with their entries and key; their device loses access', async () => {
    await link('dev1', 'bobkey', 'bob');
    await setDoc(doc(db('dev1'), 'poops/b1'), poop('bob'));
    await link('dev2', 'alicekey', 'alice');
    const d = db('dev2');
    const batch = writeBatch(d);
    batch.delete(doc(d, 'poops/b1'));
    batch.delete(doc(d, 'keys/bobkey'));
    batch.delete(doc(d, 'users/bob'));
    await assertSucceeds(batch.commit());
    await assertFails(getDocs(collection(db('dev1'), 'poops')));
  });
  it('a regular user cannot delete users', async () => {
    await link('dev1', 'bobkey', 'bob');
    await assertFails(deleteDoc(doc(db('dev1'), 'users/alice')));
  });
});
