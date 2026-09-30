"use client";

import { REACTION_EMOJIS, type PlayerDTO, type ReactionEmoji } from "@puzzle/shared";
import { SmilePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** Touch screens: a button that opens the reactions as a 4×2 grid; it stays open for several taps. */
export function ReactionPicker({ onReact }: { onReact: (emoji: ReactionEmoji) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="flex flex-col items-end gap-2">
      {open && (
        <div
          role="toolbar"
          aria-label="Reaksiyalar"
          className="grid grid-cols-4 gap-1 rounded-card border border-border bg-surface/95 p-1.5 shadow-soft-lg backdrop-blur motion-safe:animate-[pop_150ms_ease-out]"
        >
          {REACTION_EMOJIS.map((emoji, index) => (
            <ReactionButton key={emoji} emoji={emoji} index={index} onReact={onReact} size="lg" />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Reaksiyalarni yopish" : "Reaksiya yuborish"}
        className="flex size-12 touch-manipulation items-center justify-center rounded-full border border-border bg-surface/95 text-foreground shadow-soft-md backdrop-blur active:scale-95"
      >
        {open ? <X className="size-5" aria-hidden /> : <SmilePlus className="size-5" aria-hidden />}
      </button>
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
        <ReactionButton key={emoji} emoji={emoji} index={index} onReact={onReact} />
      ))}
    </div>
  );
}
