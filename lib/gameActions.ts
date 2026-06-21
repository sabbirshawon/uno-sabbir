import { doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { nanoid } from "nanoid";
import { db } from "./firebase";
import type { PlayColor, UnoCard, UnoPlayer, UnoRoom } from "./types";
import { createDeck, drawCards, getInitialTopCard, isPlayable, nextPlayerIndex, shuffleCards } from "./uno";

const ROOM_COLLECTION = "unoRooms";
const MAX_PLAYERS = 4;
const STARTING_HAND_SIZE = 7;

function publicPlayer(user: User): UnoPlayer {
  return {
    uid: user.uid,
    name: user.displayName || "UNO Player",
    photoURL: user.photoURL,
    hand: [],
    cardCount: 0,
    unoCalled: false,
    joinedAt: Date.now(),
  };
}

function roomRef(code: string) {
  return doc(db, ROOM_COLLECTION, code.toUpperCase());
}

export async function createRoom(user: User): Promise<string> {
  const code = nanoid(6).replace(/[-_]/g, "A").toUpperCase();
  const player = publicPlayer(user);

  const room: UnoRoom = {
    code,
    status: "waiting",
    hostUid: user.uid,
    playerOrder: [user.uid],
    players: { [user.uid]: player },
    currentPlayerIndex: 0,
    direction: 1,
    activeColor: "red",
    topCard: null,
    drawPile: [],
    discardPile: [],
    winnerUid: null,
    lastAction: `${player.name} created the room`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(roomRef(code), room);
  return code;
}

export async function joinRoom(code: string, user: User): Promise<void> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Room code is required");

  await runTransaction(db, async (transaction) => {
    const ref = roomRef(normalizedCode);
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists()) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.status !== "waiting") throw new Error("This game has already started");

    if (room.playerOrder.includes(user.uid)) return;
    if (room.playerOrder.length >= MAX_PLAYERS) throw new Error("This room is full");

    const player = publicPlayer(user);

    transaction.update(ref, {
      playerOrder: [...room.playerOrder, user.uid],
      [`players.${user.uid}`]: player,
      lastAction: `${player.name} joined the room`,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function startGame(code: string, user: User): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.hostUid !== user.uid) throw new Error("Only the host can start the game");
    if (room.status !== "waiting") throw new Error("Game already started");
    if (room.playerOrder.length < 2) throw new Error("You need at least 2 players");

    let deck = shuffleCards(createDeck());
    const players = { ...room.players };

    for (const uid of room.playerOrder) {
      const hand = deck.slice(0, STARTING_HAND_SIZE);
      deck = deck.slice(STARTING_HAND_SIZE);
      players[uid] = {
        ...players[uid],
        hand,
        cardCount: hand.length,
        unoCalled: false,
      };
    }

    const initial = getInitialTopCard(deck);

    transaction.update(ref, {
      status: "playing",
      players,
      currentPlayerIndex: 0,
      direction: 1,
      topCard: initial.topCard,
      activeColor: initial.topCard.color as PlayColor,
      discardPile: [initial.topCard],
      drawPile: initial.drawPile,
      winnerUid: null,
      lastAction: "Game started",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function playCard(code: string, user: User, card: UnoCard, chosenColor?: PlayColor): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Room not found");

    let room = snapshot.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");

    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== user.uid) throw new Error("It is not your turn");

    const player = room.players[user.uid];
    const cardInHand = player.hand.find((item) => item.id === card.id);
    if (!cardInHand) throw new Error("This card is not in your hand");
    if (!isPlayable(cardInHand, room)) throw new Error("You cannot play this card now");

    const selectedColor: PlayColor | undefined =
      cardInHand.color === "wild" ? chosenColor : cardInHand.color;

    if (!selectedColor) {
      throw new Error("Choose a color for the wild card");
    }
    
    const updatedHand = player.hand.filter((item) => item.id !== cardInHand.id);
    const players = {
      ...room.players,
      [user.uid]: {
        ...player,
        hand: updatedHand,
        cardCount: updatedHand.length,
        unoCalled: updatedHand.length === 1 ? player.unoCalled : false,
      },
    };

    room = {
      ...room,
      players,
      topCard: cardInHand,
      activeColor: selectedColor,
      discardPile: [...room.discardPile, cardInHand],
    };

    if (updatedHand.length === 0) {
      transaction.update(ref, {
        ...room,
        status: "finished",
        winnerUid: user.uid,
        lastAction: `${player.name} won the game!`,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    let nextIndex = nextPlayerIndex(room);
    let lastAction = `${player.name} played ${cardInHand.value}`;

    if (cardInHand.value === "skip") {
      nextIndex = nextPlayerIndex(room, 2);
      lastAction = `${player.name} skipped the next player`;
    }

    if (cardInHand.value === "reverse") {
      const newDirection = room.direction === 1 ? -1 : 1;
      nextIndex = room.playerOrder.length === 2 ? room.currentPlayerIndex : nextPlayerIndex(room, 1, newDirection);
      room = { ...room, direction: newDirection };
      lastAction = `${player.name} reversed the direction`;
    }

    if (cardInHand.value === "draw2" || cardInHand.value === "wild4") {
      const drawCount = cardInHand.value === "draw2" ? 2 : 4;
      const targetIndex = nextPlayerIndex(room);
      const targetUid = room.playerOrder[targetIndex];
      const target = room.players[targetUid];
      const drawResult = drawCards(room, drawCount);
      room = drawResult.room;

      players[targetUid] = {
        ...target,
        hand: [...target.hand, ...drawResult.cards],
        cardCount: target.hand.length + drawResult.cards.length,
        unoCalled: false,
      };

      nextIndex = nextPlayerIndex(room, 2);
      lastAction = `${player.name} made ${target.name} draw ${drawResult.cards.length}`;
    }

    transaction.update(ref, {
      players,
      topCard: room.topCard,
      activeColor: room.activeColor,
      discardPile: room.discardPile,
      drawPile: room.drawPile,
      direction: room.direction,
      currentPlayerIndex: nextIndex,
      lastAction,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function drawOneCard(code: string, user: User): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Room not found");

    let room = snapshot.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");

    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== user.uid) throw new Error("It is not your turn");

    const player = room.players[user.uid];
    const result = drawCards(room, 1);
    room = result.room;

    const players = {
      ...room.players,
      [user.uid]: {
        ...player,
        hand: [...player.hand, ...result.cards],
        cardCount: player.hand.length + result.cards.length,
        unoCalled: false,
      },
    };

    transaction.update(ref, {
      players,
      drawPile: room.drawPile,
      discardPile: room.discardPile,
      lastAction: `${player.name} drew a card`,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function passTurn(code: string, user: User): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");

    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== user.uid) throw new Error("It is not your turn");

    transaction.update(ref, {
      currentPlayerIndex: nextPlayerIndex(room),
      lastAction: `${room.players[user.uid].name} passed the turn`,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function callUno(code: string, user: User): Promise<void> {
  const ref = roomRef(code);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("Room not found");
  const room = snapshot.data() as UnoRoom;
  const player = room.players[user.uid];
  if (!player) throw new Error("You are not in this room");

  await updateDoc(ref, {
    [`players.${user.uid}.unoCalled`]: true,
    lastAction: `${player.name} called UNO!`,
    updatedAt: serverTimestamp(),
  });
}
