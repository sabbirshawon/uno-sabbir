"use client";

import { useState } from "react";
import { Copy, Eye, LogOut, Plus, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createRoomApi, joinRoomApi } from "@/lib/clientApi";

type LobbyProps = {
  onEnterRoom: (code: string) => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function Lobby({ onEnterRoom }: LobbyProps) {
  const { user, logout } = useAuth();
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createRoomApi(user);
      setCreatedCode(result.code);
      onEnterRoom(result.code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(mode: "player" | "spectator") {
    if (!user || busy) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Room code is required");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await joinRoomApi(user, normalized, mode);
      onEnterRoom(result.code);
    } catch (err) {
      setError(errorMessage(err));
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
          <h1>UNO Online</h1>
        </div>
        <button type="button" className="ghost-button" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="profile-chip">
        {user?.photoURL ? <img src={user.photoURL} alt="Profile" /> : <span>{user?.displayName?.charAt(0) || "U"}</span>}
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
          <button type="button" className="primary-button" disabled={busy || !user} onClick={handleCreate}>
            <Plus size={18} /> {busy ? "Please wait..." : "Create room"}
          </button>

          {createdCode && (
            <button type="button" className="code-pill" onClick={copyCode}>
              {createdCode} <Copy size={14} />
            </button>
          )}
        </div>

        <div className="panel-card">
          <Eye size={24} />
          <h2>Join a room</h2>
          <p className="muted">Join as a player before the match starts, or spectate any active room.</p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={8}
          />
          <div className="join-actions">
            <button type="button" className="secondary-button" disabled={busy || !code.trim()} onClick={() => handleJoin("player")}>
              Join game
            </button>
            <button type="button" className="ghost-button" disabled={busy || !code.trim()} onClick={() => handleJoin("spectator")}>
              Spectate
            </button>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
