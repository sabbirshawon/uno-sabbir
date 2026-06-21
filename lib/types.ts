export type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";
export type PlayColor = Exclude<UnoColor, "wild">;
export type UnoValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export type UnoCard = {
  id: string;
  color: UnoColor;
  value: UnoValue;
};

export type RoomStatus = "waiting" | "playing" | "finished";

export type UnoPlayer = {
  uid: string;
  name: string;
  photoURL: string | null;
  hand: UnoCard[];
  cardCount: number;
  unoCalled: boolean;
  joinedAt: number;
};

export type UnoRoom = {
  code: string;
  status: RoomStatus;
  hostUid: string;
  playerOrder: string[];
  players: Record<string, UnoPlayer>;
  currentPlayerIndex: number;
  direction: 1 | -1;
  activeColor: PlayColor;
  topCard: UnoCard | null;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  winnerUid: string | null;
  lastAction: string;
  createdAt: unknown;
  updatedAt: unknown;
};
