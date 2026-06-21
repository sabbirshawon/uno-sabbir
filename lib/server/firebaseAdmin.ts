import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!key) return undefined;
  return key.replace(/\\n/g, "\n");
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in Vercel.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export async function getUserFromRequest(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new Response(JSON.stringify({ error: "Missing Firebase ID token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new Response(JSON.stringify({ error: "Invalid or expired Firebase ID token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}
