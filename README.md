# kkrdr

A small mobile-first web app to log poops with friends: a shared feed, a leaderboard with stats, and an admin view to hand out access keys. React + Vite + TypeScript on Firebase (Firestore, Anonymous Auth, Hosting). Runs on the free Spark plan.

## How access works

There is no sign-in. Each person gets a personal key (or an invite link containing it) from an admin.

- On first load the app signs the device in anonymously (invisible to the user).
- Entering a key links the device to that person by writing `sessions/{uid}`.
- Security rules allow access only while the key still exists and the person is active. Revoking a key, generating a new one, or deactivating someone cuts off all of that person's devices.

Firestore collections: `users`, `keys` (doc id = the secret key), `sessions`, `poops`. See `firestore.rules`.

## Firebase setup (once)

1. Go to https://console.firebase.google.com, create a project, then add a **Web app**. Copy its config into `.env.local` (start from `.env.example`).
2. **Build → Firestore Database → Create database** (production mode, pick a region near you).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
4. Link this folder to the project and deploy the rules:
   ```sh
   npx firebase login
   npx firebase use --add          # pick the project
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```
5. Create the first admin: `npm run create-admin`. It uses the config from `.env`, asks for a username and a key (leave it empty to generate one), and prints your invite link. It only works once (until `config/setup` exists), so run it right after deploying the rules. Everyone else is added from the Admin tab.
6. Deploy the app:
   ```sh
   npm run build
   npx firebase deploy --only hosting
   ```

## Local development

Against the emulators (no Firebase project needed, needs Java):

```sh
npm run emulators      # terminal 1
npm run seed           # terminal 2: users Admin/Sam/Lou with keys adminkey/samkey/loukey + sample data
npm run dev:emu        # then open http://localhost:5173/welcome?key=adminkey
```

Against the real project: put the config in `.env.local` and run `npm run dev`.

## Tests

```sh
npm test               # stats calculations (Vitest)
npm run test:rules     # Firestore security rules, runs in the emulator
```
