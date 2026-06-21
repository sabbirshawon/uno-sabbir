"use client";

import type { UnoCard } from "@/lib/types";
import { cardLabel, colorClass } from "@/lib/uno";

type UnoCardViewProps = {
  card: UnoCard;
  playable?: boolean;
  selected?: boolean;
  small?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: () => void;
};

export function UnoCardView({
  card,
  playable = false,
  selected = false,
  small = false,
  draggable = false,
  onClick,
  onDragStart,
}: UnoCardViewProps) {
  return (
    <button
      type="button"
      className={`uno-card ${colorClass(card.color)} ${playable ? "playable" : ""} ${selected ? "selected" : ""} ${small ? "small" : ""}`}
      onClick={onClick}
      disabled={!onClick && !draggable}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
        onDragStart?.();
      }}
      aria-label={`${card.color} ${card.value}`}
    >
      <span>{cardLabel(card)}</span>
      <em>{card.color === "wild" ? "choose" : card.color}</em>
    </button>
  );
}
