import {
  BOARD_SIZE,
  COLUMN_LETTERS,
  SHOT_AROUND,
  SHOT_HIT,
  SHOT_MISS,
  shipCells,
  type Ship,
} from "@puzzle/shared/games/battleship";
import type { CSSProperties, ReactNode } from "react";

/**
 * Sea colours as CSS variables mixed with the site tokens, so the same values work on the light
 * and the dark theme. Put `SEA_STYLE` on any ancestor of a SeaGrid.
 */
export const SEA_STYLE = {
  "--sea": "color-mix(in oklab, #2f8fe0 14%, var(--surface))",
  "--sea-line": "color-mix(in oklab, #2f8fe0 32%, var(--surface))",
  "--sea-mark": "color-mix(in oklab, #2f8fe0 62%, var(--surface))",
  "--hull": "color-mix(in oklab, #3d5a80 70%, var(--foreground))",
  "--hit": "#f2542d",
  "--sunk": "color-mix(in oklab, #b3261e 72%, var(--foreground))",
} as CSSProperties;

/** Grid units: one cell is 10, the first row and column hold the labels. */
const U = 10;
const VIEW = U * (BOARD_SIZE + 1);
/** The cell area as a share of the whole drawing (for HTML overlays). */
export const GRID_INSET = `${(100 / (BOARD_SIZE + 1)).toFixed(4)}%`;
export const GRID_SPAN = `${((100 * BOARD_SIZE) / (BOARD_SIZE + 1)).toFixed(4)}%`;

export interface SeaShip extends Ship {
  /** Sunk ships are solid red hulls. */
  sunk?: boolean;
  /** Revealed at the end of the game: drawn as an outline. */
  ghost?: boolean;
  /** Highlighted (selected while placing). */
  active?: boolean;
}

export interface SeaGhost {
  ship: Ship;
  valid: boolean;
}

const cellX = (i: number) => U + (i % BOARD_SIZE) * U;
const cellY = (i: number) => U + Math.floor(i / BOARD_SIZE) * U;

function hullRect(ship: Ship, inset = 1.3) {
  const w = (ship.vertical ? 1 : ship.length) * U - inset * 2;
  const h = (ship.vertical ? ship.length : 1) * U - inset * 2;
  return { x: U + ship.x * U + inset, y: U + ship.y * U + inset, width: w, height: h };
}

/** A 10×10 sea with labels, ships and shots, drawn as one SVG that scales to its box. */
export function SeaGrid({
  ships = [],
  shots,
  lastShot = null,
  ghost = null,
  label,
  className,
  children,
}: {
  ships?: SeaShip[];
  shots?: readonly number[];
  lastShot?: number | null;
  ghost?: SeaGhost | null;
  label?: string;
  className?: string;
  /** HTML overlay (buttons, pointer area) placed over the cell area. */
  children?: ReactNode;
}) {
  const sunkCells = new Set<number>();
  for (const ship of ships) if (ship.sunk) for (const c of shipCells(ship)) sunkCells.add(c);

  return (
    <div className={`relative aspect-square w-full select-none ${className ?? ""}`}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="block h-full w-full"
        role="img"
        aria-label={label}
      >
        <rect
          x={U}
          y={U}
          width={U * BOARD_SIZE}
          height={U * BOARD_SIZE}
          rx={2}
          style={{ fill: "var(--sea)" }}
        />
        {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => (
          <g key={i} style={{ stroke: "var(--sea-line)" }} strokeWidth={0.4}>
            <line x1={U + i * U} y1={U} x2={U + i * U} y2={VIEW} />
            <line x1={U} y1={U + i * U} x2={VIEW} y2={U + i * U} />
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

        {ships.map((ship) => {
          const r = hullRect(ship);
          const key = `${ship.x}-${ship.y}-${ship.length}-${ship.vertical}`;
          if (ship.ghost && !ship.sunk)
            return (
              <rect
                key={key}
                {...r}
                rx={3.4}
                fill="none"
                strokeWidth={1}
                strokeDasharray="2 1.4"
                style={{ stroke: "var(--hull)" }}
              />
            );
          return (
            <rect
              key={key}
              {...r}
              rx={3.4}
              style={{
                fill: ship.sunk ? "var(--sunk)" : "var(--hull)",
                stroke: ship.active ? "var(--primary)" : "none",
                strokeWidth: 1.2,
              }}
            />
          );
        })}

        {ghost && (
          <rect
            {...hullRect(ghost.ship, 0.9)}
            rx={3.6}
            strokeWidth={0.8}
            style={{
              fill: ghost.valid
                ? "color-mix(in oklab, var(--snap) 45%, transparent)"
                : "color-mix(in oklab, var(--danger) 40%, transparent)",
              stroke: ghost.valid ? "var(--snap)" : "var(--danger)",
            }}
          />
        )}

        {shots?.map((code, i) => {
          if (code === SHOT_MISS)
            return (
              <circle
                key={i}
                cx={cellX(i) + U / 2}
                cy={cellY(i) + U / 2}
                r={1.7}
                style={{ fill: "var(--sea-mark)" }}
              />
            );
          if (code === SHOT_AROUND)
            return (
              <circle
                key={i}
                cx={cellX(i) + U / 2}
                cy={cellY(i) + U / 2}
                r={1}
                opacity={0.7}
                style={{ fill: "var(--sea-mark)" }}
              />
            );
          if (code !== SHOT_HIT) return null;
          const x = cellX(i);
          const y = cellY(i);
          const onSunk = sunkCells.has(i);
          return (
            <g key={i}>
              {!onSunk && (
                <rect
                  x={x + 0.6}
                  y={y + 0.6}
                  width={U - 1.2}
                  height={U - 1.2}
                  rx={1.5}
                  opacity={0.28}
                  style={{ fill: "var(--hit)" }}
                />
              )}
              <path
                d={`M${x + 2.8} ${y + 2.8}L${x + 7.2} ${y + 7.2}M${x + 7.2} ${y + 2.8}L${x + 2.8} ${y + 7.2}`}
                strokeWidth={1.5}
                strokeLinecap="round"
                style={{ stroke: onSunk ? "rgb(255 255 255 / 0.9)" : "var(--hit)" }}
              />
            </g>
          );
        })}

        {lastShot !== null && (
          <g fill="none" style={{ stroke: "var(--primary)" }} strokeWidth={0.9}>
            <circle cx={cellX(lastShot) + U / 2} cy={cellY(lastShot) + U / 2} r={4.4} />
            <circle
              key={lastShot}
              cx={cellX(lastShot) + U / 2}
              cy={cellY(lastShot) + U / 2}
              r={4.4}
              className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
            />
          </g>
        )}
      </svg>
      {children && (
        <div
          className="absolute"
          style={{ left: GRID_INSET, top: GRID_INSET, width: GRID_SPAN, height: GRID_SPAN }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A small ship drawn with squares (tray, fleet counters). */
export function MiniShip({
  length,
  cell = 12,
  className,
  style,
}: {
  length: number;
  cell?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`inline-flex gap-px ${className ?? ""}`} aria-hidden>
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          className="rounded-[3px]"
          style={{ width: cell, height: cell, background: "var(--hull)", ...style }}
        />
      ))}
    </span>
  );
}
