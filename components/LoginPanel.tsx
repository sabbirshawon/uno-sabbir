"use client";

import { LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function LoginPanel() {
  const { loginWithGoogle, loginWithRedirect, loading, isSigningIn } = useAuth();

  return (
    <section className="auth-card glass-card">
      <p className="eyebrow">Next.js + Firebase</p>
      <h1>Play UNO Sabbir with friends.</h1>
      <p className="muted">
        Sign in with Google, create a room, share the room code, and play a
        real-time multiplayer UNO match.
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

      <button
        type="button"
        className="secondary-button"
        onClick={loginWithRedirect}
        disabled={loading || isSigningIn}
        style={{ marginTop: 12 }}
      >
        Try redirect login
      </button>
    </section>
  );
}