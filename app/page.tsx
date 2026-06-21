"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GameRoom } from "@/components/GameRoom";
import { Lobby } from "@/components/Lobby";
import { LoginPanel } from "@/components/LoginPanel";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, loading } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setRoomCode(room.toUpperCase());
  }, []);

  function enterRoom(code: string) {
    const normalized = code.toUpperCase();
    setRoomCode(normalized);
    window.history.replaceState(null, "", `?room=${normalized}`);
  }

  function backToLobby() {
    setRoomCode(null);
    window.history.replaceState(null, "", "/");
  }

  if (loading) {
    return (
      <main className="page-shell">
        <section className="glass-card center-state">
          <Loader2 className="spin" /> Checking login...
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="bg-orb orb-one" />
      <div className="bg-orb orb-two" />

      {!user && <LoginPanel />}
      {user && !roomCode && <Lobby onEnterRoom={enterRoom} />}
      {user && roomCode && <GameRoom code={roomCode} onBack={backToLobby} />}
    </main>
  );
}
