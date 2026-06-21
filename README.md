# UNO Online — Next.js + Firebase

A clean multiplayer UNO MVP built with:

- Next.js App Router
- Firebase Authentication with Google login
- Cloud Firestore real-time room sync
- TypeScript
- Fully client-side game actions using Firestore transactions

## Features

- Google login
- Create private UNO room
- Join room by code
- 2–4 players
- Real-time room updates
- UNO deck generation and shuffling
- Turn system
- Reverse, Skip, Draw Two, Wild, Wild Draw Four
- Draw and pass turn
- Call UNO
- Winner state
- Responsive glassmorphism UI

## Important MVP note

This starter keeps all player hands and game state inside one Firestore room document. That makes it easy to run and understand, but it is not cheat-proof because a technical player could inspect client data or modify requests.

For production, move game validation into one of these:

1. Firebase Cloud Functions using Firebase Admin SDK
2. Next.js Route Handlers / Server Actions with Firebase Admin SDK
3. A dedicated game server with WebSockets

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Firebase project

Create a Firebase project from Firebase Console.

Enable:

- Authentication → Sign-in method → Google
- Firestore Database

### 3. Add Firebase web config

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Firebase web app config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 4. Add authorized domain

In Firebase Console:

Authentication → Settings → Authorized domains

Add:

```txt
localhost
```

For deployment, add your production domain too.

### 5. Deploy Firestore rules

Install Firebase CLI if needed:

```bash
npm install -g firebase-tools
firebase login
firebase use your_project_id
firebase deploy --only firestore:rules
```

Or paste `firestore.rules` manually in Firebase Console.

### 6. Run locally

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## How to play-test

1. Open the app in Chrome.
2. Login with Google.
3. Create a room.
4. Copy the room code.
5. Open another browser/profile/device.
6. Login with another Google account.
7. Join the room using the code.
8. Host clicks Start Game.

## Project structure

```txt
app/
  globals.css
  layout.tsx
  page.tsx
components/
  GameRoom.tsx
  Lobby.tsx
  LoginPanel.tsx
  UnoCardView.tsx
hooks/
  useAuth.tsx
  useRoom.ts
lib/
  firebase.ts
  gameActions.ts
  types.ts
  uno.ts
firestore.rules
firebase.json
```

## Next production improvements

- Store each player's hand in private subcollections.
- Validate all moves server-side.
- Add reconnect handling.
- Add rematch button.
- Add spectator mode.
- Add chat and emoji reactions.
- Add room expiration cleanup.
- Add sound effects.
- Add mobile-first card drag-and-drop.
