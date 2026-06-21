"use client";

import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { ChatMessage } from "@/lib/types";

export function useChat(code: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setMessages([]);
      return;
    }

    const ref = collection(db, "unoRooms", code.toUpperCase(), "chat");
    const chatQuery = query(ref, orderBy("createdAt", "desc"), limit(40));
    const unsubscribe = onSnapshot(
      chatQuery,
      (snapshot) => {
        setMessages(
          snapshot.docs
            .map((item) => ({ id: item.id, ...(item.data() as Omit<ChatMessage, "id">) }))
            .reverse(),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );

    return unsubscribe;
  }, [code]);

  return { messages, error };
}
