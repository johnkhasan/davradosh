import { describe, expect, it } from "vitest";
import { gridForPieceCount } from "./grid";
import { flattenPath, generatePieceShapes, type PathCommand } from "./shape";

const input = { cols: 5, rows: 4, pieceWidth: 100, pieceHeight: 80, seed: 42 };

/** Absolute points of a piece outline, sampled finely. */
function outline(path: PathCommand[], ox: number, oy: number): Array<[number, number]> {
  const flat = flattenPath(path, 16);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < flat.length; i += 2) points.push([flat[i]! + ox, flat[i + 1]! + oy]);
  return points;
}

/** Sub-path of commands [from, to), starting at the end point of the previous command. */
function edgeFrom(path: PathCommand[], from: number, to: number): PathCommand[] {
  const prev = path[from - 1]!;
  return [{ type: "M", x: prev.x, y: prev.y }, ...path.slice(from, to)];
}

describe("generatePieceShapes", () => {
  it("is deterministic for the same seed", () => {
    expect(generatePieceShapes(input)).toEqual(generatePieceShapes(input));
    expect(generatePieceShapes(input)).not.toEqual(generatePieceShapes({ ...input, seed: 43 }));
  });

  it("creates one closed shape per cell", () => {
    const pieces = generatePieceShapes(input);
    expect(pieces).toHaveLength(20);
    for (const piece of pieces) {
      const first = piece.path[0]!;
      const last = piece.path.at(-1)!;
      expect(first.type).toBe("M");
      expect(last.x).toBeCloseTo(first.x);
      expect(last.y).toBeCloseTo(first.y);
    }
  });

  it("marks border pieces as edges", () => {
    const pieces = generatePieceShapes(input);
    expect(pieces.filter((p) => p.isEdge)).toHaveLength(5 * 2 + 2 * 2);
  });

  it("neighbours share exactly the same edge curve", () => {
    const pieces = generatePieceShapes(input);
    const left = pieces[0]!; // col 0, row 0
    const right = pieces[1]!; // col 1, row 0
    // Top-row pieces: [M, top (1 straight segment), right (3), bottom (3), left (1 or 3)].
    // Right edge of `left` is commands 2..4, left edge of `right` is 8..10 (drawn reversed).
    const leftEdge = outline(edgeFrom(left.path, 2, 5), 0, 0);
    const rightEdge = outline(edgeFrom(right.path, 8, 11), 100, 0).reverse();
    expect(leftEdge).toHaveLength(rightEdge.length);
    leftEdge.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(rightEdge[i]![0], 6);
      expect(y).toBeCloseTo(rightEdge[i]![1], 6);
    });
  });

  it("bounds include tabs that stick out of the cell", () => {
    const pieces = generatePieceShapes(input);
    const inner = pieces.find((p) => !p.isEdge)!;
    expect(inner.bounds.width).toBeGreaterThan(100);
    expect(inner.bounds.height).toBeGreaterThan(80);
  });
});

describe("gridForPieceCount", () => {
  it("keeps cells close to square", () => {
    const grid = gridForPieceCount(100, 4 / 3);
    const cellAspect = 4 / 3 / grid.cols / (1 / grid.rows);
    expect(cellAspect).toBeGreaterThan(0.8);
    expect(cellAspect).toBeLessThan(1.25);
    expect(Math.abs(grid.cols * grid.rows - 100)).toBeLessThanOrEqual(12);
  });

  it("handles portrait and panorama images", () => {
    for (const aspect of [9 / 16, 16 / 9, 1]) {
      for (const target of [24, 48, 100, 200, 500]) {
        const { cols, rows } = gridForPieceCount(target, aspect);
        expect(cols).toBeGreaterThanOrEqual(2);
        expect(rows).toBeGreaterThanOrEqual(2);
        expect(Math.abs(cols * rows - target) / target).toBeLessThan(0.2);
      }
    }
  });
});
