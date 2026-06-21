import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { getAdminDb } from "./firebaseAdmin";
import type { ChatMessage, PlayColor, PrivateRoomState, PublicPlayer, UnoCard, UnoHand, UnoRoom } from "@/lib/types";
import {
  createDeck,
  drawCardsFromState,
  getInitialTopCard,
  isPlayable,
  MAX_PLAYERS,
  nextPlayerIndex,
  ROOM_TTL_HOURS,
  shuffleCards,
  STARTING_HAND_SIZE,
} from "@/lib/uno";

const ROOM_COLLECTION = "unoRooms";
const PRIVATE_DOC = "state";

type JoinMode = "player" | "spectator";

function roomRef(code: string) {
  return getAdminDb().collection(ROOM_COLLECTION).doc(code.toUpperCase());
}

function handRef(code: string, uid: string) {
  return roomRef(code).collection("hands").doc(uid);
}

function privateStateRef(code: string) {
  return roomRef(code).collection("private").doc(PRIVATE_DOC);
}

function chatRef(code: string) {
  return roomRef(code).collection("chat");
}

function expiresAt() {
  return Timestamp.fromDate(new Date(Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000));
}

function playerFromToken(token: DecodedIdToken, role: JoinMode): PublicPlayer {
  return {
    uid: token.uid,
    name: typeof token.name === "string" && token.name.trim() ? token.name : token.email || "UNO Player",
    photoURL: typeof token.picture === "string" ? token.picture : null,
    role,
    cardCount: 0,
    unoCalled: false,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    online: true,
  };
}

function assertParticipant(room: UnoRoom, uid: string) {
  const player = room.players?.[uid];
  if (!player) throw new Error("You are not in this room");
  return player;
}

function assertActivePlayer(room: UnoRoom, uid: string) {
  const player = assertParticipant(room, uid);
  if (player.role !== "player") throw new Error("Spectators cannot make game moves");
  return player;
}

function chooseWildColor(card: UnoCard, chosenColor?: PlayColor): PlayColor {
  if (card.color === "wild") {
    if (!chosenColor) throw new Error("Choose a color for the wild card");
    return chosenColor;
  }
  return card.color;
}

function allCurrentPlayersRequested(room: UnoRoom, nextRequests: string[]) {
  return room.playerOrder.length >= 2 && room.playerOrder.every((uid) => nextRequests.includes(uid));
}

function getHand(snapshotData: DocumentData | undefined, uid: string): UnoHand {
  const data = snapshotData as UnoHand | undefined;
  return { uid, cards: Array.isArray(data?.cards) ? data.cards : [] };
}

function getPrivateState(snapshotData: DocumentData | undefined): PrivateRoomState {
  const data = snapshotData as PrivateRoomState | undefined;
  return {
    drawPile: Array.isArray(data?.drawPile) ? data.drawPile : [],
    discardPile: Array.isArray(data?.discardPile) ? data.discardPile : [],
  };
}

function startNewDeal(room: UnoRoom) {
  let deck = shuffleCards(createDeck());
  const hands: Record<string, UnoCard[]> = {};
  const players = { ...room.players };

  for (const uid of room.playerOrder) {
    const hand = deck.slice(0, STARTING_HAND_SIZE);
    deck = deck.slice(STARTING_HAND_SIZE);
    hands[uid] = hand;
    players[uid] = {
      ...players[uid],
      role: "player",
      cardCount: hand.length,
      unoCalled: false,
      online: true,
      lastSeen: Date.now(),
    };
  }

  for (const uid of room.spectatorOrder) {
    if (players[uid]) {
      players[uid] = { ...players[uid], role: "spectator", cardCount: 0, unoCalled: false };
    }
  }

  const initial = getInitialTopCard(deck);

  return {
    hands,
    players,
    privateState: {
      drawPile: initial.drawPile,
      discardPile: [initial.topCard],
      updatedAt: FieldValue.serverTimestamp(),
    },
    roomPatch: {
      status: "playing" as const,
      players,
      currentPlayerIndex: 0,
      direction: 1 as const,
      activeColor: initial.topCard.color as PlayColor,
      topCard: initial.topCard,
      drawPileCount: initial.drawPile.length,
      winnerUid: null,
      rematchRequests: [],
      lastAction: "Game started",
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    },
  };
}

export async function createRoom(token: DecodedIdToken) {
  const code = nanoid(6).replace(/[-_]/g, "A").toUpperCase();
  const player = playerFromToken(token, "player");
  const room: UnoRoom = {
    code,
    status: "waiting",
    hostUid: token.uid,
    playerOrder: [token.uid],
    spectatorOrder: [],
    players: { [token.uid]: player },
    currentPlayerIndex: 0,
    direction: 1,
    activeColor: "red",
    topCard: null,
    drawPileCount: 0,
    winnerUid: null,
    lastAction: `${player.name} created the room`,
    rematchRequests: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt(),
  };

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const existing = await transaction.get(ref);
    if (existing.exists) throw new Error("Room code collision. Try again.");
    transaction.set(ref, room);
    transaction.set(handRef(code, token.uid), { uid: token.uid, cards: [], updatedAt: FieldValue.serverTimestamp() });
    transaction.set(privateStateRef(code), { drawPile: [], discardPile: [], updatedAt: FieldValue.serverTimestamp() });
  });

  return { code };
}

export async function joinRoom(codeInput: string, token: DecodedIdToken, mode: JoinMode) {
  const code = codeInput.trim().toUpperCase();
  if (!code) throw new Error("Room code is required");

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.status === "expired") throw new Error("This room expired");

    const existing = room.players[token.uid];
    const joiningAsSpectator = mode === "spectator" || room.status !== "waiting";

    if (existing) {
      const newRole: JoinMode = existing.role === "player" ? "player" : joiningAsSpectator ? "spectator" : "player";
      const playerOrder = newRole === "player" && !room.playerOrder.includes(token.uid) ? [...room.playerOrder, token.uid] : room.playerOrder;
      const spectatorOrder = newRole === "player" ? room.spectatorOrder.filter((uid) => uid !== token.uid) : room.spectatorOrder.includes(token.uid) ? room.spectatorOrder : [...room.spectatorOrder, token.uid];
      transaction.update(ref, {
        playerOrder,
        spectatorOrder,
        [`players.${token.uid}.role`]: newRole,
        [`players.${token.uid}.online`]: true,
        [`players.${token.uid}.lastSeen`]: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: expiresAt(),
      });
      return;
    }

    const role: JoinMode = joiningAsSpectator ? "spectator" : "player";
    if (role === "player") {
      if (room.status !== "waiting") throw new Error("This game has already started. Join as spectator instead.");
      if (room.playerOrder.length >= MAX_PLAYERS) throw new Error("This room is full. Join as spectator instead.");
    }

    const player = playerFromToken(token, role);
    transaction.update(ref, {
      playerOrder: role === "player" ? [...room.playerOrder, token.uid] : room.playerOrder,
      spectatorOrder: role === "spectator" ? [...room.spectatorOrder, token.uid] : room.spectatorOrder,
      [`players.${token.uid}`]: player,
      lastAction: role === "player" ? `${player.name} joined the room` : `${player.name} is spectating`,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
    transaction.set(handRef(code, token.uid), { uid: token.uid, cards: [], updatedAt: FieldValue.serverTimestamp() });
  });

  return { code };
}

export async function startGame(codeInput: string, token: DecodedIdToken) {
  const code = codeInput.trim().toUpperCase();

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.hostUid !== token.uid) throw new Error("Only the host can start the game");
    if (room.status !== "waiting") throw new Error("Game already started");
    if (room.playerOrder.length < 2) throw new Error("You need at least 2 players");

    const deal = startNewDeal(room);
    transaction.update(ref, deal.roomPatch);
    transaction.set(privateStateRef(code), deal.privateState);
    for (const [uid, cards] of Object.entries(deal.hands)) {
      transaction.set(handRef(code, uid), { uid, cards, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  return { ok: true };
}

export async function playCard(codeInput: string, token: DecodedIdToken, cardId: string, chosenColor?: PlayColor) {
  const code = codeInput.trim().toUpperCase();
  if (!cardId) throw new Error("Card id is required");

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const privateRef = privateStateRef(code);
    const myHandRef = handRef(code, token.uid);
    const roomSnap = await transaction.get(ref);
    const privateSnap = await transaction.get(privateRef);
    const myHandSnap = await transaction.get(myHandRef);

    if (!roomSnap.exists) throw new Error("Room not found");
    const room = roomSnap.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");
    const publicPlayer = assertActivePlayer(room, token.uid);

    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== token.uid) throw new Error("It is not your turn");

    const hand = getHand(myHandSnap.data(), token.uid);
    const cardInHand = hand.cards.find((item) => item.id === cardId);
    if (!cardInHand) throw new Error("This card is not in your hand");
    if (!isPlayable(cardInHand, room)) throw new Error("You cannot play this card now");

    const selectedColor = chooseWildColor(cardInHand, chosenColor);
    const privateState = getPrivateState(privateSnap.data());
    let drawPile = [...privateState.drawPile];
    let discardPile = [...privateState.discardPile, cardInHand];
    const updatedHand = hand.cards.filter((item) => item.id !== cardInHand.id);
    const players = { ...room.players };

    players[token.uid] = {
      ...publicPlayer,
      cardCount: updatedHand.length,
      unoCalled: updatedHand.length === 1 ? publicPlayer.unoCalled : false,
      online: true,
      lastSeen: Date.now(),
    };

    let direction = room.direction;
    let nextIndex = nextPlayerIndex(room);
    let lastAction = `${publicPlayer.name} played ${cardInHand.value}`;

    let targetHandDoc: DocumentSnapshot | null = null;
    let targetUid: string | null = null;
    let drawCount = 0;

    if (cardInHand.value === "skip") {
      nextIndex = nextPlayerIndex(room, 2);
      lastAction = `${publicPlayer.name} skipped the next player`;
    }

    if (cardInHand.value === "reverse") {
      direction = room.direction === 1 ? -1 : 1;
      nextIndex = room.playerOrder.length === 2 ? room.currentPlayerIndex : nextPlayerIndex(room, 1, direction);
      lastAction = `${publicPlayer.name} reversed the direction`;
    }

    if (cardInHand.value === "draw2" || cardInHand.value === "wild4") {
      drawCount = cardInHand.value === "draw2" ? 2 : 4;
      const targetIndex = nextPlayerIndex(room);
      targetUid = room.playerOrder[targetIndex];
      targetHandDoc = await transaction.get(handRef(code, targetUid));
    }

    if (updatedHand.length === 0) {
      transaction.set(myHandRef, { uid: token.uid, cards: updatedHand, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(privateRef, { drawPile, discardPile, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(ref, {
        status: "finished",
        players,
        topCard: cardInHand,
        activeColor: selectedColor,
        drawPileCount: drawPile.length,
        winnerUid: token.uid,
        lastAction: `${publicPlayer.name} won the game!`,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: expiresAt(),
      });
      return;
    }

    if (targetUid && targetHandDoc) {
      const target = players[targetUid];
      const targetHand = getHand(targetHandDoc.data(), targetUid);
      const drawResult = drawCardsFromState(drawPile, discardPile, drawCount);
      drawPile = drawResult.drawPile;
      discardPile = drawResult.discardPile;
      const updatedTargetCards = [...targetHand.cards, ...drawResult.cards];

      players[targetUid] = {
        ...target,
        cardCount: updatedTargetCards.length,
        unoCalled: false,
      };

      transaction.set(handRef(code, targetUid), {
        uid: targetUid,
        cards: updatedTargetCards,
        updatedAt: FieldValue.serverTimestamp(),
      });

      nextIndex = nextPlayerIndex(room, 2);
      lastAction = `${publicPlayer.name} made ${target.name} draw ${drawResult.cards.length}`;
    }

    transaction.set(myHandRef, { uid: token.uid, cards: updatedHand, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(privateRef, { drawPile, discardPile, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(ref, {
      players,
      topCard: cardInHand,
      activeColor: selectedColor,
      drawPileCount: drawPile.length,
      direction,
      currentPlayerIndex: nextIndex,
      lastAction,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  });

  return { ok: true };
}

export async function drawOneCard(codeInput: string, token: DecodedIdToken) {
  const code = codeInput.trim().toUpperCase();

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const privateRef = privateStateRef(code);
    const myHandRef = handRef(code, token.uid);
    const roomSnap = await transaction.get(ref);
    const privateSnap = await transaction.get(privateRef);
    const myHandSnap = await transaction.get(myHandRef);

    if (!roomSnap.exists) throw new Error("Room not found");
    const room = roomSnap.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");
    const player = assertActivePlayer(room, token.uid);

    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== token.uid) throw new Error("It is not your turn");

    const hand = getHand(myHandSnap.data(), token.uid);
    const privateState = getPrivateState(privateSnap.data());
    const drawResult = drawCardsFromState(privateState.drawPile, privateState.discardPile, 1);
    const updatedCards = [...hand.cards, ...drawResult.cards];

    transaction.set(myHandRef, { uid: token.uid, cards: updatedCards, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(privateRef, {
      drawPile: drawResult.drawPile,
      discardPile: drawResult.discardPile,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(ref, {
      [`players.${token.uid}.cardCount`]: updatedCards.length,
      [`players.${token.uid}.unoCalled`]: false,
      [`players.${token.uid}.online`]: true,
      [`players.${token.uid}.lastSeen`]: Date.now(),
      drawPileCount: drawResult.drawPile.length,
      lastAction: `${player.name} drew a card`,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  });

  return { ok: true };
}

export async function passTurn(codeInput: string, token: DecodedIdToken) {
  const code = codeInput.trim().toUpperCase();

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("Room not found");

    const room = snapshot.data() as UnoRoom;
    if (room.status !== "playing") throw new Error("Game is not active");
    const player = assertActivePlayer(room, token.uid);
    const currentUid = room.playerOrder[room.currentPlayerIndex];
    if (currentUid !== token.uid) throw new Error("It is not your turn");

    transaction.update(ref, {
      currentPlayerIndex: nextPlayerIndex(room),
      [`players.${token.uid}.online`]: true,
      [`players.${token.uid}.lastSeen`]: Date.now(),
      lastAction: `${player.name} passed the turn`,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  });

  return { ok: true };
}

export async function callUno(codeInput: string, token: DecodedIdToken) {
  const code = codeInput.trim().toUpperCase();
  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const roomSnap = await transaction.get(ref);
    const handSnap = await transaction.get(handRef(code, token.uid));
    if (!roomSnap.exists) throw new Error("Room not found");

    const room = roomSnap.data() as UnoRoom;
    const player = assertActivePlayer(room, token.uid);
    const hand = getHand(handSnap.data(), token.uid);
    if (hand.cards.length !== 1) throw new Error("You can only call UNO when you have one card");

    transaction.update(ref, {
      [`players.${token.uid}.unoCalled`]: true,
      [`players.${token.uid}.online`]: true,
      [`players.${token.uid}.lastSeen`]: Date.now(),
      lastAction: `${player.name} called UNO!`,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  });

  return { ok: true };
}

export async function requestRematch(codeInput: string, token: DecodedIdToken) {
  const code = codeInput.trim().toUpperCase();

  await getAdminDb().runTransaction(async (transaction) => {
    const ref = roomRef(code);
    const roomSnap = await transaction.get(ref);
    if (!roomSnap.exists) throw new Error("Room not found");
    const room = roomSnap.data() as UnoRoom;
    const player = assertActivePlayer(room, token.uid);
    if (room.status !== "finished") throw new Error("Rematch is available after a game finishes");

    const rematchRequests = Array.from(new Set([...(room.rematchRequests || []), token.uid]));

    if (allCurrentPlayersRequested(room, rematchRequests)) {
      const deal = startNewDeal({ ...room, rematchRequests });
      transaction.update(ref, { ...deal.roomPatch, lastAction: "Rematch started" });
      transaction.set(privateStateRef(code), deal.privateState);
      for (const [uid, cards] of Object.entries(deal.hands)) {
        transaction.set(handRef(code, uid), { uid, cards, updatedAt: FieldValue.serverTimestamp() });
      }
      return;
    }

    transaction.update(ref, {
      rematchRequests,
      [`players.${token.uid}.online`]: true,
      [`players.${token.uid}.lastSeen`]: Date.now(),
      lastAction: `${player.name} wants a rematch (${rematchRequests.length}/${room.playerOrder.length})`,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  });

  return { ok: true };
}

export async function updatePresence(codeInput: string, token: DecodedIdToken, online: boolean) {
  const code = codeInput.trim().toUpperCase();
  const ref = roomRef(code);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Room not found");
  const room = snapshot.data() as UnoRoom;
  assertParticipant(room, token.uid);

  await ref.update({
    [`players.${token.uid}.online`]: online,
    [`players.${token.uid}.lastSeen`]: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
}

export async function sendChatMessage(codeInput: string, token: DecodedIdToken, textInput: string, typeInput: "text" | "emoji") {
  const code = codeInput.trim().toUpperCase();
  const text = textInput.trim();
  const type = typeInput === "emoji" ? "emoji" : "text";
  if (!text) throw new Error("Message is required");
  if (text.length > 180) throw new Error("Message is too long");

  const roomSnapshot = await roomRef(code).get();
  if (!roomSnapshot.exists) throw new Error("Room not found");
  const room = roomSnapshot.data() as UnoRoom;
  const player = assertParticipant(room, token.uid);

  const message: ChatMessage = {
    uid: token.uid,
    name: player.name,
    photoURL: player.photoURL,
    type,
    text,
    createdAt: FieldValue.serverTimestamp(),
  };

  await chatRef(code).add(message);
  await roomRef(code).update({
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt(),
  });

  return { ok: true };
}

export async function expireOldRooms(secret: string | null) {
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    throw new Error("Invalid cron secret");
  }

  const now = Timestamp.now();
  const snapshot = await getAdminDb().collection(ROOM_COLLECTION).where("expiresAt", "<=", now).limit(50).get();
  const batch = getAdminDb().batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    const room = doc.data() as UnoRoom;
    if (room.status !== "expired") {
      batch.update(doc.ref, {
        status: "expired",
        lastAction: "Room expired and was cleaned up",
        updatedAt: FieldValue.serverTimestamp(),
      });
      count += 1;
    }
  });

  if (count > 0) await batch.commit();
  return { expired: count };
}
