"use client";

import { generatePieceShapes, type PathCommand } from "@puzzle/shared";
import { useEffect, useMemo, useRef } from "react";

const COLS = 4;
const ROWS = 3;
const W = 480;
const H = 360;
const PW = W / COLS;
const PH = H / ROWS;

const PLAYERS = [
  { name: "Malika", color: "#E84393" },
  { name: "Jasur", color: "#0984E3" },
  { name: "Aziz", color: "#00B894" },
];

/** Seconds: each piece is picked up, carried and dropped by one of the fake players. */
const STEP = 0.9;
const CARRY = 0.75;
const HOLD = 2.2;
const CYCLE = COLS * ROWS * STEP + CARRY + HOLD;

/** SVG path in absolute picture coordinates (offset by the piece's cell). */
function toSvgPath(path: PathCommand[], ox: number, oy: number) {
  return path
    .map((c) =>
      c.type === "C"
        ? `C${c.x1 + ox} ${c.y1 + oy} ${c.x2 + ox} ${c.y2 + oy} ${c.x + ox} ${c.y + oy}`
        : `${c.type}${c.x + ox} ${c.y + oy}`,
    )
    .join("");
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Self-playing hero animation: three named cursors assemble a small jigsaw,
 * explaining the product without a single word. Pure SVG + rAF, no canvas,
 * static (finished puzzle) when the user prefers reduced motion.
 */
export function HeroDemo() {
  const pieces = useMemo(() => {
    const shapes = generatePieceShapes({
      cols: COLS,
      rows: ROWS,
      pieceWidth: PW,
      pieceHeight: PH,
      seed: 11,
    });
    // Deterministic scatter around the board.
    const spots = [
      [-150, -60],
      [560, -40],
      [-170, 120],
      [600, 150],
      [-120, 300],
      [590, 320],
      [60, -150],
      [300, -160],
      [120, 430],
      [380, 440],
      [-190, 420],
      [630, -130],
    ];
    const order = [0, 5, 10, 3, 1, 6, 11, 8, 2, 7, 4, 9];
    return shapes.map((shape) => {
      const index = order.indexOf(shape.id);
      const [sx, sy] = spots[index]!;
      return {
        id: shape.id,
        d: toSvgPath(shape.path, shape.col * PW, shape.row * PH),
        tx: shape.col * PW,
        ty: shape.row * PH,
        sx: sx!,
        sy: sy!,
        start: index * STEP,
        owner: index % PLAYERS.length,
        rot: ((index * 37) % 30) - 15,
      };
    });
  }, []);

  const pieceRefs = useRef<Array<SVGGElement | null>>([]);
  const cursorRefs = useRef<Array<SVGGElement | null>>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const begin = performance.now();

    // Where each idle cursor waits, spread around the board.
    const rest = [
      { x: -90, y: H + 50 },
      { x: W + 70, y: H * 0.45 },
      { x: W * 0.45, y: -80 },
    ];
    const cursors = rest.map((spot) => ({ ...spot }));
    let last = performance.now();

    const render = (now: number) => {
      const t = reduced ? CYCLE - HOLD / 2 : ((now - begin) / 1000) % CYCLE;
      const dt = Math.min(100, now - last);
      last = now;
      const fade = t > CYCLE - 0.4 ? (CYCLE - t) / 0.4 : 1;

      const positions = new Map<number, { x: number; y: number; p: number }>();
      for (const piece of pieces) {
        const node = pieceRefs.current[piece.id];
        const p = Math.min(1, Math.max(0, (t - piece.start) / CARRY));
        const e = ease(p);
        const x = piece.sx + (piece.tx - piece.sx) * e;
        const y = piece.sy + (piece.ty - piece.sy) * e;
        positions.set(piece.id, { x, y, p });
        if (!node) continue;
        const rot = piece.rot * (1 - e);
        const lifted = p > 0 && p < 1;
        node.setAttribute("transform", `translate(${x} ${y}) rotate(${rot} ${PW / 2} ${PH / 2})`);
        node.style.filter = lifted
          ? "drop-shadow(0 14px 14px rgb(0 0 0 / 0.35))"
          : "drop-shadow(0 3px 4px rgb(0 0 0 / 0.25))";
        node.style.opacity = String(fade);
      }

      PLAYERS.forEach((_, owner) => {
        // The owner's most recent piece whose approach has begun decides where the cursor goes.
        let current: (typeof pieces)[number] | null = null;
        for (const piece of pieces) {
          if (piece.owner !== owner || piece.start - STEP * 0.6 > t) continue;
          if (!current || piece.start > current.start) current = piece;
        }
        let target = rest[owner]!;
        let carrying = false;
        if (current) {
          const pos = positions.get(current.id)!;
          const grab = { x: pos.x + PW * 0.55, y: pos.y + PH * 0.5 };
          const sinceDrop = t - current.start - CARRY;
          if (pos.p > 0 && pos.p < 1) {
            target = grab;
            carrying = true;
          } else if (pos.p === 0 || sinceDrop < 1) {
            target =
              pos.p === 0 ? grab : { x: grab.x + sinceDrop * 30, y: grab.y + sinceDrop * 20 };
          }
        }
        const cursor = cursors[owner]!;
        if (carrying || reduced) {
          cursor.x = target.x;
          cursor.y = target.y;
        } else {
          const k = 1 - Math.exp(-dt / 110);
          cursor.x += (target.x - cursor.x) * k;
          cursor.y += (target.y - cursor.y) * k;
        }
        const node = cursorRefs.current[owner];
        if (!node) return;
        node.setAttribute("transform", `translate(${cursor.x} ${cursor.y})`);
        node.style.opacity = String(fade);
      });

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [pieces]);

  return (
    <svg
      viewBox="-220 -190 920 700"
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Uch kishi bitta puzzle'ni birga yig'moqda"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1b67" />
          <stop offset="0.5" stopColor="#c2477a" />
          <stop offset="1" stopColor="#ffb86b" />
        </linearGradient>
        <radialGradient id="hero-sun" cx="0.68" cy="0.52" r="0.3">
          <stop offset="0" stopColor="#fff1c7" />
          <stop offset="0.35" stopColor="#ffd08a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb86b" stopOpacity="0" />
        </radialGradient>
        {/* The picture: one scene, shared by every piece through userSpaceOnUse. */}
        <pattern id="hero-picture" patternUnits="userSpaceOnUse" width={W} height={H}>
          <rect width={W} height={H} fill="url(#hero-sky)" />
          <rect width={W} height={H} fill="url(#hero-sun)" />
          <circle cx={W * 0.68} cy={H * 0.52} r={34} fill="#fff1c7" />
          <path
            d={`M0 ${H} L0 230 L70 170 L130 220 L210 140 L290 215 L360 160 L430 210 L${W} 180 L${W} ${H}Z`}
            fill="#6a2e70"
          />
          <path
            d={`M0 ${H} L0 270 L90 225 L170 270 L250 215 L340 265 L420 235 L${W} 260 L${W} ${H}Z`}
            fill="#3d235e"
          />
          <path
            d={`M0 ${H} L0 310 L110 285 L220 315 L330 290 L${W} 305 L${W} ${H}Z`}
            fill="#1c1238"
          />
          {[40, 95, 150, 330, 380, 440].map((x, i) => (
            <path key={x} d={`M${x} ${320 - (i % 3) * 8} l-14 36 h28z`} fill="#0d0920" />
          ))}
        </pattern>
      </defs>

      {/* Board frame */}
      <rect
        x={-8}
        y={-8}
        width={W + 16}
        height={H + 16}
        rx={14}
        fill="rgb(0 0 0 / 0.16)"
        stroke="rgb(255 255 255 / 0.4)"
        strokeWidth={2}
        strokeDasharray="8 8"
      />

      {pieces.map((piece) => (
        <g key={piece.id} ref={(node) => void (pieceRefs.current[piece.id] = node)}>
          {/* The path is in picture coordinates, so the shared pattern shows the right part;
              the group moves it back to the piece's own origin. */}
          <g transform={`translate(${-piece.tx} ${-piece.ty})`}>
            <path d={piece.d} fill="url(#hero-picture)" />
            <path d={piece.d} fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth={1.5} />
          </g>
        </g>
      ))}

      {PLAYERS.map((player, i) => (
        <g key={player.name} ref={(node) => void (cursorRefs.current[i] = node)}>
          <path
            d="M0 0 L20 11 L11 13 L7 22 Z"
            fill={player.color}
            stroke="white"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <g transform="translate(16 22)">
            <rect width={player.name.length * 10 + 22} height={26} rx={13} fill={player.color} />
            <text
              x={11}
              y={18}
              fill="white"
              fontSize={15}
              fontWeight={600}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {player.name}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
