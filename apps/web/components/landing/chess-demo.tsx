"use client";

import { useEffect, useRef } from "react";
import {
  ChessPiece,
  DARK_SQUARE,
  HIGHLIGHT,
  LIGHT_SQUARE,
  parsePlacement,
} from "@/components/games/chess/pieces";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

// The story, in seconds: a scholar's mate. 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
const MOVES = [
  { from: "e2", to: "e4", at: 0.8 },
  { from: "e7", to: "e5", at: 2.0 },
  { from: "f1", to: "c4", at: 3.2 },
  { from: "b8", to: "c6", at: 4.4 },
  { from: "d1", to: "h5", at: 5.6 },
  { from: "g8", to: "f6", at: 6.8 },
  { from: "h5", to: "f7", at: 8.2 },
];
const GLIDE = 0.45;
const MATE_AT = MOVES[MOVES.length - 1]!.at + GLIDE;
const CYCLE = 13.5;
const FADE = 0.5;
/** The mate on the board: what reduced motion shows. */
const STILL = 11;
/** Clock seconds burnt per real second, so the clocks visibly run. */
const CLOCK_SPEED = 4;
const CLOCK_START = 5 * 60;

const CAPTIONS = [
  { from: 0.5, to: 5.4, text: "Debyut: markaz uchun kurash" },
  { from: 5.6, to: 8.1, text: "Farzin f7 ga ko'z tikdi 👀" },
  { from: MATE_AT + 0.2, to: CYCLE, text: "Mat! Oqlar yutdi 🏆" },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 → 0 over [a, b], with soft edges. */
const win = (t: number, a: number, b: number, edge = 0.3) =>
  clamp(Math.min((t - a) / edge, (b - t) / edge));
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/** Column and row (rank 8 is row 0) of a square like "e4". */
const cell = (square: string) => ({
  c: square.charCodeAt(0) - 97,
  r: 8 - Number(square[1]),
});

/** Every piece of the start position with its square, as a stable list. */
const PIECES = parsePlacement(START).flatMap((row, r) =>
  row.flatMap((piece, c) =>
    piece ? [{ piece, square: `${"abcdefgh"[c]}${8 - r}`, key: `${piece}-${r}-${c}` }] : [],
  ),
);

/** Where a piece that started on `square` is at time t, and when it was captured. */
function track(square: string, t: number) {
  let at = cell(square);
  let current = square;
  let capturedAt: number | null = null;
  for (const move of MOVES) {
    if (move.at > t) {
      if (move.to === current && capturedAt === null) capturedAt = move.at;
      continue;
    }
    if (move.to === current) {
      capturedAt = move.at;
      break;
    }
    if (move.from !== current) continue;
    const p = ease(clamp((t - move.at) / GLIDE));
    const a = cell(move.from);
    const b = cell(move.to);
    at = { c: a.c + (b.c - a.c) * p, r: a.r + (b.r - a.r) * p };
    current = move.to;
  }
  return { at, capturedAt };
}

const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Self-playing hero animation for the chess landing: two friends play a scholar's mate,
 * pieces gliding, last moves highlighted, clocks ticking, then the mate glows and it loops.
 * The board is HTML (the piece art is SVG); a still mate when the user prefers reduced motion.
 */
export function ChessDemo() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Animated parts are tagged with data-k; collect them once instead of a ref per element.
    const el: Record<string, HTMLElement> = {};
    rootRef.current
      ?.querySelectorAll<HTMLElement>("[data-k]")
      .forEach((node) => (el[node.dataset.k!] = node));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const begin = performance.now();
    let frame = 0;
    const show = (key: string, opacity: number) => {
      const node = el[key];
      if (node) node.style.opacity = String(opacity);
    };
    const place = (key: string, c: number, r: number) => {
      const node = el[key];
      if (node) node.style.transform = `translate(${c * 100}%, ${r * 100}%)`;
    };

    const render = (now: number) => {
      const t = reduced ? STILL : ((now - begin) / 1000) % CYCLE;
      show("scene", reduced ? 1 : Math.min(1, t / FADE, (CYCLE - t) / FADE));

      for (const { square, key } of PIECES) {
        const { at, capturedAt } = track(square, t);
        place(key, at.c, at.r);
        // A captured piece fades as the capturer lands on it.
        show(key, capturedAt === null ? 1 : 1 - clamp((t - capturedAt - GLIDE * 0.6) / 0.25));
      }

      // Last move: both squares tinted.
      const last = [...MOVES].reverse().find((m) => m.at <= t);
      show("hl-from", last ? 1 : 0);
      show("hl-to", last ? 1 : 0);
      if (last) {
        const a = cell(last.from);
        const b = cell(last.to);
        place("hl-from", a.c, a.r);
        place("hl-to", b.c, b.r);
      }

      // Mate: the black king's square glows red.
      show("mate", t >= MATE_AT ? 0.8 + Math.sin((t - MATE_AT) * 5) * 0.2 : 0);

      // Clocks: whoever is to move burns time.
      let white = CLOCK_START;
      let black = CLOCK_START;
      let since = 0;
      let whiteToMove = true;
      for (const move of MOVES) {
        const until = Math.min(t, move.at);
        if (until > since) {
          if (whiteToMove) white -= (until - since) * CLOCK_SPEED;
          else black -= (until - since) * CLOCK_SPEED;
        }
        if (move.at > t) break;
        since = move.at;
        whiteToMove = !whiteToMove;
      }
      const over = t >= MATE_AT;
      if (el["clock-w"]) el["clock-w"].textContent = formatClock(white);
      if (el["clock-b"]) el["clock-b"].textContent = formatClock(black);
      el["clock-w"]?.toggleAttribute("data-active", !over && whiteToMove);
      el["clock-b"]?.toggleAttribute("data-active", !over && !whiteToMove);

      CAPTIONS.forEach((c, i) => show(`caption-${i}`, win(t, c.from, c.to, 0.25)));

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const king = cell("e8");

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Shaxmat o'yini: oqlar to'rt yurishda mat qiladi, soatlar yurib turadi"
      className="rounded-[28px] border border-border bg-surface p-3 shadow-soft-lg sm:p-4"
    >
      <div data-k="scene">
        <Player name="Malika" color="#E84393" avatar="🐬" clock="clock-b" />
        <div className="relative mt-2 aspect-square overflow-hidden rounded-card">
          <div className="grid size-full grid-cols-8" aria-hidden>
            {Array.from({ length: 64 }, (_, i) => (
              <div
                key={i}
                style={{
                  backgroundColor:
                    (Math.floor(i / 8) + (i % 8)) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE,
                }}
              />
            ))}
          </div>
          {["hl-from", "hl-to"].map((key) => (
            <div
              key={key}
              data-k={key}
              className="absolute top-0 left-0 size-[12.5%]"
              style={{ backgroundColor: HIGHLIGHT, opacity: 0 }}
            />
          ))}
          <div
            data-k="mate"
            className="absolute size-[12.5%]"
            style={{
              left: `${king.c * 12.5}%`,
              top: `${king.r * 12.5}%`,
              background:
                "radial-gradient(circle, rgb(255 40 40 / 0.95) 0%, rgb(255 40 40 / 0.75) 55%, rgb(255 40 40 / 0.35) 100%)",
              opacity: 0,
            }}
          />
          {PIECES.map(({ piece, key }) => (
            <div
              key={key}
              data-k={key}
              className="absolute top-0 left-0 size-[12.5%] will-change-transform"
            >
              <ChessPiece piece={piece} className="size-full" />
            </div>
          ))}
        </div>
        {/* Captions sit under the board so they never hide a piece. */}
        <div className="relative mt-2 h-9">
          {CAPTIONS.map((c, i) => (
            <div
              key={c.text}
              data-k={`caption-${i}`}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ opacity: 0 }}
            >
              <span className="rounded-full bg-[#1d1724]/90 px-4 py-1.5 text-sm font-semibold whitespace-nowrap text-white shadow-soft-sm sm:text-base">
                {c.text}
              </span>
            </div>
          ))}
        </div>
        <Player name="Siz" color="#6C5CE7" avatar="🦊" clock="clock-w" className="mt-1" />
      </div>
    </div>
  );
}

function Player({
  name,
  color,
  avatar,
  clock,
  className = "",
}: {
  name: string;
  color: string;
  avatar: string;
  clock: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 px-1 ${className}`}>
      <span className="flex items-center gap-2 font-semibold">
        <span
          className="flex size-8 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: color }}
        >
          {avatar}
        </span>
        {name}
      </span>
      <span
        data-k={clock}
        className="rounded-control bg-surface-muted px-3 py-1 font-mono text-lg font-bold text-muted tabular-nums transition-colors data-[active]:bg-primary data-[active]:text-primary-foreground"
      >
        5:00
      </span>
    </div>
  );
}
