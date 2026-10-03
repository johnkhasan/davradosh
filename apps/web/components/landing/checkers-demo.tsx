"use client";

import { useEffect, useRef } from "react";
import { DARK_SQUARE, LIGHT_SQUARE } from "@/components/games/checkers/board-art";

const CELL = 100;
const M = 50;
const BOARD = CELL * 8;
const W = BOARD + M * 2;
const H = W + 84;
const FILES = "abcdefgh";

type Cell = readonly [number, number];

// The story, in seconds (display cells: x = file a–h, y = 0 at rank 8).
// White c3–d4, black blunders d6–e5, white must capture: d4:f6:d8, crowned on d8, then flies.
const HERO_PATH: { at: number; to: Cell; dur: number; hop?: boolean }[] = [
  { at: 0.7, to: [3, 4], dur: 0.5 },
  { at: 4.8, to: [5, 2], dur: 0.6, hop: true },
  { at: 5.8, to: [3, 0], dur: 0.6, hop: true },
  { at: 9.0, to: [7, 4], dur: 1.0 },
];
const HERO_START: Cell = [2, 5];
const BAIT_FROM: Cell = [3, 2];
const BAIT_TO: Cell = [4, 3];
const BAIT_AT = 2.3;
const VICTIM: Cell = [4, 1];
const TAKE_1 = 5.1;
const TAKE_2 = 6.1;
const HINT_FROM = 3.6;
const HINT_TO = 4.8;
const CROWN_AT = 6.9;
const CYCLE = 12;
const FADE = 0.5;
/** Fresh king on d8: what reduced motion shows. */
const STILL = 8.2;

const WHITE: Cell[] = [
  [0, 5],
  [6, 5],
  [1, 6],
  [5, 6],
  [7, 6],
  [2, 7],
  [4, 7],
];
const BLACK: Cell[] = [
  [1, 0],
  [5, 0],
  [7, 0],
  [0, 1],
  [2, 1],
];
/** Black's reply after the crowning (g7–h6), so the king moves on its own turn. */
const REPLY_FROM: Cell = [6, 1];
const REPLY_TO: Cell = [7, 2];
const REPLY_AT = 8.3;

const CAPTIONS = [
  { from: 0.3, to: 2.2, text: "⚪ Oqlar yuradi" },
  { from: 2.2, to: HINT_FROM, text: "⚫ Qoralar javob beradi" },
  { from: HINT_FROM, to: 5.7, text: "Urish majburiy!" },
  { from: 5.7, to: CROWN_AT, text: "💥 Ikki donani urdi!" },
  { from: CROWN_AT, to: 9.0, text: "👑 Dama!" },
  { from: 9.0, to: CYCLE, text: "Dama uzoqqa uchadi" },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
/** 0 → 1 → 0 over [a, b], with soft edges. */
const win = (t: number, a: number, b: number, edge = 0.25) =>
  clamp(Math.min((t - a) / edge, (b - t) / edge));

const origin = ([x, y]: Cell) => ({ x: M + x * CELL, y: M + y * CELL });

/** Transform that draws the 100-unit piece art on a board cell, lifted by `lift` (0–1). */
const place = (x: number, y: number, lift = 0) => {
  const s = 0.86 * (1 + lift * 0.16);
  const half = (CELL * s) / 2;
  return `translate(${x + CELL / 2 - half} ${y + CELL / 2 - half - lift * 18}) scale(${s})`;
};

/** Where the capturing piece is at time t, and how high it is lifted. */
function heroAt(t: number) {
  let from = origin(HERO_START);
  for (const step of HERO_PATH) {
    const to = origin(step.to);
    if (t < step.at) break;
    const p = clamp((t - step.at) / step.dur);
    if (p < 1) {
      const e = ease(p);
      return {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        lift: step.hop ? Math.sin(Math.PI * p) : 0.25 * Math.sin(Math.PI * p),
      };
    }
    from = to;
  }
  return { ...from, lift: 0 };
}

function PieceShape({ white }: { white: boolean }) {
  const groove = white ? "rgba(120, 90, 50, 0.45)" : "rgba(255, 255, 255, 0.14)";
  return (
    <>
      <ellipse cx="51" cy="56" rx="39" ry="38" fill="rgba(0, 0, 0, 0.38)" />
      <circle
        cx="50"
        cy="50"
        r="39"
        fill={`url(#ckd-${white ? "w" : "b"})`}
        stroke={white ? "#a88b5e" : "#000"}
        strokeWidth="1.5"
      />
      <circle cx="50" cy="50" r="29" fill="none" stroke={groove} strokeWidth="2" />
      <circle cx="50" cy="50" r="20" fill="none" stroke={groove} strokeWidth="1.5" />
    </>
  );
}

/**
 * Self-playing hero animation for the checkers landing: a quiet move, a blunder, a forced
 * double capture that lands on the last row, the crowning and a flying king. Pure SVG + rAF
 * like the puzzle and mafia demos; a still frame with the new king for reduced motion.
 */
export function CheckersDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el: Record<string, SVGElement> = {};
    svgRef.current
      ?.querySelectorAll<SVGElement>("[data-k]")
      .forEach((node) => (el[node.dataset.k!] = node));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const begin = performance.now();
    let frame = 0;
    const set = (key: string, attr: string, value: string | number) =>
      el[key]?.setAttribute(attr, String(value));
    const show = (key: string, opacity: number) => {
      const node = el[key];
      if (node) node.style.opacity = String(opacity);
    };

    const render = (now: number) => {
      const t = reduced ? STILL : ((now - begin) / 1000) % CYCLE;
      show("scene", reduced ? 1 : Math.min(1, t / FADE, (CYCLE - t) / FADE));

      const hero = heroAt(t);
      set("hero", "transform", place(hero.x, hero.y, hero.lift));

      // The blunder: d6–e5, right next to the white piece.
      const a = origin(BAIT_FROM);
      const b = origin(BAIT_TO);
      const p = ease(clamp((t - BAIT_AT) / 0.5));
      const lift = 0.25 * Math.sin(Math.PI * clamp((t - BAIT_AT) / 0.5));
      set("bait", "transform", place(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, lift));
      show("bait", 1 - clamp((t - TAKE_1) / 0.35));
      const r0 = origin(REPLY_FROM);
      const r1 = origin(REPLY_TO);
      const rp = clamp((t - REPLY_AT) / 0.5);
      set(
        "reply",
        "transform",
        place(
          r0.x + (r1.x - r0.x) * ease(rp),
          r0.y + (r1.y - r0.y) * ease(rp),
          0.25 * Math.sin(Math.PI * rp),
        ),
      );
      show("victim", 1 - clamp((t - TAKE_2) / 0.35));

      // The forced capture: the piece and its landing squares light up.
      const hint = win(t, HINT_FROM, HINT_TO);
      show("hint", hint);
      show("select", win(t, HINT_FROM, TAKE_2 + 0.3));
      show("from", win(t, 1.0, HINT_FROM));
      show("trail", win(t, TAKE_1, CROWN_AT + 0.6));

      // The crown pops in on d8.
      const c = clamp((t - CROWN_AT) / 0.35);
      show("crown", c);
      set(
        "crown",
        "transform",
        `translate(50 50) scale(${0.4 + 0.6 * c + Math.sin(c * Math.PI) * 0.25}) translate(-50 -50)`,
      );
      show("glow", win(t, CROWN_AT, CROWN_AT + 1.6, 0.4));

      CAPTIONS.forEach((caption, i) => show(`caption-${i}`, win(t, caption.from, caption.to)));

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const start = origin(HERO_START);
  const bait = origin(BAIT_FROM);
  const victim = origin(VICTIM);
  const d4 = origin([3, 4]);
  const f6 = origin([5, 2]);
  const d8 = origin([3, 0]);
  const centre = (c: { x: number; y: number }) => `${c.x + CELL / 2} ${c.y + CELL / 2}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Shashka taxtasi: oq dona ikki qora donani ketma-ket urib, oxirgi qatorga yetadi va damkaga aylanadi"
    >
      <defs>
        <linearGradient id="ckd-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#845633" />
          <stop offset="0.55" stopColor="#5d3a20" />
          <stop offset="1" stopColor="#4a2c17" />
        </linearGradient>
        <radialGradient id="ckd-w" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="55%" stopColor="#efe0bf" />
          <stop offset="100%" stopColor="#c2a87c" />
        </radialGradient>
        <radialGradient id="ckd-b" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#5b5b66" />
          <stop offset="50%" stopColor="#2a2a31" />
          <stop offset="100%" stopColor="#0b0b0e" />
        </radialGradient>
        <linearGradient id="ckd-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#c8901f" />
        </linearGradient>
        <radialGradient id="ckd-glow">
          <stop offset="0" stopColor="#ffe08a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe08a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g data-k="scene">
        <rect width={W} height={W} rx={27} fill="url(#ckd-frame)" />
        {[...FILES].map((f, i) => (
          <text
            key={f}
            x={M + i * CELL + CELL / 2}
            y={W - 16}
            textAnchor="middle"
            fill="#f3e3c3"
            fillOpacity={0.85}
            fontSize={24}
            fontWeight={600}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {f}
          </text>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <text
            key={i}
            x={M / 2}
            y={M + i * CELL + CELL / 2 + 8}
            textAnchor="middle"
            fill="#f3e3c3"
            fillOpacity={0.85}
            fontSize={24}
            fontWeight={600}
            fontFamily="Inter, system-ui, sans-serif"
          >
            {8 - i}
          </text>
        ))}

        <g shapeRendering="crispEdges">
          <rect x={M} y={M} width={BOARD} height={BOARD} fill={LIGHT_SQUARE} />
          {Array.from({ length: 64 }, (_, i) => {
            const x = i % 8;
            const y = Math.floor(i / 8);
            return (x + y) % 2 === 1 ? (
              <rect
                key={i}
                x={M + x * CELL}
                y={M + y * CELL}
                width={CELL}
                height={CELL}
                fill={DARK_SQUARE}
              />
            ) : null;
          })}
        </g>
        <rect
          x={M}
          y={M}
          width={BOARD}
          height={BOARD}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={4}
        />

        {/* Where the white piece came from, then the capture's path. */}
        <rect
          data-k="from"
          opacity={0}
          x={start.x}
          y={start.y}
          width={CELL}
          height={CELL}
          fill="#f6e7c3"
          fillOpacity={0.12}
        />
        <path
          data-k="trail"
          d={`M${centre(d4)}L${centre(f6)}L${centre(d8)}`}
          fill="none"
          stroke="#ffd166"
          strokeWidth={8}
          strokeDasharray="4 16"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0}
        />
        <g data-k="hint" opacity={0}>
          {[f6, d8].map((c) => (
            <circle
              key={`${c.x}-${c.y}`}
              cx={c.x + CELL / 2}
              cy={c.y + CELL / 2}
              r={15}
              fill="#f6e7c3"
              fillOpacity={0.75}
            />
          ))}
        </g>

        {WHITE.map((c) => {
          const o = origin(c);
          return (
            <g key={`w${c}`} transform={place(o.x, o.y)}>
              <PieceShape white />
            </g>
          );
        })}
        {BLACK.map((c) => {
          const o = origin(c);
          return (
            <g key={`b${c}`} transform={place(o.x, o.y)}>
              <PieceShape white={false} />
            </g>
          );
        })}
        <g data-k="victim" transform={place(victim.x, victim.y)}>
          <PieceShape white={false} />
        </g>
        <g data-k="reply" transform={place(origin(REPLY_FROM).x, origin(REPLY_FROM).y)}>
          <PieceShape white={false} />
        </g>
        <g data-k="bait" transform={place(bait.x, bait.y)}>
          <PieceShape white={false} />
        </g>

        <g data-k="hero" transform={place(start.x, start.y)}>
          <circle data-k="glow" cx="50" cy="50" r="70" fill="url(#ckd-glow)" opacity={0} />
          <circle
            data-k="select"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#ffd166"
            strokeWidth={6}
            opacity={0}
          />
          <PieceShape white />
          <g data-k="crown" opacity={0}>
            <g stroke="#7a5414" strokeWidth="1.6" strokeLinejoin="round">
              <path d="M29 61 L26 37 L39 48 L50 31 L61 48 L74 37 L71 61 Z" fill="url(#ckd-gold)" />
              <rect x="29" y="63" width="42" height="6" rx="2" fill="url(#ckd-gold)" />
              <circle cx="50" cy="31" r="3" fill="#fff3c4" />
            </g>
          </g>
        </g>

        {CAPTIONS.map((caption, i) => {
          const width = caption.text.length * 15 + 56;
          return (
            <g key={caption.text} data-k={`caption-${i}`} opacity={0}>
              <rect
                x={W / 2 - width / 2}
                y={W + 14}
                width={width}
                height={56}
                rx={28}
                fill="#1c1a24"
              />
              <text
                x={W / 2}
                y={W + 51}
                textAnchor="middle"
                fill="white"
                fontSize={26}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {caption.text}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
