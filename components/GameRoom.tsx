"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Crown,
  Loader2,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useHand } from "@/hooks/useHand";
import { usePresence } from "@/hooks/usePresence";
import { useRoom } from "@/hooks/useRoom";
import { useSound } from "@/hooks/useSound";
import {
  callUnoApi,
  drawOneCardApi,
  passTurnApi,
  playCardApi,
  rematchApi,
  sendChatApi,
  startGameApi,
} from "@/lib/clientApi";
import type { PlayColor, UnoCard } from "@/lib/types";
import { isPlayable, PLAY_COLORS } from "@/lib/uno";
import { UnoCardView } from "./UnoCardView";

type GameRoomProps = {
  code: string;
  onBack: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed";
}

const QUICK_EMOJIS = ["🔥", "😂", "😮", "👏", "🃏", "GG"];

export function GameRoom({ code, onBack }: GameRoomProps) {
  const { user } = useAuth();
  const { room, loading, error } = useRoom(code);
  const me = user && room ? room.players[user.uid] : null;
  const isPlayer = me?.role === "player";
  const { cards: hand, error: handError } = useHand(code, user?.uid || null, Boolean(isPlayer));
  const { messages } = useChat(code);
  const { online } = usePresence(code, user);
  const { soundEnabled, setSoundEnabled, playSound } = useSound();

  const [selectedCard, setSelectedCard] = useState<UnoCard | null>(null);
  const [draggingCard, setDraggingCard] = useState<UnoCard | null>(null);
  const [selectedColor, setSelectedColor] = useState<PlayColor>("red");
  const [chatText, setChatText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentUid = room?.playerOrder[room.currentPlayerIndex];
  const isMyTurn = Boolean(user && currentUid === user.uid && isPlayer);
  const currentPlayer = room && currentUid ? room.players[currentUid] : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);
  const hasRequestedRematch = Boolean(user && room?.rematchRequests?.includes(user.uid));

  const sortedPlayers = useMemo(() => {
    if (!room) return [];
    return room.playerOrder.map((uid) => room.players[uid]).filter(Boolean);
  }, [room]);

  const spectators = useMemo(() => {
    if (!room) return [];
    return room.spectatorOrder.map((uid) => room.players[uid]).filter(Boolean);
  }, [room]);

  async function safeAction(action: () => Promise<unknown>, sound: "play" | "draw" | "error" | "win" | "chat" = "play") {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setSelectedCard(null);
      setDraggingCard(null);
      playSound(sound);
    } catch (err) {
      playSound("error");
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function canPlay(card: UnoCard) {
    return Boolean(room && isMyTurn && isPlayable(card, room));
  }

  function playCard(card: UnoCard) {
    if (!user || !room || !canPlay(card)) return;
    safeAction(() => playCardApi(user, room.code, card.id, card.color === "wild" ? selectedColor : undefined));
  }

  function handleDropPlay() {
    if (!draggingCard) return;
    playCard(draggingCard);
  }

  async function sendChat(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!user || !room || !chatText.trim()) return;
    const text = chatText.trim();
    setChatText("");
    await safeAction(() => sendChatApi(user, room.code, text, "text"), "chat");
  }

  async function sendEmoji(text: string) {
    if (!user || !room) return;
    await safeAction(() => sendChatApi(user, room.code, text, "emoji"), "chat");
  }

  if (loading) {
    return (
      <section className="game-room glass-card center-state">
        <Loader2 className="spin" /> Loading room...
      </section>
    );
  }

  if (error || !room || !user || !me) {
    return (
      <section className="game-room glass-card center-state">
        <p>{error || "Room unavailable"}</p>
        <button type="button" className="secondary-button" onClick={onBack}>Back to lobby</button>
      </section>
    );
  }

  return (
    <section className="game-room glass-card">
      <div className="room-header">
        <button type="button" className="ghost-button" onClick={onBack}>
          <ArrowLeft size={16} /> Lobby
        </button>
        <div>
          <p className="eyebrow">Room code</p>
          <h1>{room.code}</h1>
        </div>
        <div className="room-actions">
          <button
            type="button"
            className="ghost-button icon-button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle sound"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <div className={`status-badge ${room.status}`}>{room.status}</div>
        </div>
      </div>

      {!online && <div className="reconnect-banner">You are offline. Reconnecting when your network returns...</div>}
      {handError && isPlayer && <div className="reconnect-banner danger">Private hand error: {handError}</div>}
      {me.role === "spectator" && <div className="spectator-banner">Spectator mode: you can watch, chat, and react, but cannot play cards.</div>}

      {room.status === "waiting" && (
        <div className="waiting-panel">
          <h2>Waiting for players</h2>
          <p className="muted">Share this room code: <strong>{room.code}</strong>. Minimum 2 players required.</p>
          <div className="players-list">
            {sortedPlayers.map((player) => (
              <div className="player-row" key={player.uid}>
                <span>{player.name}</span>
                <span className={`presence ${player.online ? "online" : "offline"}`}>{player.online ? "online" : "away"}</span>
                {player.uid === room.hostUid && <Crown size={16} />}
              </div>
            ))}
          </div>
          {isHost && (
            <button
              type="button"
              className="primary-button"
              disabled={busy || room.playerOrder.length < 2}
              onClick={() => safeAction(() => startGameApi(user, room.code))}
            >
              <Play size={18} /> Start game
            </button>
          )}
        </div>
      )}

      {room.status !== "waiting" && (
        <>
          <div className="table-area">
            <div className="players-sidebar">
              {sortedPlayers.map((player, index) => (
                <div className={`player-card ${room.currentPlayerIndex === index ? "active" : ""}`} key={player.uid}>
                  <div>
                    <strong>{player.name}</strong>
                    <small>
                      {player.cardCount} cards {player.unoCalled ? "• UNO" : ""} • {player.online ? "online" : "away"}
                    </small>
                  </div>
                  {player.uid === room.hostUid && <Crown size={14} />}
                </div>
              ))}

              {spectators.length > 0 && (
                <div className="spectators-list">
                  <small>Spectators</small>
                  {spectators.map((player) => (
                    <span key={player.uid}>{player.name}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="center-table">
              {room.status === "finished" ? (
                <div className="winner-card">
                  <Crown size={36} />
                  <h2>{room.winnerUid ? room.players[room.winnerUid]?.name : "Someone"} won!</h2>
                  <p className="muted">Rematch starts automatically when all players request it.</p>
                  {isPlayer && (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy || hasRequestedRematch}
                      onClick={() => safeAction(() => rematchApi(user, room.code), "win")}
                    >
                      <RotateCcw size={18} /> {hasRequestedRematch ? "Waiting for others" : "Rematch"}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="turn-label">
                    {isMyTurn ? "Your turn" : `${currentPlayer?.name || "Player"}'s turn`}
                  </p>
                  <div
                    className={`discard-zone ${draggingCard && canPlay(draggingCard) ? "drop-ready" : ""}`}
                    onDragOver={(event) => {
                      if (draggingCard && canPlay(draggingCard)) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDropPlay();
                    }}
                  >
                    {room.topCard && <UnoCardView card={room.topCard} small />}
                    <div className={`active-color-dot ${room.activeColor}`} />
                    <span>Drop playable card here</span>
                  </div>
                  <p className="muted">
                    Direction: {room.direction === 1 ? "Clockwise" : "Counter-clockwise"} • Draw pile: {room.drawPileCount}
                  </p>
                </>
              )}
            </div>
          </div>

          {room.status === "playing" && isPlayer && (
            <div className="hand-panel">
              <div className="hand-toolbar">
                <div>
                  <p className="eyebrow">Your private hand</p>
                  <h2>{hand.length} cards</h2>
                </div>
                <div className="action-buttons">
                  <button type="button" className="ghost-button" disabled={!isMyTurn || busy} onClick={() => safeAction(() => drawOneCardApi(user, room.code), "draw")}>
                    Draw
                  </button>
                  <button type="button" className="ghost-button" disabled={!isMyTurn || busy} onClick={() => safeAction(() => passTurnApi(user, room.code))}>
                    Pass
                  </button>
                  <button type="button" className="uno-button" disabled={hand.length !== 1 || busy} onClick={() => safeAction(() => callUnoApi(user, room.code), "win")}>
                    UNO!
                  </button>
                </div>
              </div>

              {(selectedCard?.color === "wild" || draggingCard?.color === "wild") && (
                <div className="color-picker">
                  <span>Choose color:</span>
                  {PLAY_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`color-choice ${color} ${selectedColor === color ? "selected" : ""}`}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Choose ${color}`}
                    />
                  ))}
                </div>
              )}

              <div className="hand-grid">
                {hand.map((card) => {
                  const playable = canPlay(card);
                  return (
                    <UnoCardView
                      key={card.id}
                      card={card}
                      playable={playable}
                      selected={selectedCard?.id === card.id}
                      draggable={playable}
                      onDragStart={() => setDraggingCard(card)}
                      onClick={
                        playable
                          ? () => {
                              if (selectedCard?.id === card.id) playCard(card);
                              else setSelectedCard(card);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>

              {selectedCard && (
                <button type="button" className="primary-button play-selected" disabled={busy} onClick={() => playCard(selectedCard)}>
                  Play selected card
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="chat-panel">
        <div className="chat-title"><MessageCircle size={16} /> Chat & reactions</div>
        <div className="emoji-row">
          {QUICK_EMOJIS.map((emoji) => (
            <button type="button" key={emoji} onClick={() => sendEmoji(emoji)} disabled={busy}>
              {emoji}
            </button>
          ))}
        </div>
        <div className="chat-messages">
          {messages.map((message) => (
            <div className={`chat-message ${message.type}`} key={message.id}>
              <strong>{message.name}</strong>
              <span>{message.text}</span>
            </div>
          ))}
          {messages.length === 0 && <p className="muted">No messages yet.</p>}
        </div>
        <form className="chat-form" onSubmit={sendChat}>
          <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Type a message..." maxLength={180} />
          <button type="submit" className="secondary-button" disabled={!chatText.trim() || busy}>
            <Send size={15} />
          </button>
        </form>
      </div>

      <div className="activity-bar">
        <RotateCcw size={15} /> {room.lastAction}
      </div>
      {actionError && <p className="error-text">{actionError}</p>}
    </section>
  );
}
