"use client";

import { useCallback, useRef, useState } from "react";

type SoundName = "play" | "draw" | "error" | "win" | "chat";

const FREQUENCIES: Record<SoundName, number> = {
  play: 520,
  draw: 360,
  error: 180,
  win: 760,
  chat: 620,
};

export function useSound() {
  const [enabled, setEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled || typeof window === "undefined") return;

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = FREQUENCIES[name];
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    },
    [enabled],
  );

  return { soundEnabled: enabled, setSoundEnabled: setEnabled, playSound: play };
}
