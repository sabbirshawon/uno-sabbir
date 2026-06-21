"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { UnoCard, UnoHand } from "@/lib/types";

export function useHand(code: string | null, uid: string | null, enabled: boolean) {
  const [cards, setCards] = useState<UnoCard[]>([]);
  const [loading, setLoading] = useState(Boolean(code && uid && enabled));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !uid || !enabled) {
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "unoRooms", code.toUpperCase(), "hands", uid);
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = snapshot.data() as UnoHand | undefined;
        setCards(Array.isArray(data?.cards) ? data.cards : []);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [code, enabled, uid]);

  return { cards, loading, error };
}
