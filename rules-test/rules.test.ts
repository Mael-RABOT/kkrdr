import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, collectionGroup, query, where, setDoc, serverTimestamp, Timestamp, updateDoc, writeBatch, deleteField, Bytes, arrayUnion, arrayRemove } from 'firebase/firestore';

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
    await assertFails(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { color: 'purple' })));
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/x'), poop('bob', { rating: 5, duration: 3, color: 'green', note: 'ok' })));
  });
  it('accepts a Perfect only as type 4 rated 5', async () => {
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/p1'), poop('bob', { type: 4, rating: 5, perfect: true })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/p2'), poop('bob', { type: 3, rating: 5, perfect: true })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/p3'), poop('bob', { type: 4, perfect: true })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/p4'), poop('bob', { type: 4, rating: 5, perfect: false })));
  });
  it('can edit own poop, keeping votes, and remove optional fields', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'poops/b5'), {
        userId: 'bob', at: Timestamp.now(), type: 4, rating: 5, perfect: true, size: 'M', place: 'home',
        note: 'wow', votes: { alice: 1 }, createdAt: Timestamp.now(),
      }),
    );
    const ref = doc(db('dev1'), 'poops/b5');
    await assertSucceeds(updateDoc(ref, { type: 3, rating: 4, perfect: deleteField(), note: deleteField(), size: 'L' }));
    await assertFails(updateDoc(ref, { perfect: true })); // type 3 cannot be perfect
    await assertFails(updateDoc(ref, { votes: {} }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1'), { size: 'S' }));
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

describe('entry pictures', () => {
  beforeEach(async () => {
    await link('dev1', 'bobkey', 'bob');
    await link('dev2', 'alicekey', 'alice');
  });
  const img = (v: number, n = 1000, type = 'image/webp') => ({ img: Bytes.fromUint8Array(new Uint8Array(n)), type, v });
  /** An entry and its photo, in one batch, as the app writes them. */
  const withPhoto = (uid: string, owner: string, id: string, v: number, pic: object, entry: object = {}) => {
    const d = db(uid);
    const b = writeBatch(d);
    b.set(doc(d, `poops/${id}`), poop(owner, { photo: v, ...entry }));
    b.set(doc(d, `pictures/${id}`), pic);
    return b.commit();
  };

  it('can be added with its entry by the owner, and read with a valid session', async () => {
    await assertSucceeds(withPhoto('dev1', 'bob', 'b1', 5, img(5)));
    await assertSucceeds(getDoc(doc(db('dev2'), 'pictures/b1')));
    await assertFails(getDoc(doc(db('nobody'), 'pictures/b1')));
  });
  it('rejects a photo too big, of the wrong type, of another version or without its entry', async () => {
    await assertFails(withPhoto('dev1', 'bob', 'b1', 5, img(5, 260_001)));
    await assertFails(withPhoto('dev1', 'bob', 'b1', 5, img(5, 1000, 'image/png')));
    await assertFails(withPhoto('dev1', 'bob', 'b1', 5, img(6)));
    await assertFails(withPhoto('dev1', 'bob', 'b1', 5, { ...img(5), extra: 1 }));
    await assertFails(setDoc(doc(db('dev1'), 'pictures/b1'), img(5)));
  });
  it('cannot be put on someone else\'s entry', async () => {
    const d = db('dev1');
    const b = writeBatch(d);
    b.update(doc(d, 'poops/a1'), { photo: 5 });
    b.set(doc(d, 'pictures/a1'), img(5));
    await assertFails(b.commit());
  });
  it('can be replaced or removed by the owner with the entry', async () => {
    await assertSucceeds(withPhoto('dev1', 'bob', 'b1', 5, img(5)));
    const d = db('dev1');
    let b = writeBatch(d);
    b.update(doc(d, 'poops/b1'), { photo: 6 });
    b.set(doc(d, 'pictures/b1'), img(6));
    await assertSucceeds(b.commit());
    b = writeBatch(d);
    b.update(doc(d, 'poops/b1'), { photo: deleteField() });
    b.delete(doc(d, 'pictures/b1'));
    await assertSucceeds(b.commit());
  });
  it('accepts a Tenor or GIPHY GIF instead, never both', async () => {
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/g1'), poop('bob', { gif: 'https://media2.giphy.com/media/abc/200.webp' })));
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/g4'), poop('bob', { gif: 'https://tenor.com/view/happy-cat-gif-108.gif' })));
    await assertSucceeds(setDoc(doc(db('dev1'), 'poops/g5'), poop('bob', { gif: 'https://media1.tenor.com/m/lfD/happy-cat.gif' })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/g2'), poop('bob', { gif: 'https://evil.example.com/x.gif' })));
    await assertFails(setDoc(doc(db('dev1'), 'poops/g6'), poop('bob', { gif: 'https://tenor.com/search/cat-gifs' })));
    await assertFails(withPhoto('dev1', 'bob', 'g3', 5, img(5), { gif: 'https://media.giphy.com/media/abc/200.webp' }));
  });
});

describe('entry sounds', () => {
  beforeEach(async () => {
    await link('dev1', 'bobkey', 'bob');
    await link('dev2', 'alicekey', 'alice');
  });
  const audio = (v: number, n = 1000, type = 'audio/webm;codecs=opus') => ({ audio: Bytes.fromUint8Array(new Uint8Array(n)), type, v });
  /** An entry and its sound, in one batch, as the app writes them. */
  const withSound = (uid: string, id: string, sound: object, rec: object) => {
    const d = db(uid);
    const b = writeBatch(d);
    b.set(doc(d, `poops/${id}`), poop('bob', { sound }));
    b.set(doc(d, `sounds/${id}`), rec);
    return b.commit();
  };

  it('can be added with its entry by the owner, and read with a valid session', async () => {
    await assertSucceeds(withSound('dev1', 's1', { v: 5, secs: 7 }, audio(5)));
    await assertSucceeds(withSound('dev1', 's2', { v: 6, secs: 30 }, audio(6, 1000, 'audio/mp4')));
    await assertSucceeds(getDoc(doc(db('dev2'), 'sounds/s1')));
    await assertFails(getDoc(doc(db('nobody'), 'sounds/s1')));
  });
  it('rejects bad lengths, sizes, types, versions, or a sound without its entry', async () => {
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 31 }, audio(5)));
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 0 }, audio(5)));
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 3, extra: 1 }, audio(5)));
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 3 }, audio(5, 500_001)));
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 3 }, audio(5, 1000, 'text/html')));
    await assertFails(withSound('dev1', 's1', { v: 5, secs: 3 }, audio(6)));
    await assertFails(setDoc(doc(db('dev1'), 'sounds/s1'), audio(5)));
  });
  it('can be removed by the owner with the entry, not by someone else', async () => {
    await assertSucceeds(withSound('dev1', 's1', { v: 5, secs: 7 }, audio(5)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/carol'), { name: 'Carol', admin: false, active: true });
      await setDoc(doc(ctx.firestore(), 'keys/carolkey'), { userId: 'carol' });
    });
    await link('dev3', 'carolkey', 'carol');
    await assertFails(deleteDoc(doc(db('dev3'), 'sounds/s1')));
    const d = db('dev1');
    const b = writeBatch(d);
    b.update(doc(d, 'poops/s1'), { sound: deleteField() });
    b.delete(doc(d, 'sounds/s1'));
    await assertSucceeds(b.commit());
  });
});

describe('avatars', () => {
  beforeEach(() => link('dev1', 'bobkey', 'bob'));
  const pic = (n = 1000, type = 'image/webp') => ({ img: Bytes.fromUint8Array(new Uint8Array(n)), type, updatedAt: serverTimestamp() });

  it('lets you set, replace and remove only your own picture', async () => {
    await assertSucceeds(setDoc(doc(db('dev1'), 'avatars/bob'), pic()));
    await assertSucceeds(setDoc(doc(db('dev1'), 'avatars/bob'), pic(2000, 'image/jpeg')));
    await assertSucceeds(getDoc(doc(db('dev1'), 'avatars/bob')));
    await assertFails(setDoc(doc(db('dev1'), 'avatars/alice'), pic()));
    await assertSucceeds(deleteDoc(doc(db('dev1'), 'avatars/bob')));
  });
  it('rejects big, wrongly typed or extra-field pictures', async () => {
    await assertFails(setDoc(doc(db('dev1'), 'avatars/bob'), pic(60001)));
    await assertFails(setDoc(doc(db('dev1'), 'avatars/bob'), pic(1000, 'image/svg+xml')));
    await assertFails(setDoc(doc(db('dev1'), 'avatars/bob'), { ...pic(), x: 1 }));
    await assertFails(setDoc(doc(db('dev1'), 'avatars/bob'), { img: 'not bytes', type: 'image/webp', updatedAt: serverTimestamp() }));
  });
  it('is not readable without a valid session', async () => {
    await assertFails(getDoc(doc(db('nobody'), 'avatars/bob')));
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

describe('voting', () => {
  beforeEach(async () => {
    await link('dev1', 'bobkey', 'bob');
    await link('dev2', 'alicekey', 'alice');
  });

  it('can upvote, downvote and remove a vote on someone else\'s poop', async () => {
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.bob': 1 }));
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.bob': -1 }));
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.bob': deleteField() }));
  });
  it('cannot vote on own poop', async () => {
    await assertFails(updateDoc(doc(db('dev2'), 'poops/a1'), { 'votes.alice': 1 }));
  });
  it('cannot vote for someone else, use other values, or touch other fields', async () => {
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.carol': 1 }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.bob': 5 }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1'), { 'votes.bob': 1, type: 1 }));
  });
  it('cannot remove other people\'s votes', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'poops/a1'), { votes: { carol: -1 } }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1'), { votes: { bob: 1 } }));
  });
  it('owner cannot fake votes; cannot create with votes', async () => {
    await assertFails(updateDoc(doc(db('dev2'), 'poops/a1'), { votes: { bob: 1 } }));
    await assertFails(setDoc(doc(db('dev1'), 'poops/bx'), poop('bob', { votes: { alice: 1 } })));
  });
});

describe('comments', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'users/carol'), { name: 'Carol', admin: false, active: true });
      await setDoc(doc(d, 'keys/carolkey'), { userId: 'carol' });
      await setDoc(doc(d, 'poops/a1/comments/c1'), { userId: 'bob', text: 'nice', createdAt: Timestamp.now() });
      await updateDoc(doc(d, 'poops/a1'), { commentCount: 1 });
    });
    await link('dev1', 'bobkey', 'bob');
    await link('dev2', 'alicekey', 'alice');
    await link('dev3', 'carolkey', 'carol');
  });
  const comment = (userId: string, extra: object = {}) => ({ userId, text: 'hi', createdAt: serverTimestamp(), ...extra });
  /** A comment write and a commentCount change, in one batch. */
  const withCount = (uid: string, write: (b: ReturnType<typeof writeBatch>, d: ReturnType<typeof db>) => void, count: number) => {
    const d = db(uid);
    const b = writeBatch(d);
    write(b, d);
    b.update(doc(d, 'poops/a1'), { commentCount: count });
    return b.commit();
  };

  it('can be read with a valid session only', async () => {
    await assertSucceeds(getDocs(collection(db('dev3'), 'poops/a1/comments')));
    await assertFails(getDocs(collection(db('nobody'), 'poops/a1/comments')));
  });
  it('can be added with the count going up by one', async () => {
    await assertSucceeds(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol')), 2));
  });
  it('rejects a comment without the count, for someone else, too long or with extra fields', async () => {
    await assertFails(setDoc(doc(db('dev3'), 'poops/a1/comments/c2'), comment('carol')));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol')), 3));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('bob')), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol', { text: 'x'.repeat(281) })), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol', { text: '' })), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol', { hack: 1 })), 2));
  });
  it('may list who it tags, as a short list', async () => {
    await assertSucceeds(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c2'), comment('carol', { mentions: ['bob'] })), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c3'), comment('carol', { mentions: 'bob' })), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c3'), comment('carol', { mentions: [] })), 2));
    await assertFails(withCount('dev3', (b, d) => b.set(doc(d, 'poops/a1/comments/c3'), comment('carol', { mentions: Array(11).fill('bob') })), 2));
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1/comments/c1'), { text: '@Carol', mentions: ['carol'], editedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1/comments/c1'), { text: 'nice', mentions: deleteField(), editedAt: serverTimestamp() }));
  });
  it('can be edited by its author only, text only', async () => {
    await assertSucceeds(updateDoc(doc(db('dev1'), 'poops/a1/comments/c1'), { text: 'nicer', editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('dev3'), 'poops/a1/comments/c1'), { text: 'mine now', editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1/comments/c1'), { userId: 'carol' }));
  });
  it('can be liked once by anyone but its author, and unliked', async () => {
    const c1 = (uid: string) => doc(db(uid), 'poops/a1/comments/c1');
    await assertFails(updateDoc(c1('dev1'), { likes: arrayUnion('bob') }));
    await assertFails(updateDoc(c1('dev3'), { likes: ['alice'] }));
    await assertFails(updateDoc(c1('dev3'), { likes: ['carol', 'carol'] }));
    await assertFails(updateDoc(c1('dev3'), { likes: arrayUnion('carol'), text: 'mine now' }));
    await assertSucceeds(updateDoc(c1('dev3'), { likes: arrayUnion('carol') }));
    await assertSucceeds(updateDoc(c1('dev2'), { likes: arrayUnion('alice') }));
    await assertFails(updateDoc(c1('dev3'), { likes: ['carol'] }));
    await assertSucceeds(updateDoc(c1('dev3'), { likes: arrayRemove('carol') }));
    await assertFails(updateDoc(c1('dev3'), { likes: [] }));
    // The author's edits leave them alone.
    await assertFails(updateDoc(c1('dev1'), { text: 'nicer', likes: [], editedAt: serverTimestamp() }));
  });
  it('can be deleted by its author with the count going down', async () => {
    await assertFails(deleteDoc(doc(db('dev1'), 'poops/a1/comments/c1')));
    await assertFails(withCount('dev3', (b, d) => b.delete(doc(d, 'poops/a1/comments/c1')), 0));
    await assertSucceeds(withCount('dev1', (b, d) => b.delete(doc(d, 'poops/a1/comments/c1')), 0));
  });
  it('can be deleted by an admin', async () => {
    await assertSucceeds(deleteDoc(doc(db('dev2'), 'poops/a1/comments/c1')));
  });
  it('go with their entry when its owner deletes it, not before', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'poops/b9'), { ...poop('bob'), createdAt: Timestamp.now(), commentCount: 1 });
      await setDoc(doc(ctx.firestore(), 'poops/b9/comments/c9'), { userId: 'carol', text: 'hey', createdAt: Timestamp.now() });
    });
    const d = db('dev1');
    await assertFails(deleteDoc(doc(d, 'poops/b9/comments/c9')));
    const b = writeBatch(d);
    b.delete(doc(d, 'poops/b9/comments/c9'));
    b.delete(doc(d, 'poops/b9'));
    await assertSucceeds(b.commit());
  });
  it('can be listed across entries with a valid session only', async () => {
    const byBob = (uid: string) => query(collectionGroup(db(uid), 'comments'), where('userId', '==', 'bob'));
    await assertSucceeds(getDocs(byBob('dev2')));
    await assertSucceeds(getDocs(query(collectionGroup(db('dev3'), 'comments'), where('mentions', 'array-contains', 'carol'))));
    await assertFails(getDocs(byBob('nobody')));
  });
  it('can be a voice message, with or without text, its audio written alongside', async () => {
    const audio = (v: number, n = 1000) => ({ audio: Bytes.fromUint8Array(new Uint8Array(n)), type: 'audio/webm;codecs=opus', v });
    const voice = (id: string, extra: object, rec: object | null, count = 2) =>
      withCount('dev3', (b, d) => {
        b.set(doc(d, `poops/a1/comments/${id}`), comment('carol', extra));
        if (rec) b.set(doc(d, `poops/a1/commentSounds/${id}`), rec);
      }, count);
    await assertSucceeds(voice('v1', { text: '', sound: { v: 5, secs: 15 } }, audio(5)));
    await assertSucceeds(voice('v2', { text: '@Bob', mentions: ['bob'], sound: { v: 6, secs: 3 } }, audio(6), 3));
    await assertSucceeds(getDoc(doc(db('dev1'), 'poops/a1/commentSounds/v1')));
    await assertFails(voice('v3', { text: '', sound: { v: 7, secs: 16 } }, audio(7), 4));
    await assertFails(voice('v3', { text: '', sound: { v: 7, secs: 3 } }, audio(7, 250_001), 4));
    await assertFails(voice('v3', { text: '', sound: { v: 7, secs: 3 } }, audio(8), 4));
    await assertFails(voice('v3', { text: '', sound: { v: 7, secs: 3 } }, null, 4));
    await assertFails(voice('v3', { text: 'hi' }, audio(7), 4));
    await assertFails(setDoc(doc(db('dev3'), 'poops/a1/commentSounds/v3'), audio(7)));
    // Never replaced, and the voice stays when the text changes.
    await assertFails(setDoc(doc(db('dev3'), 'poops/a1/commentSounds/v1'), audio(5)));
    await assertSucceeds(updateDoc(doc(db('dev3'), 'poops/a1/comments/v2'), { text: '', mentions: deleteField(), editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('dev3'), 'poops/a1/comments/v2'), { sound: { v: 9, secs: 2 }, editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db('dev1'), 'poops/a1/comments/c1'), { text: '', editedAt: serverTimestamp() }));
    // The audio goes with its comment, by its author only.
    await assertFails(deleteDoc(doc(db('dev3'), 'poops/a1/commentSounds/v1')));
    await assertFails(withCount('dev1', (b, d) => {
      b.delete(doc(d, 'poops/a1/comments/v1'));
      b.delete(doc(d, 'poops/a1/commentSounds/v1'));
    }, 2));
    await assertSucceeds(withCount('dev3', (b, d) => {
      b.delete(doc(d, 'poops/a1/comments/v1'));
      b.delete(doc(d, 'poops/a1/commentSounds/v1'));
    }, 2));
  });
  it('the count cannot be faked', async () => {
    await assertFails(updateDoc(doc(db('dev3'), 'poops/a1'), { commentCount: 3 }));
    await assertFails(updateDoc(doc(db('dev3'), 'poops/a1'), { commentCount: -1 }));
    await assertFails(updateDoc(doc(db('dev2'), 'poops/a1'), { commentCount: 5, size: 'S' }));
    await assertFails(setDoc(doc(db('dev1'), 'poops/bx'), poop('bob', { commentCount: 2 })));
  });
});

describe('reports', () => {
  beforeEach(async () => {
    await link('dev1', 'bobkey', 'bob');
    await link('dev2', 'alicekey', 'alice');
  });
  const day = 86_400_000;
  const report = (createdBy: string, extra: object = {}) => ({
    kind: 'week',
    start: Timestamp.fromMillis(Date.now() - 9 * day),
    end: Timestamp.fromMillis(Date.now() - 2 * day),
    count: 3,
    winners: { points: { userIds: ['bob'], value: 12 } },
    createdBy,
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('can be written once by anyone, then never changed', async () => {
    await assertSucceeds(setDoc(doc(db('dev1'), 'reports/week-2026-10-12'), report('bob')));
    await assertSucceeds(getDoc(doc(db('dev2'), 'reports/week-2026-10-12')));
    await assertFails(setDoc(doc(db('dev2'), 'reports/week-2026-10-12'), report('alice')));
    await assertFails(updateDoc(doc(db('dev1'), 'reports/week-2026-10-12'), { count: 9 }));
    await assertFails(deleteDoc(doc(db('dev1'), 'reports/week-2026-10-12')));
  });
  it('rejects a period not over, a bad id, someone else as author or extra fields', async () => {
    await assertFails(setDoc(doc(db('dev1'), 'reports/week-2026-10-12'), report('bob', { end: Timestamp.fromMillis(Date.now() + day) })));
    await assertFails(setDoc(doc(db('dev1'), 'reports/month-2026-10'), report('bob')));
    await assertFails(setDoc(doc(db('dev1'), 'reports/whatever'), report('bob')));
    await assertFails(setDoc(doc(db('dev1'), 'reports/week-2026-10-12'), report('alice')));
    await assertFails(setDoc(doc(db('dev1'), 'reports/week-2026-10-12'), report('bob', { extra: 1 })));
  });
  it('needs a valid session, and an admin can delete one', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('nobody').firestore(), 'reports/week-2026-10-12'), report('bob')));
    await assertSucceeds(setDoc(doc(db('dev1'), 'reports/week-2026-10-12'), report('bob')));
    await assertSucceeds(deleteDoc(doc(db('dev2'), 'reports/week-2026-10-12')));
  });
});
