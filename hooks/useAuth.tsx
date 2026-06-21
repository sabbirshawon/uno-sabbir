"use client";

import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    setPersistence(auth, browserLocalPersistence)
      .catch((error) => console.error("Auth persistence error:", error))
      .finally(() => {
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
          setIsSigningIn(false);
        });
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);
      googleProvider.setCustomParameters({ prompt: "select_account" });
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      setIsSigningIn(false);

      if (
        firebaseError.code === "auth/cancelled-popup-request" ||
        firebaseError.code === "auth/popup-closed-by-user"
      ) {
        return;
      }

      console.error("Google login error:", error);
      alert(firebaseError.message || "Google login failed. Please try again.");
    }
  }, [isSigningIn]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isSigningIn, loginWithGoogle, logout }),
    [user, loading, isSigningIn, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
