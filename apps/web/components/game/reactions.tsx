"use client";

import { REACTION_EMOJIS, type PlayerDTO, type ReactionEmoji } from "@puzzle/shared";
import { useEffect, useState } from "react";
import type { Reaction, RoomController } from "@/lib/realtime/room-controller";

const LIFETIME_MS = 1800;

interface FloatingReaction extends Reaction {
  screenX: number;
  screenY: number;
  color: string;
  drift: number;
}

/** Emoji that float up from the sender's cursor and fade out. */
export function ReactionLayer({
  controller,
  players,
}: {
  controller: RoomController;
  players: PlayerDTO[];
}) {
  const [items, setItems] = useState<FloatingReaction[]>([]);

  useEffect(
    () =>
      controller.onReaction((reaction) => {
        const view = controller.puzzleView;
        if (!view) return;
        const screen = view.camera.toScreen(reaction.x, reaction.y);
        const color = players.find((p) => p.id === reaction.playerId)?.color ?? "#6C5CE7";
        const item = {
          ...reaction,
          screenX: screen.x,
          screenY: screen.y,
          color,
          drift: Math.random() * 40 - 20,
        };
        setItems((current) => [...current.slice(-30), item]);
        window.setTimeout(
          () => setItems((current) => current.filter((i) => i.id !== reaction.id)),
          LIFETIME_MS,
        );
      }),
    [controller, players],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute text-4xl motion-safe:animate-[float-up_1.8s_ease-out_forwards] motion-reduce:animate-[fade-out_1.8s_ease-out_forwards]"
          style={
            {
              left: item.screenX,
              top: item.screenY,
              "--drift": `${item.drift}px`,
              filter: `drop-shadow(0 2px 0 ${item.color}) drop-shadow(0 4px 8px rgb(0 0 0 / 0.25))`,
            } as React.CSSProperties
          }
        >
          {item.emoji}
        </span>
      ))}
    </div>
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
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          title={`${emoji}  (${index + 1})`}
          aria-label={`Reaksiya ${emoji}`}
          className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:scale-95"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
