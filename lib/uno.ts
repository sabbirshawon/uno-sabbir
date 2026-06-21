import type { PlayColor, UnoCard, UnoColor, UnoRoom, UnoValue } from "./types";

const COLORS: PlayColor[] = ["red", "yellow", "green", "blue"];
const NUMBER_VALUES: UnoValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTION_VALUES: UnoValue[] = ["skip", "reverse", "draw2"];

export const PLAY_COLORS = COLORS;

export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];

  for (const color of COLORS) {
    deck.push({ id: `${color}-0`, color, value: "0" });

    for (const value of NUMBER_VALUES.slice(1)) {
      deck.push({ id: `${color}-${value}-a`, color, value });
      deck.push({ id: `${color}-${value}-b`, color, value });
    }

    for (const value of ACTION_VALUES) {
      deck.push({ id: `${color}-${value}-a`, color, value });
      deck.push({ id: `${color}-${value}-b`, color, value });
    }
  }

  for (let i = 1; i <= 4; i++) {
    deck.push({ id: `wild-${i}`, color: "wild", value: "wild" });
    deck.push({ id: `wild4-${i}`, color: "wild", value: "wild4" });
  }

  return deck;
}

export function shuffleCards<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cardLabel(card: UnoCard): string {
  const valueMap: Record<UnoValue, string> = {
    "0": "0",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    skip: "SKIP",
    reverse: "REV",
    draw2: "+2",
    wild: "WILD",
    wild4: "+4",
  };

  return valueMap[card.value];
}

export function isActionCard(card: UnoCard): boolean {
  return ["skip", "reverse", "draw2", "wild", "wild4"].includes(card.value);
}

export function isPlayable(card: UnoCard, room: UnoRoom): boolean {
  if (!room.topCard) return true;
  if (card.color === "wild") return true;
  return card.color === room.activeColor || card.value === room.topCard.value;
}

export function nextPlayerIndex(room: UnoRoom, step = 1, direction = room.direction): number {
  const total = room.playerOrder.length;
  return (room.currentPlayerIndex + direction * step + total * 10) % total;
}

export function drawCards(room: UnoRoom, count: number): { room: UnoRoom; cards: UnoCard[] } {
  let drawPile = [...room.drawPile];
  let discardPile = [...room.discardPile];
  const cards: UnoCard[] = [];

  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0 && discardPile.length > 1) {
      const top = discardPile[discardPile.length - 1];
      drawPile = shuffleCards(discardPile.slice(0, -1));
      discardPile = [top];
    }

    const card = drawPile.shift();
    if (!card) break;
    cards.push(card);
  }

  return {
    room: { ...room, drawPile, discardPile },
    cards,
  };
}

export function getInitialTopCard(deck: UnoCard[]): { topCard: UnoCard; drawPile: UnoCard[] } {
  const index = deck.findIndex((card) => card.color !== "wild" && !isActionCard(card));
  const safeIndex = index >= 0 ? index : 0;
  const topCard = deck[safeIndex];
  const drawPile = deck.filter((_, i) => i !== safeIndex);
  return { topCard, drawPile };
}

export function colorClass(color: UnoColor): string {
  return `card-${color}`;
}
