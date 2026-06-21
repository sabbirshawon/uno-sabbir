"use client";

import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, googleProvider } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithRedirect: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function initAuth() {
      try {
        await setPersistence(auth, browserLocalPersistence);

        const redirectResult = await getRedirectResult(auth);

        if (redirectResult?.user) {
          console.log("Redirect login success:", redirectResult.user.email);
          setUser(redirectResult.user);
        }
      } catch (error) {
        console.error("Redirect result error:", error);
      } finally {
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          console.log("Auth state changed:", currentUser?.email || "No user");
          setUser(currentUser);
          setLoading(false);
          setIsSigningIn(false);
        });
      }
    }

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);

      googleProvider.setCustomParameters({
        prompt: "select_account",
      });

      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };

      console.error("Google popup login error:", firebaseError);

      if (
        firebaseError.code === "auth/popup-blocked" ||
        firebaseError.code === "auth/popup-closed-by-user" ||
        firebaseError.code === "auth/cancelled-popup-request"
      ) {
        setIsSigningIn(false);
        return;
      }

      alert(firebaseError.message || "Google login failed. Please try again.");
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  const loginWithRedirect = useCallback(async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);

      googleProvider.setCustomParameters({
        prompt: "select_account",
      });

      await setPersistence(auth, browserLocalPersistence);
      await signInWithRedirect(auth, googleProvider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };

      console.error("Google redirect login error:", firebaseError);
      alert(firebaseError.message || "Google redirect login failed.");
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isSigningIn,
      loginWithGoogle,
      loginWithRedirect,
      logout,
    }),
    [user, loading, isSigningIn, loginWithGoogle, loginWithRedirect, logout],
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