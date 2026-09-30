"use client";

import { REACTION_EMOJIS, type PlayerDTO, type ReactionEmoji } from "@puzzle/shared";
import { useEffect, useState } from "react";
import type { Reaction, RoomController } from "@/lib/realtime/room-controller";

const LIFETIME_MS = 2600;

interface FloatingReaction extends Reaction {
  name: string;
  color: string;
  /** Horizontal offset from the centre, px. */
  offset: number;
  sway: number;
}

/**
 * Reactions rise from the bottom centre of the screen, like in a video call, with
 * the sender's name. Above every panel but click-through, and only over the lower
 * part of the table so they never cover the pieces for long.
 */
export function ReactionLayer({
  controller,
  players,
  me,
}: {
  controller: RoomController;
  players: PlayerDTO[];
  me: string;
}) {
  const [items, setItems] = useState<FloatingReaction[]>([]);

  useEffect(
    () =>
      controller.onReaction((reaction) => {
        const player = players.find((p) => p.id === reaction.playerId);
        const item: FloatingReaction = {
          ...reaction,
          name: reaction.playerId === me ? "Siz" : (player?.name ?? ""),
          color: player?.color ?? "#6C5CE7",
          offset: Math.round(Math.random() * 120 - 60),
          sway: Math.round(Math.random() * 40 - 20),
        };
        setItems((current) => [...current.slice(-24), item]);
        window.setTimeout(
          () => setItems((current) => current.filter((i) => i.id !== reaction.id)),
          LIFETIME_MS,
        );
      }),
    [controller, players, me],
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-40 h-[45%] overflow-hidden sm:bottom-16"
      aria-hidden
    >
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute bottom-0 flex flex-col items-center gap-0.5 motion-safe:animate-[rise_2.6s_ease-out_forwards] motion-reduce:animate-[fade-out_2.6s_ease-out_forwards]"
          style={
            {
              left: `calc(50% + ${item.offset}px)`,
              "--sway": `${item.sway}px`,
            } as React.CSSProperties
          }
        >
          <span className="text-4xl drop-shadow-[0_3px_6px_rgb(0_0_0/0.3)]">{item.emoji}</span>
          {item.name && (
            <span
              className="max-w-24 truncate rounded-full px-1.5 py-px text-[10px] font-semibold text-white shadow-soft-sm"
              style={{ backgroundColor: item.color }}
            >
              {item.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** One emoji button; big enough for a thumb on touch screens. */
export function ReactionButton({
  emoji,
  index,
  onReact,
  size = "md",
}: {
  emoji: ReactionEmoji;
  index: number;
  onReact: (emoji: ReactionEmoji) => void;
  size?: "md" | "lg";
}) {
  return (
    <button
      type="button"
      onClick={() => onReact(emoji)}
      title={`${emoji}  (${index + 1})`}
      aria-label={`Reaksiya ${emoji}`}
      className={
        size === "lg"
          ? "flex size-12 touch-manipulation items-center justify-center rounded-full text-2xl transition-transform select-none active:scale-90 active:bg-surface-muted"
          : "flex size-9 touch-manipulation items-center justify-center rounded-full text-xl transition-transform select-none hover:scale-125 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95"
      }
    >
      {emoji}
    </button>
  );
}

/** Quick reaction buttons; keys 1–8 send them too. */
export function ReactionBar({ onReact }: { onReact: (emoji: ReactionEmoji) => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const emoji = REACTION_EMOJIS[index];
      if (emoji) onReact(emoji);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReact]);

  return (
    <div
      role="toolbar"
      aria-label="Reaksiyalar"
      className="flex items-center gap-0.5 rounded-full border border-border bg-surface/95 p-1 shadow-soft-md backdrop-blur"
    >
      {REACTION_EMOJIS.map((emoji, index) => (
        <ReactionButton key={emoji} emoji={emoji} index={index} onReact={onReact} />
      ))}
    </div>
  );
}
