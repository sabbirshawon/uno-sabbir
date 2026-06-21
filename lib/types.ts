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

export type RoomStatus = "waiting" | "playing" | "finished" | "expired";
export type PlayerRole = "player" | "spectator";

export type PublicPlayer = {
  uid: string;
  name: string;
  photoURL: string | null;
  role: PlayerRole;
  cardCount: number;
  unoCalled: boolean;
  joinedAt: number;
  lastSeen: number;
  online: boolean;
};

export type UnoHand = {
  uid: string;
  cards: UnoCard[];
  updatedAt?: unknown;
};

export type PrivateRoomState = {
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  updatedAt?: unknown;
};

export type UnoRoom = {
  code: string;
  status: RoomStatus;
  hostUid: string;
  playerOrder: string[];
  spectatorOrder: string[];
  players: Record<string, PublicPlayer>;
  currentPlayerIndex: number;
  direction: 1 | -1;
  activeColor: PlayColor;
  topCard: UnoCard | null;
  drawPileCount: number;
  winnerUid: string | null;
  lastAction: string;
  rematchRequests: string[];
  createdAt: unknown;
  updatedAt: unknown;
  expiresAt: unknown;
};

export type ChatMessage = {
  id?: string;
  uid: string;
  name: string;
  photoURL: string | null;
  type: "text" | "emoji";
  text: string;
  createdAt: unknown;
};
