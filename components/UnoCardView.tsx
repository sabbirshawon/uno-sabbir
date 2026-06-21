"use client";

import type { UnoCard } from "@/lib/types";
import { cardLabel, colorClass } from "@/lib/uno";

type UnoCardViewProps = {
  card: UnoCard;
  playable?: boolean;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
};

export function UnoCardView({ card, playable = false, selected = false, small = false, onClick }: UnoCardViewProps) {
  return (
    <button
      type="button"
      className={`uno-card ${colorClass(card.color)} ${playable ? "playable" : ""} ${selected ? "selected" : ""} ${small ? "small" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${card.color} ${card.value}`}
    >
      <span>{cardLabel(card)}</span>
      <em>{card.color === "wild" ? "choose" : card.color}</em>
    </button>
  );
}
