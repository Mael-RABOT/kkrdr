# Installer ton propre kkrdr pour tes potes

Ce guide te fait passer de zéro (aucun compte, aucune connaissance en code) à une appli kkrdr que tout ton groupe peut installer sur son téléphone. Compte **30 à 45 minutes**. Ça ne coûte **rien**.

Tout se fait dans ton navigateur, sur un ordinateur (l'écran d'un téléphone est trop petit pour cette partie). Tu n'installes rien sur ta machine.

> 🇬🇧 English version: [deploy-guide.en.md](deploy-guide.en.md)

## Ce que tu vas mettre en place

| Élément | À quoi ça sert | Prix |
| --- | --- | --- |
| **GitHub** | Garde ta copie du code de l'appli et te donne un terminal dans le navigateur (Codespaces) | Gratuit |
| **Firebase** (Google) | Héberge l'appli sur `https://<ton-nom>.web.app` et stocke les données du groupe | Gratuit (offre « Spark », sans carte bancaire) |

Tu seras l'**admin** : tu crées le groupe, puis tu invites tes potes avec un lien.

---

## Étape 1 : Créer un compte GitHub

1. Va sur <https://github.com/signup>.
2. Entre ton e-mail, un mot de passe et un nom d'utilisateur, puis suis les étapes (code reçu par e-mail, petit puzzle).
3. Choisis l'offre **Free** si on te le demande.

✅ C'est bon quand tu vois ta page d'accueil GitHub, connecté.

## Étape 2 : Faire ta propre copie de kkrdr (un « fork »)

1. Va sur <https://github.com/Mael-RABOT/kkrdr>.
2. Clique sur **Fork** (en haut à droite), puis sur **Create fork**.

✅ C'est bon quand le titre de la page affiche **`<ton-pseudo>/kkrdr`**. Cette copie est à toi.

## Étape 3 : Créer un projet Firebase

1. Va sur <https://console.firebase.google.com> et connecte-toi avec un compte Google (crée-en un si besoin).
2. Clique sur **Créer un projet** (ou **Ajouter un projet**).
3. Donne-lui un nom, par exemple `kkrdr-mespotes`. Sous le nom s'affiche un **ID de projet**, du genre `kkrdr-mespotes` ou `kkrdr-mespotes-1a2b3`. **Note-le.** L'adresse de ton appli sera `https://<id-du-projet>.web.app`.
4. Google Analytics : **désactive-le** (inutile ici), puis clique sur **Créer le projet**, puis sur **Continuer**.

✅ C'est bon quand tu vois la page d'accueil du projet.

## Étape 4 : Déclarer l'appli web et copier ses réglages

1. Sur l'accueil du projet, clique sur l'icône **`</>`** (Web), sous « Commencez en ajoutant Firebase à votre application ». Si tu ne la vois pas : ⚙️ **Paramètres du projet** → **Général** → **Vos applications** → **Ajouter une application** → **Web**.
2. Surnom de l'appli : `kkrdr`. **Ne coche pas** « Firebase Hosting » (l'outil s'en charge). Clique sur **Enregistrer l'application**.
3. Un bloc de code s'affiche, avec `const firebaseConfig = { ... }`. **Garde cet onglet ouvert** : tu vas y copier six valeurs à l'étape 8 :

   ```js
   apiKey: "AIza...",
   authDomain: "kkrdr-mespotes.firebaseapp.com",
   projectId: "kkrdr-mespotes",
   storageBucket: "kkrdr-mespotes.firebasestorage.app",
   messagingSenderId: "1234567890",
   appId: "1:1234567890:web:abc123..."
   ```

   Ces valeurs ne sont pas secrètes : elles se retrouvent de toute façon dans l'appli. La base de données est protégée par les règles de sécurité.
4. Clique sur **Accéder à la console**.

Tu peux retrouver ces valeurs quand tu veux dans ⚙️ **Paramètres du projet** → **Général** → **Vos applications**.

## Étape 5 : Créer la base de données

1. Dans le menu de gauche : **Créer** (Build) → **Firestore Database** → **Créer une base de données**.
2. Si on te demande une édition, garde **Standard**.
3. **Emplacement** : choisis-en un proche de ton groupe (par exemple `eur3 (europe-west)` pour l'Europe). Tu ne pourras pas le changer ensuite.
4. **Règles de sécurité** : choisis **Démarrer en mode production** (les vraies règles sont installées à l'étape 11). Clique sur **Créer**.

✅ C'est bon quand tu vois une base vide (« Commencer une collection »).

## Étape 6 : Activer la connexion anonyme

Personne ne tape de mot de passe dans kkrdr. Chaque téléphone reçoit un compte anonyme invisible, relié à une personne par sa clé d'invitation.

1. Dans le menu de gauche : **Créer** (Build) → **Authentication** → **Commencer**.
2. Dans l'onglet **Sign-in method** (Mode de connexion), clique sur **Anonyme**, active-le, puis clique sur **Enregistrer**.

✅ « Anonyme » affiche **Activé**.

## Étape 7 : Ouvrir ton terminal dans le navigateur (Codespace)

1. Retourne sur **ton** fork GitHub (`https://github.com/<ton-pseudo>/kkrdr`).
2. Clique sur le bouton vert **Code** → onglet **Codespaces** → **Create codespace on master**.
3. Patiente 1 à 3 minutes. Un éditeur de code (VS Code) s'ouvre dans ton navigateur. En bas, il y a un panneau **terminal**. Attends que ça arrête de défiler (il installe tout seul les outils de l'appli).

S'il n'y a pas de terminal en bas, ouvre-en un avec le menu ☰ → **Terminal** → **New Terminal**.

Dans les étapes suivantes, **« lance »** veut dire : clique dans le terminal, colle la commande (Ctrl+V, ou Cmd+V sur Mac, ou clic droit → Coller), puis appuie sur **Entrée**.

> 💡 Les Codespaces sont gratuits 60 heures par mois avec un compte perso, bien plus que nécessaire. Ils s'arrêtent tout seuls après 30 minutes d'inactivité.

## Étape 8 : Mettre tes réglages Firebase dans l'appli

1. Lance :

   ```sh
   cp .env.example .env.local && code .env.local
   ```

   Un fichier `.env.local` s'ouvre dans l'éditeur.
2. Complète les lignes avec les valeurs de l'étape 4 (sans guillemets, sans espaces) :

   ```ini
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=kkrdr-mespotes.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=kkrdr-mespotes
   VITE_FIREBASE_STORAGE_BUCKET=kkrdr-mespotes.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123...
   VITE_USE_EMULATORS=false
   ```

3. Enregistre avec **Ctrl+S** (Cmd+S sur Mac).

Ce fichier reste privé dans ton Codespace : il n'est jamais envoyé sur GitHub.

## Étape 9 : Relier le terminal à ton compte Google

1. Lance :

   ```sh
   npx firebase login --no-localhost
   ```

2. S'il demande « Allow Firebase to collect CLI usage information? », tape `n` puis Entrée.
3. Un long lien s'affiche. Fais **Ctrl+clic** dessus (Cmd+clic sur Mac), ou copie-le dans un nouvel onglet.
4. Connecte-toi avec le **même compte Google** qu'à l'étape 3 et autorise l'accès. Suis les pages jusqu'à obtenir un **code d'autorisation**. Copie-le.
5. Colle le code dans le terminal et appuie sur Entrée.

✅ Tu vois `Success! Logged in as toi@gmail.com`.

## Étape 10 : Choisir ton projet

1. Lance :

   ```sh
   npx firebase use --add
   ```

2. Avec les **flèches du clavier**, sélectionne ton projet (l'ID de l'étape 3) et appuie sur Entrée.
3. Pour l'alias, tape `default` puis Entrée.

✅ Tu vois `Now using alias default (kkrdr-mespotes)`.

## Étape 11 : Mettre l'appli en ligne

Lance :

```sh
npm run deploy
```

Ça construit l'appli, installe les règles de sécurité de la base et publie le site. Ça prend environ une minute.

✅ La fin du texte affiche `Deploy complete!` et une **Hosting URL** : `https://<id-du-projet>.web.app`.

## Étape 12 : Créer ton compte admin

Lance :

```sh
npm run create-admin
```

1. **Username** : ton prénom tel que tes potes le verront (par exemple `Alex`).
2. **Key** : appuie juste sur Entrée, une clé sûre est générée.

Ça affiche quelque chose comme :

```
Created admin "Alex"
Key: k7m2...
Online: https://kkrdr-mespotes.web.app/welcome?key=k7m2...
```

**Copie le lien `Online:` et garde-le précieusement.** C'est ton lien de connexion personnel : n'importe qui l'ayant peut utiliser l'appli en se faisant passer pour toi.

Cette commande ne marche qu'une fois. Ensuite, tout le monde s'ajoute depuis l'appli.

## Étape 13 : Installer l'appli et inviter tes potes

1. Sur ton téléphone, ouvre le lien `Online:` de l'étape 12. Te voilà connecté.
2. Installe-la comme une appli :
   - **iPhone (Safari)** : bouton **Partager** → **Sur l'écran d'accueil**.
   - **Android (Chrome)** : menu ⋮ → **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Pour ajouter un pote, ouvre l'onglet **Admin**, tape son prénom, puis appuie sur **Ajouter**. Appuie sur **Copier** et envoie-lui le lien (WhatsApp, SMS…). Il l'ouvre et il est dedans, sans rien taper.
4. L'onglet Admin permet aussi de réafficher le lien de quelqu'un, d'en générer un nouveau (l'ancien ne marche plus), de couper un accès ou de nommer un autre admin.

🎉 C'est fini ! Tu peux fermer l'onglet du Codespace.

---

## Mettre à jour plus tard

1. Sur la page GitHub de ton fork, clique sur **Sync fork** → **Update branch**.
2. Rouvre ton Codespace : sur GitHub, **Code** → **Codespaces**, puis clique sur son nom. Ton `.env.local` et ta connexion y sont toujours. (Si le Codespace a été supprimé, refais les étapes 7 à 10.)
3. Dans le terminal, lance :

   ```sh
   git pull && npm ci && npm run deploy
   ```

L'appli de chacun affiche **« Une nouvelle version est disponible »** avec un bouton **Recharger**.

## Bon à savoir

- **Prix** : l'offre gratuite Spark inclut 50 000 lectures et 20 000 écritures par jour en base, 1 Go de stockage et 10 Go de trafic d'hébergement par mois. Un groupe d'amis reste très loin de ces limites. Sans carte bancaire enregistrée, Google ne peut rien te facturer : au pire, l'appli se met en pause jusqu'au lendemain.
- **Hors ligne** : une fois ouverte avec du réseau, l'appli marche hors ligne. Les nouvelles entrées affichent **« En attente de synchro »** et partent dès que le téléphone retrouve du réseau.
- **Bloqué sur le chargement ?** Au bout de 8 secondes, l'appli propose **Réessayer** et **Réinitialiser les données locales**. La réinitialisation efface la copie stockée sur le téléphone (il reste lié à la personne) ; seules les entrées pas encore synchronisées sont perdues.
- **Tes données** sont dans ton propre projet Firebase. Tu peux les voir dans **Firestore Database** dans la console Firebase.
- **Tout supprimer** : console Firebase → ⚙️ **Paramètres du projet** → **Supprimer le projet**. Sur GitHub : ton fork → **Settings** → **Delete this repository**.

## En cas de problème

| Tu vois | Fais ceci |
| --- | --- |
| `command not found` ou `npm: not found` | Tu n'es pas dans le terminal du Codespace. Voir l'étape 7. |
| `Failed to authenticate` / `not logged in` | Refais l'étape 9. |
| `No project active` | Refais l'étape 10. |
| `VITE_FIREBASE_API_KEY missing from .env` | `.env.local` n'est pas rempli ou pas enregistré. Voir l'étape 8. |
| `PERMISSION_DENIED` pendant `create-admin` | Les règles ne sont pas installées. Lance d'abord `npm run deploy` (étape 11). |
| `configuration-not-found` | La connexion anonyme est désactivée. Voir l'étape 6. |
| `An admin was already created` | `create-admin` a déjà été lancé. Utilise ton lien de l'étape 12. Si tu l'as perdu, dans la console Firebase ouvre **Firestore Database** → `config` → `setup` pour retrouver la `key`, puis ouvre `https://<id-du-projet>.web.app/welcome?key=<key>`. |
| Le site dit « Impossible de joindre la base de données » | Vérifie les valeurs dans `.env.local` (étape 8), puis relance `npm run deploy`. |
| « Clé inconnue » | Le lien a été régénéré ou révoqué. Demande-en un nouveau à un admin. |
