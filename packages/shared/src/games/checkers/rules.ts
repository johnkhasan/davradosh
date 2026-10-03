/**
 * Russian draughts (русские шашки) on an 8×8 board.
 *
 * Squares are 0..63: `row * 8 + col`, row 0 is rank 1 (white's side), col 0 is file a.
 * Dark (playable) squares are those where row + col is even, so a1 is dark.
 */

export type Seat = 0 | 1;

export interface CheckersPiece {
  /** Stable id so the UI can animate a piece from square to square. */
  id: number;
  owner: Seat;
  king: boolean;
  square: number;
}

/** One step of a move: a slide, or one jump of a capture. */
export interface CheckersStep {
  from: number;
  to: number;
  /** Square of the piece jumped over, when this step is a capture. */
  capture: number | null;
}

type Grid = (CheckersPiece | null)[];

const DIRECTIONS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

export const rowOf = (square: number) => Math.floor(square / 8);
export const colOf = (square: number) => square % 8;
export const isDark = (square: number) => (rowOf(square) + colOf(square)) % 2 === 0;

/** "c3" style name of a square. */
export function squareName(square: number) {
  return `${"abcdefgh"[colOf(square)]}${rowOf(square) + 1}`;
}

/** Parses "c3" into a square index, or null. */
export function parseSquare(name: string): number | null {
  const match = /^([a-h])([1-8])$/.exec(name);
  if (!match) return null;
  return (Number(match[2]) - 1) * 8 + "abcdefgh".indexOf(match[1]!);
}

/** The row where a seat's men become kings. */
export const promotionRow = (owner: Seat) => (owner === 0 ? 7 : 0);
/** Row direction a seat's men move in. */
const forward = (owner: Seat) => (owner === 0 ? 1 : -1);

function offset(square: number, dr: number, dc: number, distance: number): number | null {
  const r = rowOf(square) + dr * distance;
  const c = colOf(square) + dc * distance;
  if (r < 0 || r > 7 || c < 0 || c > 7) return null;
  return r * 8 + c;
}

export function toGrid(pieces: CheckersPiece[]): Grid {
  const grid: Grid = Array.from({ length: 64 }, () => null);
  for (const piece of pieces) grid[piece.square] = piece;
  return grid;
}

/** Twelve men each on the first three rows of each side. */
export function initialPieces(): CheckersPiece[] {
  const pieces: CheckersPiece[] = [];
  for (let square = 0; square < 64; square++) {
    if (!isDark(square)) continue;
    const row = rowOf(square);
    if (row <= 2) pieces.push({ id: pieces.length, owner: 0, king: false, square });
    else if (row >= 5) pieces.push({ id: pieces.length, owner: 1, king: false, square });
  }
  return pieces;
}

/**
 * Captures available to the piece on `from`. `captured` are pieces already jumped in this
 * move: they stay on the board until the move ends, so they block the way and cannot be
 * jumped again (the "Turkish strike" rule). A king may land on any empty square beyond the
 * captured piece, except that when some landings let it keep capturing it must pick one of those.
 */
export function capturesFrom(
  grid: Grid,
  from: number,
  captured: readonly number[],
): CheckersStep[] {
  const piece = grid[from];
  if (!piece) return [];
  const steps: CheckersStep[] = [];
  const isEnemy = (square: number) => {
    const other = grid[square];
    return other !== null && other !== undefined && other.owner !== piece.owner;
  };
  for (const [dr, dc] of DIRECTIONS) {
    if (!piece.king) {
      const over = offset(from, dr, dc, 1);
      const land = offset(from, dr, dc, 2);
      if (over === null || land === null) continue;
      if (isEnemy(over) && !captured.includes(over) && !grid[land]) {
        steps.push({ from, to: land, capture: over });
      }
      continue;
    }
    // Flying king: slide over empty squares to the first piece on the diagonal.
    let distance = 1;
    let square = offset(from, dr, dc, distance);
    while (square !== null && !grid[square]) square = offset(from, dr, dc, ++distance);
    if (square === null || !isEnemy(square) || captured.includes(square)) continue;
    const over = square;
    const landings: number[] = [];
    let land = offset(from, dr, dc, ++distance);
    while (land !== null && !grid[land]) {
      landings.push(land);
      land = offset(from, dr, dc, ++distance);
    }
    if (landings.length === 0) continue;
    const continuing = landings.filter((to) =>
      canContinue(grid, piece, from, to, [...captured, over]),
    );
    for (const to of continuing.length > 0 ? continuing : landings) {
      steps.push({ from, to, capture: over });
    }
  }
  return steps;
}

/** Would the piece moved from `from` to `to` still have a capture there? */
function canContinue(
  grid: Grid,
  piece: CheckersPiece,
  from: number,
  to: number,
  captured: number[],
): boolean {
  const next = grid.slice();
  next[from] = null;
  const king = piece.king || rowOf(to) === promotionRow(piece.owner);
  next[to] = { ...piece, square: to, king };
  return capturesFrom(next, to, captured).length > 0;
}

/** Non-capturing moves of one piece. */
export function slidesFrom(grid: Grid, from: number): CheckersStep[] {
  const piece = grid[from];
  if (!piece) return [];
  const steps: CheckersStep[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    if (!piece.king) {
      if (dr !== forward(piece.owner)) continue;
      const to = offset(from, dr, dc, 1);
      if (to !== null && !grid[to]) steps.push({ from, to, capture: null });
      continue;
    }
    let distance = 1;
    let to = offset(from, dr, dc, distance);
    while (to !== null && !grid[to]) {
      steps.push({ from, to, capture: null });
      to = offset(from, dr, dc, ++distance);
    }
  }
  return steps;
}

/** All steps a seat may start a move with: captures when any exist (capturing is mandatory). */
export function startSteps(pieces: CheckersPiece[], owner: Seat): CheckersStep[] {
  const grid = toGrid(pieces);
  const own = pieces.filter((p) => p.owner === owner);
  const captures = own.flatMap((p) => capturesFrom(grid, p.square, []));
  if (captures.length > 0) return captures;
  return own.flatMap((p) => slidesFrom(grid, p.square));
}

/** Key of a position for the repetition rule. */
export function positionKey(pieces: CheckersPiece[], turn: Seat): string {
  const cells = Array.from({ length: 32 }, () => ".");
  for (const p of pieces) {
    cells[p.square >> 1] = p.owner === 0 ? (p.king ? "W" : "w") : p.king ? "B" : "b";
  }
  return `${turn}${cells.join("")}`;
}
