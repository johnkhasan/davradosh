"use client";

import type { PlayerDTO } from "@puzzle/shared";
import { useEffect, useRef, type PointerEvent } from "react";
import type { RoomController } from "@/lib/realtime/room-controller";

const WIDTH = 200;
const MIN_HEIGHT = 90;
const MAX_HEIGHT = 150;

type Rect = { x: number; y: number; width: number; height: number };

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/**
 * Overview of the whole table: pieces, the board, and every player's view in
 * their colour. Click or drag to move your own view.
 */
export function Minimap({
  controller,
  players,
  me,
}: {
  controller: RoomController;
  players: PlayerDTO[];
  me: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapping = useRef<{ bounds: Rect; scale: number } | null>(null);
  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = () => {
      const view = controller.puzzleView;
      const state = controller.puzzleState;
      if (!view || !state) return;
      const { cols, pieceWidth: pw, pieceHeight: ph, rows } = state.config;

      let bounds = view.worldBounds();
      const mine = view.viewportRect();
      bounds = union(bounds, mine);
      for (const rect of controller.viewports.values()) bounds = union(bounds, rect);
      const pad = Math.max(bounds.width, bounds.height) * 0.03;
      bounds = {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + pad * 2,
        height: bounds.height + pad * 2,
      };

      const height = Math.round(
        Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, (WIDTH * bounds.height) / bounds.width)),
      );
      if (canvas.height !== height * dpr) {
        canvas.width = WIDTH * dpr;
        canvas.height = height * dpr;
        canvas.style.height = `${height}px`;
      }
      const scale = Math.min(WIDTH / bounds.width, height / bounds.height);
      const ox = (WIDTH - bounds.width * scale) / 2;
      const oy = (height - bounds.height * scale) / 2;
      mapping.current = {
        bounds: { ...bounds, x: bounds.x - ox / scale, y: bounds.y - oy / scale },
        scale,
      };
      const toX = (x: number) => ox + (x - bounds.x) * scale;
      const toY = (y: number) => oy + (y - bounds.y) * scale;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WIDTH, height);

      // Board frame
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(toX(0), toY(0), cols * pw * scale, rows * ph * scale);

      // Pieces
      for (const group of state.allGroups()) {
        ctx.fillStyle = group.placed
          ? "rgba(0,194,168,0.85)"
          : group.pieceIds.length > 1
            ? "rgba(255,210,120,0.95)"
            : "rgba(255,255,255,0.75)";
        for (const pieceId of group.pieceIds) {
          const x = group.x + (pieceId % cols) * pw;
          const y = group.y + Math.floor(pieceId / cols) * ph;
          ctx.fillRect(
            toX(x),
            toY(y),
            Math.max(1, pw * scale - 0.5),
            Math.max(1, ph * scale - 0.5),
          );
        }
      }

      // Other players' views
      ctx.lineWidth = 1.5;
      for (const [playerId, rect] of controller.viewports) {
        const player = playersRef.current.find((p) => p.id === playerId);
        if (!player?.connected) continue;
        ctx.strokeStyle = player.color;
        ctx.strokeRect(toX(rect.x), toY(rect.y), rect.width * scale, rect.height * scale);
      }
      // Our own view
      ctx.strokeStyle = "white";
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(toX(mine.x), toY(mine.y), mine.width * scale, mine.height * scale);
      ctx.setLineDash([]);
    };

    draw();
    const timer = window.setInterval(draw, 120);
    return () => window.clearInterval(timer);
  }, [controller, me]);

  const jump = (event: PointerEvent<HTMLCanvasElement>) => {
    const map = mapping.current;
    const view = controller.puzzleView;
    if (!map || !view) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = map.bounds.x + (event.clientX - rect.left) / map.scale;
    const y = map.bounds.y + (event.clientY - rect.top) / map.scale;
    view.centerOn(x, y, event.type === "pointerdown");
  };

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={MIN_HEIGHT}
      style={{ width: WIDTH, height: MIN_HEIGHT }}
      className="block cursor-pointer touch-none rounded-control bg-black/35"
      aria-label="Minimap: bosib ko'rinishni siljiting"
      role="img"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && jump(e)}
    />
  );
}
