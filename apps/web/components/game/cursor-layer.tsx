"use client";

import type { PlayerDTO } from "@puzzle/shared";
import { useEffect, useRef } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";

const IDLE_FADE_MS = 5000;

interface CursorLayerProps {
  controller: RoomController;
  players: PlayerDTO[];
  me: string;
  holding: Record<string, number>;
}

/**
 * Figma-style remote cursors: a coloured arrow with a name pill.
 * Positions are interpolated every frame and written straight to the DOM,
 * so 25 Hz network updates look like smooth 60+ fps motion without React renders.
 */
export function CursorLayer({ controller, players, me, holding }: CursorLayerProps) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const others = players.filter((p) => p.id !== me && p.connected);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const view = controller.puzzleView;
      // Exponential smoothing: ~50 ms time constant, frame-rate independent.
      const k = 1 - Math.exp(-dt / 50);
      for (const [playerId, node] of nodes.current) {
        const cursor = controller.cursors.get(playerId);
        if (!cursor || !view) {
          node.style.opacity = "0";
          continue;
        }
        cursor.x += (cursor.targetX - cursor.x) * k;
        cursor.y += (cursor.targetY - cursor.y) * k;
        const screen = view.camera.toScreen(cursor.x, cursor.y);
        node.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0)`;
        node.style.opacity = now - cursor.lastMoveAt > IDLE_FADE_MS ? "0.35" : "1";
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {others.map((player) => (
        <div
          key={player.id}
          ref={(node) => {
            if (node) nodes.current.set(player.id, node);
            else nodes.current.delete(player.id);
          }}
          className="absolute top-0 left-0 opacity-0 transition-opacity duration-300 will-change-transform"
        >
          <svg width="20" height="22" viewBox="0 0 20 22" className="drop-shadow-md">
            <path
              d="M2 1.5 L17.5 10.2 L10.4 11.7 L7 18.8 Z"
              fill={player.color}
              stroke="white"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="absolute top-4 left-3.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-md"
            style={{ backgroundColor: player.color }}
          >
            {player.name}
            {holding[player.id] !== undefined && <span>🧩</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
