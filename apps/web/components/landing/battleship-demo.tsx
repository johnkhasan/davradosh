"use client";

import { BOARD_SIZE, COLUMN_LETTERS } from "@puzzle/shared/games/battleship";
import { useEffect, useRef } from "react";

/** Grid units, as in SeaGrid: one cell is 10, the first row and column hold the labels. */
const U = 10;
const GRID = U * (BOARD_SIZE + 1);
/** Room under the grid for the caption. */
const H = GRID + 16;

const cx = (x: number) => U + x * U + U / 2;
const cy = (y: number) => U + y * U + U / 2;

type Shot = { x: number; y: number; at: number; hit: boolean };

// The story, in seconds: two misses, three hits that sink a cruiser, then a hit on the next ship.
const SHOTS: Shot[] = [
  { x: 2, y: 6, at: 1.4, hit: false },
  { x: 6, y: 3, at: 3.0, hit: false },
  { x: 5, y: 5, at: 4.6, hit: true },
  { x: 5, y: 6, at: 6.1, hit: true },
  { x: 5, y: 7, at: 7.6, hit: true },
  { x: 1, y: 2, at: 10.4, hit: true },
];
const LAST_SHOT = SHOTS[SHOTS.length - 1]!.at;
/** The crosshair travels to the next cell for this long before the shot. */
const AIM = 0.8;
const SINK_AT = 8.2;
/** The cruiser that goes down: column F, rows 6–8. */
const CRUISER = { x: 5, y: 5, length: 3 };
const CYCLE = 13.4;
const FADE = 0.5;
/** Right after the cruiser sank: what reduced motion shows. */
const STILL = 9.4;

// Already on the board when the loop starts: a sunk boat with the cells around it, a few misses.
const BOAT = { x: 7, y: 0 };
const OLD_MISSES = [
  [3, 9],
  [8, 8],
  [0, 4],
  [9, 5],
] as const;

const around = (ship: { x: number; y: number; length: number }) => {
  const cells: Array<[number, number]> = [];
  for (let x = ship.x - 1; x <= ship.x + 1; x++)
    for (let y = ship.y - 1; y <= ship.y + ship.length; y++) {
      const inside = x === ship.x && y >= ship.y && y < ship.y + ship.length;
      if (!inside && x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE) cells.push([x, y]);
    }
  return cells;
};

const CAPTIONS = [
  { from: 0.2, to: SHOTS[0]!.at, text: "Sizning navbatingiz: nishonni tanlang", tone: "muted" },
  { from: SHOTS[0]!.at, to: SHOTS[2]!.at - AIM, text: "Bo'sh 💧", tone: "muted" },
  { from: SHOTS[2]!.at, to: SINK_AT, text: "Tegdi! Yana oting 🎯", tone: "hit" },
  { from: SINK_AT, to: SHOTS[5]!.at, text: "Cho'kdi! 💥", tone: "sunk" },
  { from: SHOTS[5]!.at, to: CYCLE, text: "Tegdi! Yana oting 🎯", tone: "hit" },
] as const;

const TONE = { muted: "var(--muted)", hit: "var(--hit)", sunk: "var(--primary)" };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 → 0 over [a, b], with soft edges. */
const win = (t: number, a: number, b: number, edge = 0.25) =>
  clamp(Math.min((t - a) / edge, (b - t) / edge));
const rise = (t: number, a: number, edge = 0.2) => clamp((t - a) / edge);
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/** Where the crosshair rests before the first shot. */
const START = { x: 7, y: 4 };

/**
 * Self-playing hero animation for the battleship landing: the crosshair picks cells on the
 * enemy sea, misses splash, hits burn, and three hits sink a cruiser; then it loops.
 * SVG + rAF like the puzzle and mafia demos; a still frame when the user prefers reduced motion.
 * Colours come from SEA_STYLE on an ancestor, so it follows the light and the dark theme.
 */
export function BattleshipDemo() {
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

      // Waves drift slowly across the sea.
      [0, 1, 2].forEach((i) =>
        set(`wave-${i}`, "transform", `translate(${-((t * (3 + i) + i * 7) % 20)} 0)`),
      );

      // Crosshair: glide from the previous target to the next one, then pulse on the shot.
      let from = START;
      let to = START;
      let p = 1;
      for (const shot of SHOTS) {
        if (t < shot.at - AIM) break;
        from = to;
        to = shot;
        p = ease(clamp((t - (shot.at - AIM)) / (AIM * 0.8)));
      }
      const x = cx(from.x) + (cx(to.x) - cx(from.x)) * p;
      const y = cy(from.y) + (cy(to.y) - cy(from.y)) * p;
      const recoil = SHOTS.some((s) => t >= s.at && t < s.at + 0.25) ? 0.82 : 1;
      set("aim", "transform", `translate(${x} ${y}) scale(${recoil})`);
      show("aim", 1 - rise(t, LAST_SHOT + 1.2, 0.4));

      SHOTS.forEach((shot, i) => {
        show(`mark-${i}`, rise(t, shot.at, 0.12));
        // A splash ring for a miss, a flash for a hit, both growing and fading out.
        const fx = clamp((t - shot.at) / 0.7);
        const live = t >= shot.at && fx < 1;
        set(`fx-${i}`, "r", 2 + fx * (shot.hit ? 9 : 7));
        show(`fx-${i}`, live ? 1 - fx : 0);
      });

      // The cruiser goes down: a red hull, white crosses and the cells around it marked.
      const sunk = rise(t, SINK_AT, 0.3);
      // As in SeaGrid, a sunk ship's cells lose the hit tint.
      SHOTS.forEach((shot, i) => {
        const onCruiser =
          shot.x === CRUISER.x && shot.y >= CRUISER.y && shot.y < CRUISER.y + CRUISER.length;
        if (shot.hit) show(`tint-${i}`, onCruiser ? 1 - sunk : 1);
      });
      show("hull", sunk);
      show("around", rise(t, SINK_AT + 0.3, 0.4));
      show("hull-cross", sunk);

      CAPTIONS.forEach((c, i) => show(`caption-${i}`, win(t, c.from, c.to, 0.2)));

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const cross = (x: number, y: number) =>
    `M${U + x * U + 2.8} ${U + y * U + 2.8}l4.4 4.4M${U + x * U + 7.2} ${U + y * U + 2.8}l-4.4 4.4`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${GRID} ${H}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label="Dengiz jangi: nishon raqib dengizidagi kataklarni tanlaydi, ikki marta bo'sh ketadi, uch marta tegib kemani cho'ktiradi"
    >
      <defs>
        <clipPath id="battleship-sea">
          <rect x={U} y={U} width={U * BOARD_SIZE} height={U * BOARD_SIZE} rx={2} />
        </clipPath>
      </defs>

      <g data-k="scene">
        <rect
          x={U}
          y={U}
          width={U * BOARD_SIZE}
          height={U * BOARD_SIZE}
          rx={2}
          style={{ fill: "var(--sea)" }}
        />
        <g clipPath="url(#battleship-sea)" fill="none" strokeWidth={0.6} strokeLinecap="round">
          {[22, 58, 92].map((y, i) => (
            <path
              key={y}
              data-k={`wave-${i}`}
              d={`M0 ${y}${" q5 -1.8 10 0 t10 0".repeat(12)}`}
              style={{ stroke: "var(--sea-mark)" }}
              opacity={0.35}
            />
          ))}
        </g>
        {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => (
          <g key={i} style={{ stroke: "var(--sea-line)" }} strokeWidth={0.4}>
            <line x1={U + i * U} y1={U} x2={U + i * U} y2={GRID} />
            <line x1={U} y1={U + i * U} x2={GRID} y2={U + i * U} />
          </g>
        ))}
        <g style={{ fill: "var(--muted)" }} fontSize={4.6} fontWeight={600} textAnchor="middle">
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <g key={i}>
              <text x={U * 1.5 + i * U} y={6.8}>
                {COLUMN_LETTERS[i]}
              </text>
              <text x={5} y={U * 1.5 + i * U + 1.6}>
                {i + 1}
              </text>
            </g>
          ))}
        </g>

        {/* Already on the board: a sunk boat, the cells around it and a few misses. */}
        <rect
          x={U + BOAT.x * U + 1.3}
          y={U + BOAT.y * U + 1.3}
          width={U - 2.6}
          height={U - 2.6}
          rx={3.4}
          style={{ fill: "var(--sunk)" }}
        />
        <path
          d={cross(BOAT.x, BOAT.y)}
          strokeWidth={1.5}
          strokeLinecap="round"
          stroke="rgb(255 255 255 / 0.9)"
        />
        {around({ ...BOAT, length: 1 }).map(([x, y]) => (
          <circle
            key={`b-${x}-${y}`}
            cx={cx(x)}
            cy={cy(y)}
            r={1}
            opacity={0.7}
            style={{ fill: "var(--sea-mark)" }}
          />
        ))}
        {OLD_MISSES.map(([x, y]) => (
          <circle
            key={`m-${x}-${y}`}
            cx={cx(x)}
            cy={cy(y)}
            r={1.7}
            style={{ fill: "var(--sea-mark)" }}
          />
        ))}

        {/* The cruiser's hull and the cells around it appear when it sinks. */}
        <g data-k="around" opacity={0}>
          {around(CRUISER).map(([x, y]) => (
            <circle
              key={`a-${x}-${y}`}
              cx={cx(x)}
              cy={cy(y)}
              r={1}
              opacity={0.7}
              style={{ fill: "var(--sea-mark)" }}
            />
          ))}
        </g>

        {SHOTS.map((shot, i) =>
          shot.hit ? (
            <g key={i} data-k={`mark-${i}`} opacity={0}>
              <rect
                x={U + shot.x * U + 0.6}
                y={U + shot.y * U + 0.6}
                width={U - 1.2}
                height={U - 1.2}
                rx={1.5}
                data-k={`tint-${i}`}
                fillOpacity={0.28}
                style={{ fill: "var(--hit)" }}
              />
              <path
                d={cross(shot.x, shot.y)}
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{ stroke: "var(--hit)" }}
              />
            </g>
          ) : (
            <circle
              key={i}
              data-k={`mark-${i}`}
              cx={cx(shot.x)}
              cy={cy(shot.y)}
              r={1.7}
              opacity={0}
              style={{ fill: "var(--sea-mark)" }}
            />
          ),
        )}

        <rect
          data-k="hull"
          x={U + CRUISER.x * U + 1.3}
          y={U + CRUISER.y * U + 1.3}
          width={U - 2.6}
          height={CRUISER.length * U - 2.6}
          rx={3.4}
          opacity={0}
          style={{ fill: "var(--sunk)" }}
        />
        <g
          data-k="hull-cross"
          opacity={0}
          strokeWidth={1.5}
          strokeLinecap="round"
          stroke="rgb(255 255 255 / 0.9)"
        >
          {Array.from({ length: CRUISER.length }, (_, i) => (
            <path key={i} d={cross(CRUISER.x, CRUISER.y + i)} />
          ))}
        </g>

        {SHOTS.map((shot, i) => (
          <circle
            key={i}
            data-k={`fx-${i}`}
            cx={cx(shot.x)}
            cy={cy(shot.y)}
            r={2}
            opacity={0}
            fill={shot.hit ? "rgb(242 84 45 / 0.35)" : "none"}
            strokeWidth={shot.hit ? 0 : 0.9}
            style={{ stroke: shot.hit ? "none" : "var(--sea-mark)" }}
          />
        ))}

        {/* The crosshair, drawn around (0, 0) and moved with a transform. */}
        <g
          data-k="aim"
          transform={`translate(${cx(START.x)} ${cy(START.y)})`}
          fill="none"
          strokeWidth={0.9}
          strokeLinecap="round"
          style={{ stroke: "var(--primary)" }}
        >
          <circle r={4.4} />
          <path d="M0 -7.2v3.4M0 3.8v3.4M-7.2 0h3.4M3.8 0h3.4" />
          <circle r={0.8} style={{ fill: "var(--primary)" }} stroke="none" />
        </g>

        {CAPTIONS.map((c, i) => (
          <text
            key={i}
            data-k={`caption-${i}`}
            x={GRID / 2 + U / 2}
            y={GRID + 10}
            textAnchor="middle"
            fontSize={5.6}
            fontWeight={700}
            opacity={0}
            style={{ fill: TONE[c.tone] }}
          >
            {c.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
