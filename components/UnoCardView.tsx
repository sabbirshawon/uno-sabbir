"use client";

import type { UnoCard } from "@/lib/types";
import {
  cardLabel,
  colorClass,
  isActionCard,
  isPowerCard,
  powerCardDescription,
} from "@/lib/uno";

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
  const label = cardLabel(card);
  const isAction = isActionCard(card);
  const isPower = isPowerCard(card);

  return (
    <button
      type="button"
      className={`uno-card ${colorClass(card.color)} ${playable ? "playable" : ""} ${
        selected ? "selected" : ""
      } ${small ? "small" : ""} ${isAction ? "action-card" : ""} ${
        isPower ? "power-card" : ""
      }`}
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
      title={isPower ? powerCardDescription(card) : `${card.color} ${card.value}`}
    >
      <b className="corner top-left">{label}</b>

      <span className="card-center">
        <i>{label}</i>
      </span>

      <b className="corner bottom-right">{label}</b>

      <em>{isPower ? "power" : card.color === "wild" ? "wild" : card.color}</em>
    </button>
  );
}