"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Crown, Loader2, Play, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoom } from "@/hooks/useRoom";
import { callUno, drawOneCard, passTurn, playCard, startGame } from "@/lib/gameActions";
import type { PlayColor, UnoCard } from "@/lib/types";
import { isPlayable, PLAY_COLORS } from "@/lib/uno";
import { UnoCardView } from "./UnoCardView";

type GameRoomProps = {
  code: string;
  onBack: () => void;
};

export function GameRoom({ code, onBack }: GameRoomProps) {
  const { user } = useAuth();
  const { room, loading, error } = useRoom(code);
  const [selectedCard, setSelectedCard] = useState<UnoCard | null>(null);
  const [selectedColor, setSelectedColor] = useState<PlayColor>("red");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = user && room ? room.players[user.uid] : null;
  const currentUid = room?.playerOrder[room.currentPlayerIndex];
  const isMyTurn = Boolean(user && currentUid === user.uid);
  const currentPlayer = room && currentUid ? room.players[currentUid] : null;
  const isHost = Boolean(user && room?.hostUid === user.uid);

  const sortedPlayers = useMemo(() => {
    if (!room) return [];
    return room.playerOrder.map((uid) => room.players[uid]).filter(Boolean);
  }, [room]);

  async function safeAction(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setSelectedCard(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
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
        <button className="secondary-button" onClick={onBack}>Back to lobby</button>
      </section>
    );
  }

  const hand = me.hand || [];

  return (
    <section className="game-room glass-card">
      <div className="room-header">
        <button className="ghost-button" onClick={onBack}>
          <ArrowLeft size={16} /> Lobby
        </button>
        <div>
          <p className="eyebrow">Room code</p>
          <h1>{room.code}</h1>
        </div>
        <div className={`status-badge ${room.status}`}>{room.status}</div>
      </div>

      {room.status === "waiting" && (
        <div className="waiting-panel">
          <h2>Waiting for players</h2>
          <p className="muted">Share this room code: <strong>{room.code}</strong>. Minimum 2 players required.</p>
          <div className="players-list">
            {sortedPlayers.map((player) => (
              <div className="player-row" key={player.uid}>
                <span>{player.name}</span>
                {player.uid === room.hostUid && <Crown size={16} />}
              </div>
            ))}
          </div>
          {isHost && (
            <button
              className="primary-button"
              disabled={busy || room.playerOrder.length < 2}
              onClick={() => safeAction(() => startGame(room.code, user))}
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
                    <small>{player.cardCount} cards {player.unoCalled ? "• UNO" : ""}</small>
                  </div>
                  {player.uid === room.hostUid && <Crown size={14} />}
                </div>
              ))}
            </div>

            <div className="center-table">
              {room.status === "finished" ? (
                <div className="winner-card">
                  <Crown size={36} />
                  <h2>{room.winnerUid ? room.players[room.winnerUid]?.name : "Someone"} won!</h2>
                  <p className="muted">Create a new room to play again.</p>
                </div>
              ) : (
                <>
                  <p className="turn-label">
                    {isMyTurn ? "Your turn" : `${currentPlayer?.name || "Player"}'s turn`}
                  </p>
                  <div className="discard-zone">
                    {room.topCard && <UnoCardView card={room.topCard} small />}
                    <div className={`active-color-dot ${room.activeColor}`} />
                  </div>
                  <p className="muted">Direction: {room.direction === 1 ? "Clockwise" : "Counter-clockwise"}</p>
                </>
              )}
            </div>
          </div>

          {room.status === "playing" && (
            <div className="hand-panel">
              <div className="hand-toolbar">
                <div>
                  <p className="eyebrow">Your hand</p>
                  <h2>{hand.length} cards</h2>
                </div>
                <div className="action-buttons">
                  <button className="ghost-button" disabled={!isMyTurn || busy} onClick={() => safeAction(() => drawOneCard(room.code, user))}>
                    Draw
                  </button>
                  <button className="ghost-button" disabled={!isMyTurn || busy} onClick={() => safeAction(() => passTurn(room.code, user))}>
                    Pass
                  </button>
                  <button className="uno-button" disabled={hand.length !== 1 || busy} onClick={() => safeAction(() => callUno(room.code, user))}>
                    UNO!
                  </button>
                </div>
              </div>

              {selectedCard?.color === "wild" && (
                <div className="color-picker">
                  <span>Choose color:</span>
                  {PLAY_COLORS.map((color) => (
                    <button
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
                  const playable = room ? isPlayable(card, room) && isMyTurn : false;
                  return (
                    <UnoCardView
                      key={card.id}
                      card={card}
                      playable={playable}
                      selected={selectedCard?.id === card.id}
                      onClick={
                        playable
                          ? () => {
                              if (selectedCard?.id === card.id) {
                                safeAction(() => playCard(room.code, user, card, card.color === "wild" ? selectedColor : undefined));
                              } else {
                                setSelectedCard(card);
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>

              {selectedCard && (
                <button
                  className="primary-button play-selected"
                  disabled={busy}
                  onClick={() => safeAction(() => playCard(room.code, user, selectedCard, selectedCard.color === "wild" ? selectedColor : undefined))}
                >
                  Play selected card
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="activity-bar">
        <RotateCcw size={15} /> {room.lastAction}
      </div>
      {actionError && <p className="error-text">{actionError}</p>}
    </section>
  );
}
