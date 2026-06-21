# UNO Online Pro — Next.js + Firebase

A multiplayer UNO starter built with:

- Next.js App Router
- Firebase Authentication with Google login
- Cloud Firestore real-time room updates
- Firebase Admin SDK inside Next.js API routes
- Server-side move validation
- Private player hands in Firestore subcollections
- Spectator mode, chat, emoji reactions, rematch, reconnect presence, sound effects, and mobile-first drag/drop cards

## What changed in this version

This version is no longer a purely client-side MVP. Game moves go through Next.js API routes, where the Firebase Admin SDK verifies the user's Firebase ID token and validates the move before updating Firestore.

Private data is separated:

```txt
unoRooms/{roomCode}                  public room state
unoRooms/{roomCode}/hands/{uid}      private hand, readable only by that player
unoRooms/{roomCode}/private/state    private draw pile/discard history, server only
unoRooms/{roomCode}/chat/{messageId} room chat messages
```

## Features

- One Google login button
- Create room / join room
- Join active games as spectator
- 2–4 players
- Server-side validation for start, play, draw, pass, UNO, rematch, chat, and presence
- Each player's hand stored in a private subcollection
- Hidden draw pile stored in a server-only private document
- Real-time Firestore subscriptions for room, own hand, and chat
- Reconnect/online presence heartbeat
- Rematch button; rematch auto-starts when all players request it
- Chat and emoji reactions
- Room expiration cleanup API route
- Sound effects using Web Audio API
- Mobile-first card UI with click-to-play and drag/drop-to-discard

## Setup

### 1. Install

```bash
npm install
```

### 2. Firebase client env

Create `.env.local`:

```bash
cp .env.example .env.local
```

Add your Firebase Web App config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Firebase Admin env for server-side validation

Firebase Console:

**Project settings → Service accounts → Generate new private key**

Then add these to `.env.local` locally and Vercel Environment Variables:

```env
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
CRON_SECRET=change_this_random_string
```

On Vercel, paste the private key exactly, keeping `\n` line breaks. Do not commit `.env` or `.env.local` to GitHub.

### 4. Enable Firebase services

Firebase Console:

- Authentication → Sign-in method → Google → Enable
- Authentication → Settings → Authorized domains → add your Vercel domain, for example `uno-sabbir.vercel.app`
- Firestore Database → Create database

### 5. Publish Firestore rules

Paste `firestore.rules` in:

**Firestore Database → Rules → Publish**

Or use Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

### 6. Run locally

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Vercel deployment

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add all `NEXT_PUBLIC_FIREBASE_*` variables.
4. Add all `FIREBASE_ADMIN_*` variables.
5. Deploy.
6. Add the Vercel domain in Firebase Authentication authorized domains.
7. Publish Firestore rules.

## Room expiration cleanup

This project includes:

```txt
GET /api/cron/expire-rooms?secret=YOUR_CRON_SECRET
```

It marks expired rooms as `expired`. On Vercel, you can create a cron job to call this endpoint every hour.

## Production notes

This is much stronger than the first MVP because hands and hidden deck state are not readable by other players and moves are validated on the server. For a heavy production game, a dedicated WebSocket game server can still be better for ultra-low latency, timers, matchmaking, and advanced anti-cheat monitoring.
