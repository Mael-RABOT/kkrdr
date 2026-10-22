# Run your own kkrdr for your friends

This guide takes you from zero (no accounts, no coding) to a kkrdr app your whole group can install on their phones. It takes about **30–45 minutes** and costs **nothing**.

Everything is done in your web browser, on a computer (a phone screen is too small for this part). You never install anything on your machine.

> 🇫🇷 Version française : [deploy-guide.fr.md](deploy-guide.fr.md)

## What you'll set up

| Piece | What it does | Cost |
| --- | --- | --- |
| **GitHub** | Stores your copy of the app's code and gives you a terminal in the browser (Codespaces) | Free |
| **Firebase** (Google) | Hosts the app at `https://<your-name>.web.app` and stores the group's data | Free ("Spark" plan, no credit card) |

You will be the **admin**: you create the group, then invite friends with a link.

---

## Step 1: Create a GitHub account

1. Go to <https://github.com/signup>.
2. Enter your email, a password and a username, then follow the steps (email code, small puzzle).
3. Choose the **Free** plan if asked.

✅ You're done when you see your GitHub home page, signed in.

## Step 2: Make your own copy of kkrdr (a "fork")

1. Go to <https://github.com/Mael-RABOT/kkrdr>.
2. Click **Fork** (top right), then **Create fork**.

✅ You're done when the page title shows **`<your-username>/kkrdr`**. This copy is yours.

## Step 3: Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account (create one if needed).
2. Click **Create a project** (or **Add project**).
3. Name it, for example `kkrdr-myfriends`. Under the name you'll see a **project ID** such as `kkrdr-myfriends` or `kkrdr-myfriends-1a2b3`. **Write it down.** Your app's address will be `https://<project-id>.web.app`.
4. Google Analytics: **turn it off** (not needed), then **Create project**, then **Continue**.

✅ You're done when you see the project's overview page.

## Step 4: Register the web app and copy its settings

1. On the project overview, click the **`</>`** (Web) icon, under "Get started by adding Firebase to your app". If you don't see it: ⚙️ **Project settings** → **General** → **Your apps** → **Add app** → **Web**.
2. App nickname: `kkrdr`. **Don't** tick "Firebase Hosting" (the tool will handle it). Click **Register app**.
3. You'll see a block of code containing `const firebaseConfig = { ... }`. **Keep this tab open**: you'll copy six values from it in step 8:

   ```js
   apiKey: "AIza...",
   authDomain: "kkrdr-myfriends.firebaseapp.com",
   projectId: "kkrdr-myfriends",
   storageBucket: "kkrdr-myfriends.firebasestorage.app",
   messagingSenderId: "1234567890",
   appId: "1:1234567890:web:abc123..."
   ```

   These values are not secret: they end up in the app anyway. The database is protected by security rules.
4. Click **Continue to console**.

You can find these values again any time in ⚙️ **Project settings** → **General** → **Your apps**.

## Step 5: Create the database

1. In the left menu: **Build** → **Firestore Database** → **Create database**.
2. If asked for an edition, keep **Standard**.
3. **Location**: pick one close to your group (for example `eur3 (europe-west)` for Europe). This can't be changed later.
4. **Security rules**: choose **Start in production mode** (the real rules are installed in step 11). Click **Create**.

✅ You're done when you see an empty database ("Start collection").

## Step 6: Turn on anonymous sign-in

Nobody types a password in kkrdr. Each phone gets an invisible anonymous account, linked to a person by their invite key.

1. In the left menu: **Build** → **Authentication** → **Get started**.
2. In the **Sign-in method** tab, click **Anonymous**, switch it **on**, then **Save**.

✅ "Anonymous" shows **Enabled**.

## Step 7: Open your terminal in the browser (Codespace)

1. Go back to **your** fork on GitHub (`https://github.com/<your-username>/kkrdr`).
2. Click the green **Code** button → **Codespaces** tab → **Create codespace on master**.
3. Wait 1–3 minutes. A code editor (VS Code) opens in your browser. At the bottom there's a **terminal** panel. Wait until it stops scrolling (it's installing the app's tools by itself).

If there's no terminal at the bottom, open one with the menu ☰ → **Terminal** → **New Terminal**.

In the following steps, **"run"** means: click in the terminal, paste the command (Ctrl+V, or Cmd+V on Mac, or right-click → Paste), then press **Enter**.

> 💡 Codespaces are free for 60 hours a month on a personal account, far more than you need. They stop on their own after 30 minutes of inactivity.

## Step 8: Put your Firebase settings into the app

1. Run:

   ```sh
   cp .env.example .env.local && code .env.local
   ```

   A file named `.env.local` opens in the editor.
2. Fill in the lines with the values from step 4 (no quotes, no spaces):

   ```ini
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=kkrdr-myfriends.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=kkrdr-myfriends
   VITE_FIREBASE_STORAGE_BUCKET=kkrdr-myfriends.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123...
   VITE_USE_EMULATORS=false
   ```

3. Save with **Ctrl+S** (Cmd+S on Mac).

This file stays private in your Codespace: it's never uploaded to GitHub.

## Step 9: Connect the terminal to your Google account

1. Run:

   ```sh
   npx firebase login --no-localhost
   ```

2. If it asks "Allow Firebase to collect CLI usage information?", type `n` and press Enter.
3. It shows a long link. **Ctrl+click** it (Cmd+click on Mac), or copy it into a new tab.
4. Sign in with the **same Google account** as in step 3 and allow access. Follow the pages until you get an **authorization code**. Copy it.
5. Paste the code into the terminal and press Enter.

✅ You see `Success! Logged in as you@gmail.com`.

## Step 10: Pick your project

1. Run:

   ```sh
   npx firebase use --add
   ```

2. Use the **arrow keys** to select your project (the ID from step 3) and press Enter.
3. For the alias, type `default` and press Enter.

✅ You see `Now using alias default (kkrdr-myfriends)`.

## Step 11: Put the app online

Run:

```sh
npm run deploy
```

This builds the app, installs the database security rules and publishes the website. It takes about a minute.

✅ The end of the output shows `Deploy complete!` and a **Hosting URL**: `https://<project-id>.web.app`.

## Step 12: Create your admin account

Run:

```sh
npm run create-admin
```

1. **Username**: your name as friends will see it (for example `Alex`).
2. **Key**: just press Enter and a secure one is generated.

It prints something like:

```
Created admin "Alex"
Key: k7m2...
Online: https://kkrdr-myfriends.web.app/?key=k7m2...
```

**Copy the `Online:` link and keep it safe.** It's your personal login link. Anyone with it can use the app as you.

This command only works once. After that, everyone is added from inside the app.

## Step 13: Install the app and invite your friends

1. On your phone, open the `Online:` link from step 12. You're in.
2. Install it like an app:
   - **iPhone (Safari)**: **Share** button → **Add to Home Screen**.
   - **Android (Chrome)**: menu ⋮ → **Install app** (or **Add to Home screen**).
3. To add a friend, open the **Admin** tab, type their name, then tap **Add**. Tap **Copy** and send them the link (WhatsApp, SMS…). They open it and they're in, with nothing to type.
4. In the Admin tab you can also show someone's link again, generate a new one (the old one stops working), revoke access, or make someone else admin.

🎉 That's it! You can close the Codespace tab.

---

## Updating to a newer version later

1. On your fork's GitHub page, click **Sync fork** → **Update branch**.
2. Open your Codespace again: on GitHub, **Code** → **Codespaces**, then click its name. Your `.env.local` and your login are still there. (If the Codespace was deleted, redo steps 7–10.)
3. In the terminal, run:

   ```sh
   git pull && npm ci && npm run deploy
   ```

Everyone's app shows **"A new version is available"** with a **Reload** button.

## Good to know

- **Cost**: the free Spark plan includes 50,000 database reads and 20,000 writes per day, 1 GB of storage and 10 GB of monthly hosting traffic. A group of friends stays far below that. Without a card on file, Google can't charge you: at worst the app pauses until the next day.
- **Offline**: once opened with a connection, the app works offline. New entries show **"Waiting to sync"** and are sent as soon as the phone is back online.
- **Stuck on loading?** After 8 seconds the app offers **Retry** and **Reset local data**. Reset clears the copy stored on the phone (it stays linked to the person); only entries not synced yet are lost.
- **Your data** lives in your own Firebase project. You can see it under **Firestore Database** in the Firebase console.
- **Deleting everything**: Firebase console → ⚙️ **Project settings** → **Delete project**. On GitHub: your fork → **Settings** → **Delete this repository**.

## Troubleshooting

| You see | Do this |
| --- | --- |
| `command not found` or `npm: not found` | You're not in the Codespace terminal. See step 7. |
| `Failed to authenticate` / `not logged in` | Redo step 9. |
| `No project active` | Redo step 10. |
| `VITE_FIREBASE_API_KEY missing from .env` | `.env.local` isn't filled in or saved. See step 8. |
| `PERMISSION_DENIED` during `create-admin` | The rules aren't installed. Run `npm run deploy` first (step 11). |
| `configuration-not-found` | Anonymous sign-in is off. See step 6. |
| `An admin was already created` | `create-admin` already ran. Use your link from step 12. If you lost it, in the Firebase console open **Firestore Database** → `config` → `setup` to find the `key`, then open `https://<project-id>.web.app/?key=<key>`. |
| The site says "Could not reach the database" | Check the values in `.env.local` (step 8), then run `npm run deploy` again. |
| "Unknown key" | The link was regenerated or revoked. Ask an admin for a new one. |
