import type { PlayColor, UnoCard, UnoColor, UnoRoom, UnoValue } from "./types";

const COLORS: PlayColor[] = ["red", "yellow", "green", "blue"];
const NUMBER_VALUES: UnoValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTION_VALUES: UnoValue[] = ["skip", "reverse", "draw2"];
const POWER_VALUES: UnoValue[] = ["boo", "shield", "swap", "blast"];

export const PLAY_COLORS = COLORS;
export const STARTING_HAND_SIZE = 7;
export const MAX_PLAYERS = 4;
export const ROOM_TTL_HOURS = 24;

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

    for (const value of POWER_VALUES) {
      deck.push({ id: `${color}-${value}`, color, value });
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
    boo: "BOO",
    shield: "SAFE",
    swap: "SWAP",
    blast: "ALL+1",
  };

  return valueMap[card.value];
}

export function isActionCard(card: UnoCard): boolean {
  return [
    "skip",
    "reverse",
    "draw2",
    "wild",
    "wild4",
    "boo",
    "shield",
    "swap",
    "blast",
  ].includes(card.value);
}

export function isPowerCard(card: UnoCard): boolean {
  return ["boo", "shield", "swap", "blast"].includes(card.value);
}

export function powerCardDescription(card: UnoCard): string {
  const descriptions: Partial<Record<UnoValue, string>> = {
    boo: "Next player draws 2 and loses turn",
    shield: "Block one future draw attack",
    swap: "Swap hands with the next player",
    blast: "Everyone else draws 1 card",
  };

  return descriptions[card.value] || "Power card";
}

export function isPlayable(
  card: UnoCard,
  room: Pick<UnoRoom, "topCard" | "activeColor">,
): boolean {
  if (!room.topCard) return true;
  if (card.color === "wild") return true;

  return card.color === room.activeColor || card.value === room.topCard.value;
}

export function nextPlayerIndex(
  room: Pick<UnoRoom, "playerOrder" | "currentPlayerIndex" | "direction">,
  step = 1,
  direction = room.direction,
): number {
  const total = room.playerOrder.length;
  if (total === 0) return 0;

  return (room.currentPlayerIndex + direction * step + total * 10) % total;
}

export function drawCardsFromState(
  drawPileInput: UnoCard[],
  discardPileInput: UnoCard[],
  count: number,
): { drawPile: UnoCard[]; discardPile: UnoCard[]; cards: UnoCard[] } {
  let drawPile = [...drawPileInput];
  let discardPile = [...discardPileInput];
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

  return { drawPile, discardPile, cards };
}

export function getInitialTopCard(deck: UnoCard[]): {
  topCard: UnoCard;
  drawPile: UnoCard[];
} {
  const index = deck.findIndex((card) => card.color !== "wild" && !isActionCard(card));
  const safeIndex = index >= 0 ? index : 0;
  const topCard = deck[safeIndex];
  const drawPile = deck.filter((_, i) => i !== safeIndex);

  return { topCard, drawPile };
}

export function colorClass(color: UnoColor): string {
  return `card-${color}`;
}