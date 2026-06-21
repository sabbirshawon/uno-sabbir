"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { presenceApi } from "@/lib/clientApi";

export function usePresence(code: string | null, user: User | null) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!code || !user) return;

    let cancelled = false;

    async function ping(status: boolean) {
      try {
        if (!cancelled && user && code) await presenceApi(user, code, status);
      } catch {
        // presence should never block gameplay
      }
    }

    ping(online);
    const interval = window.setInterval(() => ping(navigator.onLine), 15000);

    return () => {
      window.clearInterval(interval);
      if (user && code) presenceApi(user, code, false).catch(() => undefined);
      cancelled = true;
    };
  }, [code, online, user]);

  return { online };
}
