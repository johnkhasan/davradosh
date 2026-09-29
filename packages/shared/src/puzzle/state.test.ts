import { describe, expect, it } from "vitest";
import { PuzzleState, type PuzzleConfig } from "./state";

const config: PuzzleConfig = { cols: 4, rows: 3, pieceWidth: 100, pieceHeight: 100 };

function blank(): PuzzleState {
  // Every piece in its own group, far from the board and from each other.
  const groups = Array.from({ length: 12 }, (_, id) => ({
    id,
    x: 1000 + id * 500,
    y: 1000,
    pieceIds: [id],
    placed: false,
  }));
  return new PuzzleState(config, { groups });
}

describe("PuzzleState.create", () => {
  it("scatters every piece outside the board, deterministically", () => {
    const a = PuzzleState.create(config, 7);
    const b = PuzzleState.create(config, 7);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.groupCount).toBe(12);
    for (const group of a.allGroups()) {
      const pieceId = group.pieceIds[0]!;
      const x = group.x + (pieceId % 4) * 100;
      const y = group.y + Math.floor(pieceId / 4) * 100;
      const overlapsBoard = x + 100 > 0 && x < 400 && y + 100 > 0 && y < 300;
      expect(overlapsBoard).toBe(false);
    }
  });
});

describe("PuzzleState.snap", () => {
  it("merges neighbours whose origins are within tolerance", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(1, 2008, 1994); // within 15px
    const result = state.snap(1);
    expect(result).toMatchObject({ groupId: 0, absorbed: [1], x: 2000, y: 2000, placed: false });
    expect(state.groupOfPiece(1)?.id).toBe(0);
    expect(state.groupCount).toBe(11);
  });

  it("does not merge pieces that are not neighbours", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(2, 2000, 2000); // piece 2 is not adjacent to piece 0
    expect(state.snap(2)).toBeNull();
    expect(state.groupCount).toBe(12);
  });

  it("does not merge when the offset is too large", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(1, 2030, 2000);
    expect(state.snap(1)).toBeNull();
  });

  it("chains merges with several aligned neighbours", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(2, 2004, 2003);
    state.moveGroup(1, 2002, 1999); // piece 1 bridges 0 and 2
    const result = state.snap(1)!;
    expect(result.absorbed.sort()).toEqual([1, 2]);
    expect(state.getGroup(result.groupId)!.pieceIds.sort()).toEqual([0, 1, 2]);
    expect(state.groupCount).toBe(10);
  });

  it("snaps into the board and locks the group", () => {
    const state = blank();
    state.moveGroup(5, 9, -7);
    const result = state.snap(5);
    expect(result).toMatchObject({ groupId: 5, x: 0, y: 0, placed: true });
    expect(state.moveGroup(5, 100, 100)).toBe(false);
  });

  it("joins a placed neighbour and becomes placed", () => {
    const state = blank();
    state.moveGroup(0, 3, 3);
    state.snap(0);
    state.moveGroup(1, -5, 6);
    const result = state.snap(1)!;
    expect(result).toMatchObject({ groupId: 0, placed: true, x: 0, y: 0 });
  });

  it("detects completion", () => {
    const state = blank();
    for (let id = 0; id < 12; id++) {
      state.moveGroup(state.groupOfPiece(id)!.id, 0, 0);
      state.snap(state.groupOfPiece(id)!.id);
    }
    expect(state.isComplete()).toBe(true);
    expect(state.groupCount).toBe(1);
    expect(state.connectedPieceCount()).toBe(12);
  });
});

describe("PuzzleState.arrange", () => {
  it("moves loose pieces only, edges closest to the board", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(1, 2000, 2000);
    state.snap(1);
    const moved = state.arrange({ edgesFirst: true });
    expect(moved).not.toContain(0);
    expect(moved).toHaveLength(10);
    // Pieces 5 and 6 are the only inner pieces, so they come last.
    expect(moved.slice(-2).sort()).toEqual([5, 6]);
  });
});

describe("PuzzleState.snap with canMerge", () => {
  it("skips neighbours that may not be merged (held by another player)", () => {
    const state = blank();
    state.moveGroup(0, 2000, 2000);
    state.moveGroup(1, 2003, 2002);
    expect(state.snap(1, (id) => id !== 0)).toBeNull();
    expect(state.groupCount).toBe(12);
  });
});

describe("PuzzleState.applySnap", () => {
  it("replays a snap computed on another machine", () => {
    const server = blank();
    const client = blank();
    server.moveGroup(0, 2000, 2000);
    client.moveGroup(0, 2000, 2000);
    server.moveGroup(1, 2005, 2005);
    const result = server.snap(1)!;
    expect(client.applySnap(result)).toBe(true);
    expect(client.snapshot()).toEqual(server.snapshot());
  });

  it("reports divergence when a group is missing", () => {
    const client = blank();
    expect(client.applySnap({ groupId: 99, absorbed: [], x: 0, y: 0, placed: false })).toBe(false);
    expect(client.applySnap({ groupId: 0, absorbed: [42], x: 0, y: 0, placed: false })).toBe(false);
  });
});
