"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Crown,
  Loader2,
  MessageCircle,
  MoreVertical,
  RotateCcw,
  Send,
  Share2,
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
import type { PlayColor, PublicPlayer, UnoCard } from "@/lib/types";
import { cardLabel, isPlayable, PLAY_COLORS } from "@/lib/uno";
import { UnoCardView } from "./UnoCardView";

type GameRoomProps = {
  code: string;
  onBack: () => void;
};

const QUICK_EMOJIS = ["😁", "😂", "🔥", "👏", "😮", "GG"];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed";
}

function getRoomLink(code: string) {
  if (typeof window === "undefined") return code;
  return `${window.location.origin}?room=${code}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function shareRoom(code: string) {
  const url = getRoomLink(code);
  const text = `Join my UNO room ${code}: ${url}`;

  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title: "Join my UNO room", text, url });
      return "shared";
    } catch {
      // fallback to clipboard
    }
  }

  await navigator.clipboard.writeText(text);
  return "copied";
}

function PlayerAvatar({ player }: { player: PublicPlayer }) {
  return (
    <div className="arena-avatar">
      {player.photoURL ? (
        <img src={player.photoURL} alt={player.name} />
      ) : (
        <span>{getInitials(player.name)}</span>
      )}
    </div>
  );
}

function CardBackStack({
  count,
  side = "top",
}: {
  count: number;
  side?: "top" | "left" | "right";
}) {
  const visible = Math.min(count, 5);

  return (
    <div className={`arena-card-stack ${side}`}>
      {Array.from({ length: visible }).map((_, index) => (
        <div
          key={index}
          className="arena-card-back"
          style={{ "--i": index } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function PlayerSeat({
  player,
  active,
  host,
  position,
}: {
  player?: PublicPlayer;
  active: boolean;
  host: boolean;
  position: "top" | "left" | "right" | "bottom";
}) {
  if (!player) return null;

  return (
    <div className={`arena-seat ${position} ${active ? "active" : ""}`}>
      {position !== "bottom" && (
        <CardBackStack
          count={player.cardCount}
          side={position === "left" ? "left" : position === "right" ? "right" : "top"}
        />
      )}

      <div className="arena-player-meta">
        <div className="arena-name-row">
          <span className={`arena-online-dot ${player.online ? "online" : "away"}`} />
          <strong>{player.name}</strong>
          {host && <Crown size={13} />}
        </div>

        <PlayerAvatar player={player} />

        <div className="arena-count">
          {player.cardCount}
          {player.unoCalled && <small>UNO</small>}
        </div>
      </div>
    </div>
  );
}

function DrawPile({ count }: { count: number }) {
  return (
    <button type="button" className="arena-draw-pile" aria-label="Draw pile">
      <div className="arena-deck-card">
        <span>UNO</span>
      </div>
      <small>{count}</small>
    </button>
  );
}

function WildColorSheet({
  card,
  onCancel,
  onPick,
}: {
  card: UnoCard | null;
  onCancel: () => void;
  onPick: (color: PlayColor) => void;
}) {
  if (!card) return null;

  return (
    <div className="wild-sheet-backdrop" onClick={onCancel}>
      <div className="wild-sheet" onClick={(event) => event.stopPropagation()}>
        <p>Choose color for {cardLabel(card)}</p>

        <div className="wild-sheet-colors">
          {PLAY_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={`wild-sheet-color ${color}`}
              onClick={() => onPick(color)}
              aria-label={`Choose ${color}`}
            >
              {color}
            </button>
          ))}
        </div>

        <button type="button" className="ghost-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function GameRoom({ code, onBack }: GameRoomProps) {
  const { user } = useAuth();
  const { room, loading, error } = useRoom(code);
  const me = user && room ? room.players[user.uid] : null;
  const isPlayer = me?.role === "player";

  const { cards: hand, error: handError } = useHand(
    code,
    user?.uid || null,
    Boolean(isPlayer),
  );

  const { messages } = useChat(code);
  const { online } = usePresence(code, user);
  const { soundEnabled, setSoundEnabled, playSound } = useSound();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [pendingWildCard, setPendingWildCard] = useState<UnoCard | null>(null);

  const currentUid = room?.playerOrder[room.currentPlayerIndex];
  const isMyTurn = Boolean(user && currentUid === user.uid && isPlayer);
  const currentPlayer = room && currentUid ? room.players[currentUid] : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);
  const hasRequestedRematch = Boolean(user && room?.rematchRequests?.includes(user.uid));

  const sortedPlayers = useMemo(() => {
    if (!room) return [];
    return room.playerOrder.map((uid) => room.players[uid]).filter(Boolean);
  }, [room]);

  const otherPlayers = useMemo(() => {
    if (!user) return sortedPlayers;
    return sortedPlayers.filter((player) => player.uid !== user.uid);
  }, [sortedPlayers, user]);

  const topPlayer = otherPlayers[0];
  const leftPlayer = otherPlayers[1];
  const rightPlayer = otherPlayers[2];

  const lastMessages = messages.slice(-3);

  async function safeAction(
    action: () => Promise<unknown>,
    sound: "play" | "draw" | "error" | "win" | "chat" = "play",
  ) {
    if (busy) return;

    setBusy(true);
    setActionError(null);

    try {
      await action();
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

  function handleCardTap(card: UnoCard) {
    if (!user || !room || busy) return;

    if (!canPlay(card)) {
      playSound("error");
      setActionError("This card cannot be played now.");
      return;
    }

    if (card.color === "wild") {
      setPendingWildCard(card);
      return;
    }

    safeAction(() => playCardApi(user, room.code, card.id), "play");
  }

  function playWildWithColor(color: PlayColor) {
    if (!user || !room || !pendingWildCard) return;

    const card = pendingWildCard;
    setPendingWildCard(null);

    safeAction(() => playCardApi(user, room.code, card.id, color), "play");
  }

  async function handleShare() {
    if (!room) return;

    try {
      const result = await shareRoom(room.code);
      setShareStatus(result === "shared" ? "Shared" : "Copied");
      window.setTimeout(() => setShareStatus(null), 1600);
    } catch {
      setActionError("Could not share room link.");
    }
  }

  async function copyRoomCode() {
    if (!room) return;

    await navigator.clipboard.writeText(room.code);
    setShareStatus("Copied");
    window.setTimeout(() => setShareStatus(null), 1600);
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
      <section className="arena-loading">
        <Loader2 className="spin" />
        <span>Loading room...</span>
      </section>
    );
  }

  if (error || !room || !user || !me) {
    return (
      <section className="arena-loading">
        <p>{error || "Room unavailable"}</p>
        <button type="button" className="secondary-button" onClick={onBack}>
          Back to lobby
        </button>
      </section>
    );
  }

  if (room.status === "waiting") {
    return (
      <section className="arena-waiting">
        <div className="arena-top-nav">
          <button type="button" className="arena-round-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>

          <button type="button" className="arena-round-btn" onClick={handleShare}>
            <Share2 size={18} />
          </button>
        </div>

        <div className="arena-waiting-card">
          <p className="eyebrow">Room code</p>
          <h1>{room.code}</h1>
          <p className="muted">Share room and wait for minimum 2 players.</p>

          <div className="arena-waiting-actions">
            <button type="button" className="primary-button" onClick={handleShare}>
              <Share2 size={18} /> {shareStatus || "Share room"}
            </button>

            <button type="button" className="secondary-button" onClick={copyRoomCode}>
              <Copy size={16} /> Copy code
            </button>
          </div>

          <div className="arena-waiting-players">
            {sortedPlayers.map((player) => (
              <div className="arena-waiting-player" key={player.uid}>
                <PlayerAvatar player={player} />

                <div className="arena-waiting-player-info">
                  <strong>{player.name}</strong>
                  <small>{player.online ? "online" : "away"}</small>
                </div>

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
              Start game
            </button>
          )}
        </div>

        {actionError && <p className="arena-error">{actionError}</p>}
      </section>
    );
  }

  const shareUrl = getRoomLink(room.code);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join my UNO room ${room.code}: ${shareUrl}`,
  )}`;

  return (
    <section className="arena-room">
      <div className="arena-top-nav">
        <button type="button" className="arena-round-btn" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>

        <div className="arena-room-pill">
          <span>Room</span>
          <strong>{room.code}</strong>
        </div>

        <div className="arena-top-actions">
          <button type="button" className="arena-round-btn" onClick={handleShare}>
            <Share2 size={18} />
          </button>

          <button
            type="button"
            className="arena-round-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          <a className="arena-round-link" href={whatsappUrl} target="_blank" rel="noreferrer">
            WA
          </a>

          <button type="button" className="arena-round-btn">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {!online && <div className="arena-alert">You are offline. Reconnecting...</div>}
      {handError && isPlayer && <div className="arena-alert danger">Private hand error: {handError}</div>}
      {me.role === "spectator" && <div className="arena-alert">Spectator mode</div>}

      <div className="arena-board">
        <PlayerSeat
          player={topPlayer}
          position="top"
          active={Boolean(topPlayer && currentUid === topPlayer.uid)}
          host={Boolean(topPlayer && topPlayer.uid === room.hostUid)}
        />

        <PlayerSeat
          player={leftPlayer}
          position="left"
          active={Boolean(leftPlayer && currentUid === leftPlayer.uid)}
          host={Boolean(leftPlayer && leftPlayer.uid === room.hostUid)}
        />

        <PlayerSeat
          player={rightPlayer}
          position="right"
          active={Boolean(rightPlayer && currentUid === rightPlayer.uid)}
          host={Boolean(rightPlayer && rightPlayer.uid === room.hostUid)}
        />

        <div className="arena-center">
          {room.status === "finished" ? (
            <div className="arena-winner">
              <Crown size={34} />
              <h2>{room.winnerUid ? room.players[room.winnerUid]?.name : "Someone"} won!</h2>

              {isPlayer && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || hasRequestedRematch}
                  onClick={() => safeAction(() => rematchApi(user, room.code), "win")}
                >
                  <RotateCcw size={18} />
                  {hasRequestedRematch ? "Waiting..." : "Rematch"}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="arena-current-turn">
                {isMyTurn ? "Your turn" : `${currentPlayer?.name || "Player"}'s turn`}
              </div>

              <div className="arena-piles">
                <DrawPile count={room.drawPileCount} />

                <div className="arena-discard-card">
                  {room.topCard && <UnoCardView card={room.topCard} small />}
                </div>
              </div>

              <div className={`arena-direction ${room.direction === 1 ? "clockwise" : "reverse"}`}>
                ↻
              </div>

              <div className={`arena-color-chip ${room.activeColor}`}>
                {room.activeColor}
              </div>

              <div className="arena-log">
                {lastMessages.length > 0 ? (
                  lastMessages.map((message) => (
                    <p key={message.id}>
                      <strong>{message.name}</strong> {message.text}
                    </p>
                  ))
                ) : (
                  <p>{room.lastAction}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="arena-floating-emoji">
          {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
            <button type="button" key={emoji} onClick={() => sendEmoji(emoji)} disabled={busy}>
              {emoji}
            </button>
          ))}
        </div>

        <PlayerSeat
          player={me}
          position="bottom"
          active={isMyTurn}
          host={me.uid === room.hostUid}
        />
      </div>

      {room.status === "playing" && isPlayer && (
        <div className="arena-bottom-panel">
          <div className="arena-hand-actions">
            <button
              type="button"
              className="arena-action-btn"
              disabled={!isMyTurn || busy}
              onClick={() => safeAction(() => drawOneCardApi(user, room.code), "draw")}
            >
              Draw
            </button>

            <button
              type="button"
              className="arena-action-btn"
              disabled={!isMyTurn || busy}
              onClick={() => safeAction(() => passTurnApi(user, room.code))}
            >
              Pass
            </button>

            <button
              type="button"
              className="arena-uno-btn"
              disabled={hand.length !== 1 || busy}
              onClick={() => safeAction(() => callUnoApi(user, room.code), "win")}
            >
              UNO!
            </button>

            <button
              type="button"
              className="arena-action-btn"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageCircle size={15} />
            </button>
          </div>

          <div className="arena-hand">
            {hand.map((card, index) => {
              const playable = canPlay(card);

              return (
                <div
                  key={card.id}
                  className={`arena-hand-card ${playable ? "playable" : ""}`}
                  style={{
                    zIndex: index + 1,
                    marginLeft: index === 0 ? 0 : -34,
                    transform: `rotate(${(index - hand.length / 2) * 2.5}deg)`,
                  }}
                >
                  <UnoCardView
                    card={card}
                    playable={playable}
                    draggable={false}
                    onClick={() => handleCardTap(card)}
                  />
                </div>
              );
            })}
          </div>

          <p className="arena-hint">
            {isMyTurn ? "Tap any glowing card to play instantly." : "Wait for your turn."}
          </p>
        </div>
      )}

      {chatOpen && (
        <div className="arena-chat-sheet">
          <div className="arena-chat-head">
            <strong>Chat & reactions</strong>
            <button type="button" onClick={() => setChatOpen(false)}>
              Close
            </button>
          </div>

          <div className="arena-emoji-row">
            {QUICK_EMOJIS.map((emoji) => (
              <button type="button" key={emoji} onClick={() => sendEmoji(emoji)} disabled={busy}>
                {emoji}
              </button>
            ))}
          </div>

          <div className="arena-chat-list">
            {messages.map((message) => (
              <div className={`arena-chat-message ${message.type}`} key={message.id}>
                <strong>{message.name}</strong>
                <span>{message.text}</span>
              </div>
            ))}
          </div>

          <form className="arena-chat-form" onSubmit={sendChat}>
            <input
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder="Type message..."
              maxLength={180}
            />

            <button type="submit" disabled={!chatText.trim() || busy}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <WildColorSheet
        card={pendingWildCard}
        onCancel={() => setPendingWildCard(null)}
        onPick={playWildWithColor}
      />

      {shareStatus && <div className="arena-toast">{shareStatus}</div>}
      {actionError && <div className="arena-toast error">{actionError}</div>}
    </section>
  );
}