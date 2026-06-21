import type { User } from "firebase/auth";
import type { PlayColor } from "./types";

type ApiPayload = Record<string, unknown>;

async function apiRequest<T>(user: User, path: string, payload: ApiPayload = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function createRoomApi(user: User) {
  return apiRequest<{ code: string }>(user, "/api/rooms/create");
}

export function joinRoomApi(user: User, code: string, mode: "player" | "spectator" = "player") {
  return apiRequest<{ code: string }>(user, "/api/rooms/join", { code, mode });
}

export function startGameApi(user: User, code: string) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/start`);
}

export function playCardApi(user: User, code: string, cardId: string, chosenColor?: PlayColor) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/play`, { cardId, chosenColor });
}

export function drawOneCardApi(user: User, code: string) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/draw`);
}

export function passTurnApi(user: User, code: string) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/pass`);
}

export function callUnoApi(user: User, code: string) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/uno`);
}

export function rematchApi(user: User, code: string) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/rematch`);
}

export function sendChatApi(user: User, code: string, text: string, type: "text" | "emoji" = "text") {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/chat`, { text, type });
}

export function presenceApi(user: User, code: string, online = true) {
  return apiRequest<{ ok: true }>(user, `/api/rooms/${code}/presence`, { online });
}
