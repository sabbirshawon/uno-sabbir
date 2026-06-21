// Backward-compatible client action wrappers.
// New game validation runs server-side in app/api/rooms/* using Firebase Admin SDK.
import type { User } from "firebase/auth";
import type { PlayColor, UnoCard } from "./types";
import {
  callUnoApi,
  createRoomApi,
  drawOneCardApi,
  joinRoomApi,
  passTurnApi,
  playCardApi,
  startGameApi,
} from "./clientApi";

export async function createRoom(user: User): Promise<string> {
  const result = await createRoomApi(user);
  return result.code;
}

export async function joinRoom(code: string, user: User): Promise<void> {
  await joinRoomApi(user, code, "player");
}

export async function startGame(code: string, user: User): Promise<void> {
  await startGameApi(user, code);
}

export async function playCard(code: string, user: User, card: UnoCard, chosenColor?: PlayColor): Promise<void> {
  await playCardApi(user, code, card.id, chosenColor);
}

export async function drawOneCard(code: string, user: User): Promise<void> {
  await drawOneCardApi(user, code);
}

export async function passTurn(code: string, user: User): Promise<void> {
  await passTurnApi(user, code);
}

export async function callUno(code: string, user: User): Promise<void> {
  await callUnoApi(user, code);
}
