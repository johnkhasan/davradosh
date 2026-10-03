import type { CSSProperties, ReactNode } from "react";

/** Square colours: warm maple and the site's felt green. */
export const LIGHT_SQUARE = "#ead6b0";
export const DARK_SQUARE = "#2f5d50";
const FRAME = "linear-gradient(145deg, #845633 0%, #5d3a20 55%, #4a2c17 100%)";

const FILES = "abcdefgh";

/** Display column and row (0 = top left) of a square, flipped for black. */
export function displayCell(square: number, flipped: boolean) {
  const row = Math.floor(square / 8);
  const col = square % 8;
  return flipped ? { x: 7 - col, y: row } : { x: col, y: 7 - row };
}

/** The square under a display cell. */
export function squareAt(x: number, y: number, flipped: boolean) {
  return flipped ? y * 8 + (7 - x) : (7 - y) * 8 + x;
}

/** Positions a 1/8 sized layer on a display cell (translate % is the layer's own size). */
export function cellStyle(x: number, y: number, extra?: string): CSSProperties {
  return {
    width: "12.5%",
    height: "12.5%",
    transform: `translate(${x * 100}%, ${y * 100}%)${extra ? ` ${extra}` : ""}`,
  };
}

/** Gradients the pieces share. Ids get a prefix so two boards on a page never clash. */
export function PieceDefs({ prefix }: { prefix: string }) {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <radialGradient id={`${prefix}-w`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="55%" stopColor="#efe0bf" />
          <stop offset="100%" stopColor="#c2a87c" />
        </radialGradient>
        <radialGradient id={`${prefix}-b`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#5b5b66" />
          <stop offset="50%" stopColor="#2a2a31" />
          <stop offset="100%" stopColor="#0b0b0e" />
        </radialGradient>
        <linearGradient id={`${prefix}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#c8901f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** One draughts piece: a turned disc with grooves, and a crown when it is a king. */
export function PieceArt({ owner, king, prefix }: { owner: 0 | 1; king: boolean; prefix: string }) {
  const white = owner === 0;
  const groove = white ? "rgba(120, 90, 50, 0.45)" : "rgba(255, 255, 255, 0.14)";
  return (
    <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-hidden>
      <ellipse cx="51" cy="56" rx="39" ry="38" fill="rgba(0, 0, 0, 0.38)" />
      <circle
        cx="50"
        cy="50"
        r="39"
        fill={`url(#${prefix}-${white ? "w" : "b"})`}
        stroke={white ? "#a88b5e" : "#000"}
        strokeWidth="1.5"
      />
      <circle cx="50" cy="50" r="29" fill="none" stroke={groove} strokeWidth="2" />
      <circle cx="50" cy="50" r="20" fill="none" stroke={groove} strokeWidth="1.5" />
      {king && (
        <g stroke={white ? "#7a5414" : "#5c3d07"} strokeWidth="1.6" strokeLinejoin="round">
          <path
            d="M29 61 L26 37 L39 48 L50 31 L61 48 L74 37 L71 61 Z"
            fill={`url(#${prefix}-gold)`}
          />
          <rect x="29" y="63" width="42" height="6" rx="2" fill={`url(#${prefix}-gold)`} />
          <circle cx="50" cy="31" r="3" fill="#fff3c4" />
        </g>
      )}
    </svg>
  );
}

/** Wooden frame, coordinates and the 64 squares; `children` are layered over the squares. */
export function BoardFrame({
  flipped,
  children,
  className,
}: {
  flipped: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const files = flipped ? [...FILES].reverse() : [...FILES];
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const label = "text-[min(2.6vw,13px)] font-semibold text-[#f3e3c3]/85";
  return (
    <div
      className={`relative aspect-square w-full rounded-[3%] p-[5%] shadow-soft-lg ${className ?? ""}`}
      style={{ background: FRAME }}
    >
      <div className="absolute inset-x-[5%] bottom-0 flex h-[5%] items-center" aria-hidden>
        {files.map((f) => (
          <span key={f} className={`flex-1 text-center ${label}`}>
            {f}
          </span>
        ))}
      </div>
      <div className="absolute inset-y-[5%] left-0 flex w-[5%] flex-col" aria-hidden>
        {ranks.map((r) => (
          <span key={r} className={`flex flex-1 items-center justify-center ${label}`}>
            {r}
          </span>
        ))}
      </div>
      <div className="relative size-full overflow-hidden rounded-[1.2%] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]">
        <svg
          viewBox="0 0 8 8"
          className="absolute inset-0 size-full"
          shapeRendering="crispEdges"
          aria-hidden
        >
          <rect width="8" height="8" fill={LIGHT_SQUARE} />
          {Array.from({ length: 64 }, (_, i) => {
            const x = i % 8;
            const y = Math.floor(i / 8);
            return (x + y) % 2 === 1 ? (
              <rect key={i} x={x} y={y} width="1" height="1" fill={DARK_SQUARE} />
            ) : null;
          })}
        </svg>
        {children}
      </div>
    </div>
  );
}

/** A still board for the landing page (renders on the server). */
export function StaticBoard({
  pieces,
  prefix = "shashka-demo",
  marks = [],
}: {
  pieces: { square: number; owner: 0 | 1; king?: boolean }[];
  prefix?: string;
  /** Squares with a hint dot. */
  marks?: number[];
}) {
  return (
    <BoardFrame flipped={false}>
      <PieceDefs prefix={prefix} />
      {marks.map((square) => {
        const { x, y } = displayCell(square, false);
        return (
          <div
            key={`m${square}`}
            className="absolute top-0 left-0 flex items-center justify-center"
            style={cellStyle(x, y)}
          >
            <div className="size-[30%] rounded-full bg-[#f6e7c3]/70" />
          </div>
        );
      })}
      {pieces.map((piece) => {
        const { x, y } = displayCell(piece.square, false);
        return (
          <div
            key={piece.square}
            className="absolute top-0 left-0 flex items-center justify-center"
            style={cellStyle(x, y)}
          >
            <div className="size-[86%]">
              <PieceArt owner={piece.owner} king={Boolean(piece.king)} prefix={prefix} />
            </div>
          </div>
        );
      })}
    </BoardFrame>
  );
}
