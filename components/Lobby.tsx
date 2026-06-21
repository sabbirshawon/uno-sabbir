"use client";

import { useState } from "react";
import { Copy, LogOut, Plus, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createRoom, joinRoom } from "@/lib/gameActions";

type LobbyProps = {
  onEnterRoom: (code: string) => void;
};

function getFirebaseErrorMessage(error: unknown) {
  const firebaseError = error as { code?: string; message?: string };

  if (firebaseError.code === "permission-denied") {
    return "Firestore permission denied. Please publish the Firestore rules.";
  }

  if (firebaseError.code === "unavailable") {
    return "Firestore unavailable. Check internet connection or Firebase status.";
  }

  if (firebaseError.code === "unauthenticated") {
    return "You are not authenticated. Please login again.";
  }

  return firebaseError.message || "Something went wrong. Please try again.";
}

export function Lobby({ onEnterRoom }: LobbyProps) {
  const { user, logout } = useAuth();
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!user) {
      setError("Please login first.");
      return;
    }

    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      console.log("Creating room for:", user.uid);

      const roomCode = await createRoom(user);

      console.log("Room created:", roomCode);

      setCreatedCode(roomCode);
      onEnterRoom(roomCode);
    } catch (err) {
      console.error("Create room error:", err);
      setError(getFirebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user) {
      setError("Please login first.");
      return;
    }

    if (busy) return;

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Room code is required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await joinRoom(normalizedCode, user);
      onEnterRoom(normalizedCode);
    } catch (err) {
      console.error("Join room error:", err);
      setError(getFirebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
  }

  return (
    <section className="lobby glass-card">
      <div className="topbar">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>UNO Sabbir</h1>
        </div>

        <button type="button" className="ghost-button" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="profile-chip">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Profile" />
        ) : (
          <span>{user?.displayName?.charAt(0) || "U"}</span>
        )}

        <div>
          <strong>{user?.displayName || "UNO Player"}</strong>
          <small>{user?.email}</small>
        </div>
      </div>

      <div className="lobby-grid">
        <div className="panel-card">
          <Users size={24} />
          <h2>Create a room</h2>
          <p className="muted">Start a private game and invite up to 3 friends.</p>

          <button
            type="button"
            className="primary-button"
            disabled={busy || !user}
            onClick={handleCreate}
          >
            <Plus size={18} />
            {busy ? "Creating..." : "Create room"}
          </button>

          {createdCode && (
            <button type="button" className="code-pill" onClick={copyCode}>
              {createdCode} <Copy size={14} />
            </button>
          )}
        </div>

        <div className="panel-card">
          <Users size={24} />
          <h2>Join a room</h2>
          <p className="muted">Enter the room code shared by your friend.</p>

          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={8}
          />

          <button
            type="button"
            className="secondary-button"
            disabled={busy || !code.trim()}
            onClick={handleJoin}
          >
            {busy ? "Please wait..." : "Join game"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}