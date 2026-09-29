import { createRandom } from "./random";

/**
 * Classic jigsaw edge generation.
 *
 * Every internal edge is generated once and shared by the two pieces that touch it,
 * so neighbours always fit perfectly. An edge is 3 cubic Bezier segments; the
 * parametrisation follows the well-known "draradech" jigsaw generator:
 * tab size `t`, per-edge random jitter, and a random flip (tab vs. blank).
 */

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "L"; x: number; y: number };

export interface Point {
  x: number;
  y: number;
}

/** A cubic Bezier chain in absolute puzzle coordinates: start + N × (c1, c2, end). */
interface EdgeCurve {
  start: Point;
  segments: Array<[Point, Point, Point]>;
}

export interface PuzzleShapeInput {
  cols: number;
  rows: number;
  /** Size of one grid cell in world units. */
  pieceWidth: number;
  pieceHeight: number;
  seed: number;
}

export interface PieceShape {
  id: number;
  col: number;
  row: number;
  /** Closed outline in the piece's local coordinates (origin = cell top-left). */
  path: PathCommand[];
  /** Local bounding box, including tabs that stick out of the cell. */
  bounds: { x: number; y: number; width: number; height: number };
  isEdge: boolean;
}

/** Tab size relative to the smaller cell side. */
const TAB_SIZE = 0.1;
const JITTER = 0.04;

function straightEdge(from: Point, to: Point): EdgeCurve {
  const third = (p: number) => ({
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p,
  });
  return { start: from, segments: [[third(1 / 3), third(2 / 3), to]] };
}

/**
 * Builds a tabbed edge from `from` along a horizontal or vertical axis.
 * `u` runs along the edge, `v` perpendicular to it (scaled by `depth`).
 */
function tabbedEdge(
  from: Point,
  length: number,
  depth: number,
  horizontal: boolean,
  random: () => number,
): EdgeCurve {
  const jitter = () => (random() * 2 - 1) * JITTER;
  const flip = random() < 0.5 ? 1 : -1;
  const t = TAB_SIZE;
  const a = jitter();
  const b = jitter();
  const c = jitter();
  const d = jitter();
  const e = jitter();

  const point = (u: number, v: number): Point =>
    horizontal
      ? { x: from.x + u * length, y: from.y + v * depth * flip }
      : { x: from.x + v * depth * flip, y: from.y + u * length };

  return {
    start: point(0, 0),
    segments: [
      [point(0.2, a), point(0.5 + b + d, -t + c), point(0.5 - t + b, t + c)],
      [
        point(0.5 - 2 * t + b - d, 3 * t + c),
        point(0.5 + 2 * t + b - d, 3 * t + c),
        point(0.5 + t + b, t + c),
      ],
      [point(0.5 + b + d, -t + c), point(0.8, e), point(1, 0)],
    ],
  };
}

function reverseEdge(edge: EdgeCurve): EdgeCurve {
  const points: Point[] = [edge.start];
  for (const [c1, c2, end] of edge.segments) points.push(c1, c2, end);
  points.reverse();
  const segments: Array<[Point, Point, Point]> = [];
  for (let i = 1; i < points.length; i += 3) {
    segments.push([points[i]!, points[i + 1]!, points[i + 2]!]);
  }
  return { start: points[0]!, segments };
}

export function generatePieceShapes(input: PuzzleShapeInput): PieceShape[] {
  const { cols, rows, pieceWidth: pw, pieceHeight: ph, seed } = input;
  const random = createRandom(seed);
  const depth = Math.min(pw, ph);

  // horizontal[r][c]: edge on top of row r (r = 0..rows), running left → right.
  const horizontal: EdgeCurve[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: EdgeCurve[] = [];
    for (let c = 0; c < cols; c++) {
      const from = { x: c * pw, y: r * ph };
      const to = { x: (c + 1) * pw, y: r * ph };
      row.push(
        r === 0 || r === rows ? straightEdge(from, to) : tabbedEdge(from, pw, depth, true, random),
      );
    }
    horizontal.push(row);
  }

  // vertical[r][c]: edge on the left of column c (c = 0..cols), running top → bottom.
  const vertical: EdgeCurve[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: EdgeCurve[] = [];
    for (let c = 0; c <= cols; c++) {
      const from = { x: c * pw, y: r * ph };
      const to = { x: c * pw, y: (r + 1) * ph };
      row.push(
        c === 0 || c === cols ? straightEdge(from, to) : tabbedEdge(from, ph, depth, false, random),
      );
    }
    vertical.push(row);
  }

  const pieces: PieceShape[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * pw;
      const oy = r * ph;
      // Clockwise: top (L→R), right (T→B), bottom (R→L), left (B→T).
      const edges = [
        horizontal[r]![c]!,
        vertical[r]![c + 1]!,
        reverseEdge(horizontal[r + 1]![c]!),
        reverseEdge(vertical[r]![c]!),
      ];

      const path: PathCommand[] = [
        { type: "M", x: edges[0]!.start.x - ox, y: edges[0]!.start.y - oy },
      ];
      let minX = 0;
      let minY = 0;
      let maxX = pw;
      let maxY = ph;
      for (const edge of edges) {
        for (const [c1, c2, end] of edge.segments) {
          path.push({
            type: "C",
            x1: c1.x - ox,
            y1: c1.y - oy,
            x2: c2.x - ox,
            y2: c2.y - oy,
            x: end.x - ox,
            y: end.y - oy,
          });
          for (const p of [c1, c2, end]) {
            minX = Math.min(minX, p.x - ox);
            minY = Math.min(minY, p.y - oy);
            maxX = Math.max(maxX, p.x - ox);
            maxY = Math.max(maxY, p.y - oy);
          }
        }
      }

      pieces.push({
        id: r * cols + c,
        col: c,
        row: r,
        path,
        // Control points bound the curve, so this box is safe (slightly generous).
        bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
        isEdge: r === 0 || c === 0 || r === rows - 1 || c === cols - 1,
      });
    }
  }
  return pieces;
}

/** Flattens a path into a polygon (used for precise hit testing). */
export function flattenPath(path: PathCommand[], stepsPerCurve = 8): number[] {
  const points: number[] = [];
  let x = 0;
  let y = 0;
  for (const cmd of path) {
    if (cmd.type === "M" || cmd.type === "L") {
      x = cmd.x;
      y = cmd.y;
      points.push(x, y);
      continue;
    }
    for (let i = 1; i <= stepsPerCurve; i++) {
      const t = i / stepsPerCurve;
      const mt = 1 - t;
      const px =
        mt * mt * mt * x + 3 * mt * mt * t * cmd.x1 + 3 * mt * t * t * cmd.x2 + t * t * t * cmd.x;
      const py =
        mt * mt * mt * y + 3 * mt * mt * t * cmd.y1 + 3 * mt * t * t * cmd.y2 + t * t * t * cmd.y;
      points.push(px, py);
    }
    x = cmd.x;
    y = cmd.y;
  }
  return points;
}
