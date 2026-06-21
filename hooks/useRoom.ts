"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { UnoRoom } from "@/lib/types";

export function useRoom(code: string | null) {
  const [room, setRoom] = useState<UnoRoom | null>(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "unoRooms", code.toUpperCase());
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setRoom(null);
          setError("Room not found");
        } else {
          setRoom(snapshot.data() as UnoRoom);
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [code]);

  return { room, loading, error };
}
