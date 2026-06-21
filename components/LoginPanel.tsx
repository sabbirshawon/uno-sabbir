"use client";

import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function LoginPanel() {
  const { loginWithGoogle, loading, isSigningIn } = useAuth();

  return (
    <section className="auth-card glass-card">
      <p className="eyebrow">Next.js + Firebase</p>
      <h1>Play UNO online with friends.</h1>
      <p className="muted">
        Sign in with Google, create a room, share the room code, and play real-time multiplayer UNO.
      </p>

      <button
        type="button"
        className="primary-button"
        onClick={loginWithGoogle}
        disabled={loading || isSigningIn}
      >
        <LogIn size={18} />
        {isSigningIn ? "Signing in..." : "Continue with Google"}
      </button>
    </section>
  );
}
