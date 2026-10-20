// Creates the first admin account using the web config from .env.
// Works only once: the security rules allow this until config/setup exists,
// after that new people are added from the Admin tab in the app.
// Usage: npm run create-admin   (requires the current firestore.rules to be deployed)
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, terminate, writeBatch, collection } from 'firebase/firestore';

for (const f of ['.env', '.env.local']) if (existsSync(f)) process.loadEnvFile(f);
const env = process.env;

const rl = createInterface({ input: stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();

async function ask(prompt) {
  stdout.write(prompt);
  const { value } = await lines.next();
  return (value ?? '').trim();
}

function newKey() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(randomBytes(20), (b) => alphabet[b % alphabet.length]).join('');
}

async function main() {
  const emulators = env.VITE_USE_EMULATORS === 'true';
  const projectId = emulators ? 'demo-kkrdr' : env.VITE_FIREBASE_PROJECT_ID;
  if (!emulators && !env.VITE_FIREBASE_API_KEY) throw new Error('VITE_FIREBASE_API_KEY missing from .env');

  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY || 'demo-key',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (emulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  console.log(`Project: ${projectId}${emulators ? ' (emulators)' : ''}`);

  try {
    await signInAnonymously(auth);
    if ((await getDoc(doc(db, 'config/setup'))).exists()) {
      throw new Error('An admin was already created with this script. Add people from the Admin tab instead.');
    }

    const name = await ask('Username: ');
    if (!name || name.length > 30) throw new Error('Username must be 1 to 30 characters');

    const key = (await ask('Key (leave empty to generate one): ')) || newKey();
    if (!/^[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error('Key must be at least 8 characters: letters, digits, - or _');

    const userRef = doc(collection(db, 'users'));
    const batch = writeBatch(db);
    batch.set(userRef, { name, admin: true, active: true, createdAt: serverTimestamp() });
    batch.set(doc(db, 'keys', key), { userId: userRef.id, createdAt: serverTimestamp() });
    batch.set(doc(db, 'config/setup'), { userId: userRef.id, key, createdAt: serverTimestamp() });
    await batch.commit();

    console.log(`\nCreated admin "${name}"`);
    console.log(`Key: ${key}`);
    console.log(`Local:  http://localhost:5173/welcome?key=${key}`);
    console.log(`Online: https://${projectId}.web.app/welcome?key=${key}  (after deploying hosting)`);
  } finally {
    await terminate(db);
  }
}

main()
  .catch((e) => {
    const msg = String(e.message ?? e);
    console.error(`Error: ${msg}`);
    if (/permission/i.test(msg)) console.error('Did you deploy the rules?  npx firebase deploy --only firestore:rules');
    if (/configuration-not-found/.test(msg)) console.error('Enable Authentication > Sign-in method > Anonymous in the console.');
    process.exitCode = 1;
  })
  .finally(() => rl.close());
