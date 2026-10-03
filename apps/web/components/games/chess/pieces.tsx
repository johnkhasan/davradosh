import type { CSSProperties } from "react";

/**
 * Flat Staunton-style chess pieces drawn for Davradosh (no third-party piece set). One 45×45
 * viewBox per piece; white pieces are cream with a dark outline, black pieces dark with light
 * detail lines so both read on light and dark squares. Server-safe (no hooks).
 */

export type PieceLetter = "p" | "n" | "b" | "r" | "q" | "k";

const INK = "#1d1724";
const WHITE_FILL = "#fffaf0";
const BLACK_FILL = "#33293f";
const BLACK_DETAIL = "#d9cfe6";

/** Bodies are filled shapes; `detail` paths are thin lines drawn on top. */
const SHAPES: Record<
  PieceLetter,
  { body: string[]; detail?: string[]; dots?: [number, number][] }
> = {
  p: {
    body: [
      "M22.5 8a5 5 0 0 0-3.3 8.75c-2.3 1.2-3.7 2.9-3.7 4.6h14c0-1.7-1.4-3.4-3.7-4.6A5 5 0 0 0 22.5 8z",
      "M18.5 21.35c-.5 5.6-3.4 8.6-5 12.65h18c-1.6-4.05-4.5-7.05-5-12.65z",
      "M11 34.5a2 2 0 0 1 2-2h19a2 2 0 0 1 2 2v3.5H11z",
    ],
  },
  r: {
    body: [
      "M11.5 9.5h4.5v3h3.5v-3h6v3h3.5v-3h4.5v7.5l-3 2.5H14.5l-3-2.5z",
      "M15 19.5h15l1 13H14z",
      "M10 34.5a2 2 0 0 1 2-2h21a2 2 0 0 1 2 2v3.5H10z",
    ],
    detail: ["M14.5 19.5h16", "M14 32.5h17"],
  },
  n: {
    body: [
      "M21.5 7l3 3.2c6 1.2 9.8 7 9.3 15.3l-.6 7.5H14.6c.2-4.5 2.6-7.4 6-9.8-2.4-1.4-5 .4-7.7 1.1-2 .5-3.6-1.5-2.6-3.4l4.8-7.4c1.6-2.4 3.6-3.9 5.6-4.9z",
      "M10.5 34.5a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3.5h-24z",
    ],
    detail: ["M25 12.5c3.5 2.5 5 6.5 4.8 12"],
    dots: [[18.4, 15.2]],
  },
  b: {
    body: [
      "M22.5 4.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z",
      "M22.5 10.2c-3.7 2.6-8.4 7-7.6 12.3.4 3 2.4 5 2.4 7.5h10.4c0-2.5 2-4.5 2.4-7.5.8-5.3-3.9-9.7-7.6-12.3z",
      "M15 30h15l1 2.5H14z",
      "M10.5 34.5a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3.5h-24z",
    ],
    detail: ["M25.6 15.2l-4.8 5.8"],
  },
  q: {
    body: [
      "M12 32.5L8.5 14.5l6.8 9.2.6-12.2 5 11.5 1.6-13.5 1.6 13.5 5-11.5.6 12.2 6.8-9.2-3.5 18z",
      "M10.5 34.5a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3.5h-24z",
    ],
    detail: ["M13 28.5c6.5-1.5 12.5-1.5 19 0"],
    dots: [
      [8.5, 13],
      [15.9, 10],
      [22.5, 8],
      [29.1, 10],
      [36.5, 13],
    ],
  },
  k: {
    body: [
      "M21.2 3.5h2.6v3h3v2.6h-3v4.4h-2.6V9.1h-3V6.5h3z",
      "M22.5 13.5c-2 0-3.2 2.2-3.2 4.6 0 2.2 1.4 3.9 3.2 6.4 1.8-2.5 3.2-4.2 3.2-6.4 0-2.4-1.2-4.6-3.2-4.6z",
      "M12.5 32.5c-2.5-4.6-4.7-9.8-1.4-12.8 3.6-3.2 8.9-.8 11.4 4.8 2.5-5.6 7.8-8 11.4-4.8 3.3 3-1.1 8.2-1.4 12.8z",
      "M10.5 34.5a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3.5h-24z",
    ],
    detail: ["M13.5 28c6-1.6 12-1.6 18 0", "M22.5 24.5v4"],
  },
};

/** One piece as an SVG filling its box. `piece` is a FEN letter (uppercase = white). */
export function ChessPiece({
  piece,
  className,
  style,
}: {
  piece: string;
  className?: string;
  style?: CSSProperties;
}) {
  const white = piece === piece.toUpperCase();
  const shape = SHAPES[piece.toLowerCase() as PieceLetter];
  if (!shape) return null;
  const fill = white ? WHITE_FILL : BLACK_FILL;
  const detail = white ? INK : BLACK_DETAIL;
  return (
    <svg viewBox="0 0 45 45" className={className} style={style} aria-hidden>
      <g stroke={INK} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" fill={fill}>
        {shape.body.map((d) => (
          <path key={d} d={d} />
        ))}
        {shape.dots?.map(([cx, cy]) =>
          piece.toLowerCase() === "n" ? (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.3} fill={detail} stroke="none" />
          ) : (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} />
          ),
        )}
      </g>
      {shape.detail && (
        <g stroke={detail} strokeWidth={1.2} strokeLinecap="round" fill="none">
          {shape.detail.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}

/** Board colours: warm wood that sits well next to the violet primary in both themes. */
export const LIGHT_SQUARE = "#f0dcbc";
export const DARK_SQUARE = "#b48762";

/** Turns the placement part of a FEN into 8 rows (rank 8 first) of FEN letters or null. */
export function parsePlacement(fen: string): (string | null)[][] {
  const rows = (fen.split(" ")[0] ?? "").split("/");
  return Array.from({ length: 8 }, (_, r) => {
    const row: (string | null)[] = [];
    for (const ch of rows[r] ?? "") {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) row.push(null);
      else row.push(ch);
    }
    while (row.length < 8) row.push(null);
    return row.slice(0, 8);
  });
}

/** A static board for illustrations (landing page). White at the bottom. */
export function StaticChessBoard({
  fen,
  highlight = [],
  className,
}: {
  fen: string;
  highlight?: string[];
  className?: string;
}) {
  const board = parsePlacement(fen);
  return (
    <div
      className={`grid aspect-square grid-cols-8 overflow-hidden rounded-card shadow-soft-lg ${className ?? ""}`}
    >
      {board.flatMap((row, r) =>
        row.map((piece, c) => {
          const square = `${"abcdefgh"[c]}${8 - r}`;
          const light = (r + c) % 2 === 0;
          return (
            <div
              key={square}
              className="relative"
              style={{ backgroundColor: light ? LIGHT_SQUARE : DARK_SQUARE }}
            >
              {highlight.includes(square) && (
                <div className="absolute inset-0" style={{ backgroundColor: HIGHLIGHT }} />
              )}
              {piece && <ChessPiece piece={piece} className="relative size-full" />}
            </div>
          );
        }),
      )}
    </div>
  );
}

export const HIGHLIGHT = "rgb(250 204 21 / 0.42)";
