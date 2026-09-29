"use client";

import type { PlayerDTO } from "@puzzle/shared";
import { useEffect, useRef } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";
import type { VoiceController, VoiceSnapshot } from "@/lib/realtime/voice-controller";

const IDLE_FADE_MS = 5000;

interface CursorLayerProps {
  controller: RoomController;
  players: PlayerDTO[];
  me: string;
  holding: Record<string, number>;
  voice?: VoiceController | null;
  voiceSnapshot?: VoiceSnapshot | null;
}

/**
 * Figma-style remote cursors: a coloured arrow with a name pill.
 * Positions are interpolated every frame and written straight to the DOM,
 * so 25 Hz network updates look like smooth 60+ fps motion without React renders.
 * With voice on, the pill "breathes" with the speaker's microphone level.
 */
export function CursorLayer({
  controller,
  players,
  me,
  holding,
  voice,
  voiceSnapshot,
}: CursorLayerProps) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const pills = useRef(new Map<string, HTMLSpanElement>());
  const others = players.filter((p) => p.id !== me && p.connected);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();
    let lastSpatial = 0;
    const levels = new Map<string, number>();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const view = controller.puzzleView;
      for (const [playerId, node] of nodes.current) {
        const cursor = controller.cursors.get(playerId);
        if (!cursor || !view) {
          node.style.opacity = "0";
          continue;
        }
        // Same buffered playback as remote drags, so a cursor stays glued to the piece it carries.
        const pos = cursor.motion.sample(now);
        if (pos) {
          cursor.x = pos.x;
          cursor.y = pos.y;
        }
        const screen = view.camera.toScreen(cursor.x, cursor.y);
        node.style.transform = `translate3d(${screen.x}px, ${screen.y}px, 0)`;
        const level = voice ? voice.audioLevel(playerId) : 0;
        const speaking = level > 0.02;
        node.style.opacity = !speaking && now - cursor.lastMoveAt > IDLE_FADE_MS ? "0.35" : "1";

        const pill = pills.current.get(playerId);
        if (pill) {
          // Smooth the level so the halo breathes instead of flickering.
          const smoothed =
            (levels.get(playerId) ?? 0) +
            (level - (levels.get(playerId) ?? 0)) * Math.min(1, dt / 80);
          levels.set(playerId, smoothed);
          const color = pill.dataset.color ?? "#fff";
          const spread = reducedMotion.current ? (speaking ? 3 : 0) : Math.min(10, smoothed * 40);
          pill.style.boxShadow =
            spread > 0.3
              ? `0 0 0 ${spread}px ${color}55, 0 0 ${spread * 2}px ${color}88`
              : "0 4px 6px rgb(0 0 0 / 0.15)";
        }
      }

      // Distance-based volume, a few times per second is plenty.
      if (voice && view && now - lastSpatial > 200) {
        lastSpatial = now;
        const positions = new Map<string, { x: number; y: number }>();
        for (const [id, cursor] of controller.cursors) positions.set(id, cursor);
        const bounds = view.worldBounds();
        voice.updateSpatial(controller.pointer, positions, Math.hypot(bounds.width, bounds.height));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller, voice]);

  const micLive = voiceSnapshot?.status === "connected" ? voiceSnapshot.micLive : null;
  const faces = voiceSnapshot?.facesOnCursors ? new Set(voiceSnapshot.cameras) : null;

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
            ref={(node) => {
              if (node) pills.current.set(player.id, node);
              else pills.current.delete(player.id);
            }}
            data-color={player.color}
            className="absolute top-4 left-3.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-md transition-[box-shadow] duration-75"
            style={{ backgroundColor: player.color }}
          >
            {player.name}
            {holding[player.id] !== undefined && <span>🧩</span>}
            {micLive && !micLive[player.id] && <span className="opacity-80">🔇</span>}
          </span>
          {faces?.has(player.id) && voice && (
            <CursorFace voice={voice} player={player} trackKey={voiceSnapshot!.cameras.join(",")} />
          )}
        </div>
      ))}
    </div>
  );
}

/** "Faces on cursors" mode: the player's camera in a small circle next to their cursor. */
function CursorFace({
  voice,
  player,
  trackKey,
}: {
  voice: VoiceController;
  player: PlayerDTO;
  trackKey: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return voice.attachCamera(player.id, element);
  }, [voice, player.id, trackKey]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="absolute top-10 left-3 size-12 max-w-none rounded-full object-cover shadow-md"
      style={{ boxShadow: `0 0 0 2px ${player.color}` }}
    />
  );
}
