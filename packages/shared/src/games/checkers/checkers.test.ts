import { describe, expect, it } from "vitest";
import {
  CHECKERS_KINGS_ONLY_PLIES,
  checkersEngine as engine,
  createCheckersState,
  legalSteps,
  parseSquare,
  squareName,
  type CheckersMove,
  type CheckersPiece,
  type CheckersSeat,
  type CheckersState,
} from "./index";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ctx = (now = 1000) => ({ now, random: () => 0.5 });
const sq = (name: string) => {
  const s = parseSquare(name);
  if (s === null) throw new Error(`bad square ${name}`);
  return s;
};

/** Pieces by kind: w/b men, W/B kings. */
function position(
  spec: { w?: string[]; W?: string[]; b?: string[]; B?: string[] },
  turn: CheckersSeat = 0,
  turnSeconds: 0 | 30 | 60 = 0,
): CheckersState {
  const pieces: CheckersPiece[] = [];
  const add = (names: string[] | undefined, owner: CheckersSeat, king: boolean) => {
    for (const name of names ?? [])
      pieces.push({ id: pieces.length, owner, king, square: sq(name) });
  };
  add(spec.w, 0, false);
  add(spec.W, 0, true);
  add(spec.b, 1, false);
  add(spec.B, 1, true);
  return createCheckersState(pieces, turn, { turnSeconds }, 1000);
}

function play(state: CheckersState, seat: number, move: CheckersMove, now = 1000) {
  const result = engine.move(clone(state), seat, move, ctx(now));
  if (!result.ok) throw new Error(`move failed: ${result.error}`);
  return result.state;
}

function stepOf(state: CheckersState, seat: number, from: string, to: string) {
  return play(state, seat, { type: "step", from: sq(from), to: sq(to) });
}

function tryStep(state: CheckersState, seat: number, from: string, to: string) {
  return engine.move(clone(state), seat, { type: "step", from: sq(from), to: sq(to) }, ctx());
}

const moves = (state: CheckersState) =>
  legalSteps(state)
    .map((s) => `${squareName(s.from)}-${squareName(s.to)}`)
    .sort();

const at = (state: CheckersState, name: string) => state.pieces.find((p) => p.square === sq(name));

describe("checkers setup", () => {
  it("places 12 men each and white moves first with 7 moves", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    expect(state.pieces.filter((p) => p.owner === 0)).toHaveLength(12);
    expect(state.pieces.filter((p) => p.owner === 1)).toHaveLength(12);
    expect(at(state, "a1")?.owner).toBe(0);
    expect(at(state, "h8")?.owner).toBe(1);
    expect(at(state, "b2")?.owner).toBe(0);
    expect(at(state, "a2")).toBeUndefined();
    expect(at(state, "d4")).toBeUndefined();
    expect(state.turn).toBe(0);
    expect(moves(state)).toEqual(
      ["a3-b4", "c3-b4", "c3-d4", "e3-d4", "e3-f4", "g3-f4", "g3-h4"].sort(),
    );
    expect(engine.active(state)).toEqual([0]);
    expect(state.deadline).toBeNull();
  });

  it("parses options with defaults", () => {
    expect(engine.optionsSchema.parse(undefined)).toEqual({ turnSeconds: 0 });
    expect(engine.optionsSchema.parse({})).toEqual({ turnSeconds: 0 });
    expect(engine.optionsSchema.parse({ turnSeconds: 30 })).toEqual({ turnSeconds: 30 });
    expect(engine.optionsSchema.safeParse({ turnSeconds: 45 }).success).toBe(false);
  });

  it("validates moves", () => {
    expect(engine.moveSchema.safeParse({ type: "step", from: 0, to: 64 }).success).toBe(false);
    expect(engine.moveSchema.safeParse({ type: "step", from: 0, to: 9 }).success).toBe(true);
    expect(engine.moveSchema.safeParse({ type: "offer-draw" }).success).toBe(true);
  });

  it("names squares like a real board", () => {
    expect(squareName(0)).toBe("a1");
    expect(squareName(63)).toBe("h8");
    expect(sq("c3")).toBe(18);
  });
});

describe("checkers moves", () => {
  it("only lets the side to move play, and alternates turns", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    expect(tryStep(state, 1, "b6", "a5")).toEqual({ ok: false, error: "not_your_turn" });
    const next = stepOf(state, 0, "c3", "d4");
    expect(next.turn).toBe(1);
    expect(next.lastMove).toEqual({ seat: 0, path: [sq("c3"), sq("d4")], captured: [] });
    expect(tryStep(next, 1, "b6", "c7")).toEqual({ ok: false, error: "illegal_move" });
    expect(stepOf(next, 1, "b6", "a5").turn).toBe(0);
  });

  it("men move only forward when not capturing", () => {
    const state = position({ w: ["d4"], b: ["h8"] });
    expect(moves(state)).toEqual(["d4-c5", "d4-e5"]);
    const black = position({ w: ["a1"], b: ["d4"] }, 1);
    expect(moves(black)).toEqual(["d4-c3", "d4-e3"]);
  });

  it("makes capturing mandatory", () => {
    const state = position({ w: ["c3", "g3"], b: ["d4", "h8"] });
    expect(moves(state)).toEqual(["c3-e5"]);
    expect(tryStep(state, 0, "g3", "h4")).toEqual({ ok: false, error: "must_capture" });
    const next = stepOf(state, 0, "c3", "e5");
    expect(at(next, "d4")).toBeUndefined();
    expect(next.lastMove?.captured).toEqual([sq("d4")]);
    expect(next.turn).toBe(1);
  });

  it("lets men capture backwards", () => {
    const state = position({ w: ["e5"], b: ["d4", "a7"] });
    expect(moves(state)).toEqual(["e5-c3"]);
  });

  it("lets the player choose which capture, not necessarily the longest", () => {
    // a3xc5 takes one piece; e3xc5xa7 would take two. Both are allowed.
    const state = position({ w: ["a3", "e3"], b: ["b4", "d4", "b6", "h8"] });
    expect(moves(state)).toEqual(["a3-c5", "e3-c5"]);
    const short = stepOf(state, 0, "a3", "c5");
    // From c5 the man can go on over b6 to a7: the same piece must continue.
    expect(short.turn).toBe(0);
    expect(short.chain?.square).toBe(sq("c5"));
  });

  it("continues a multi-jump with the same piece and removes pieces at the end", () => {
    const state = position({ w: ["a1", "g1"], b: ["b2", "d4", "h8"] });
    // a1 cannot capture b2 (c3 is the landing): a1xc3xe5.
    let next = stepOf(state, 0, "a1", "c3");
    expect(next.turn).toBe(0);
    expect(next.chain).toMatchObject({ square: sq("c3"), captured: [sq("b2")] });
    // Captured piece is still on the board during the sequence.
    expect(at(next, "b2")?.owner).toBe(1);
    expect(moves(next)).toEqual(["c3-e5"]);
    expect(tryStep(next, 0, "g1", "h2")).toEqual({ ok: false, error: "must_continue" });

    const view = engine.view(next, 0, 1000);
    expect(view.continuing).toBe(sq("c3"));
    expect(view.capturing).toEqual([sq("b2")]);
    expect(view.lastMove?.path).toEqual([sq("a1"), sq("c3")]);
    expect(engine.view(next, 1, 1000).legal).toEqual([]);

    next = stepOf(next, 0, "c3", "e5");
    expect(next.turn).toBe(1);
    expect(next.chain).toBeNull();
    expect(next.pieces.filter((p) => p.owner === 1).map((p) => squareName(p.square))).toEqual([
      "h8",
    ]);
    expect(next.lastMove).toEqual({
      seat: 0,
      path: [sq("a1"), sq("c3"), sq("e5")],
      captured: [sq("b2"), sq("d4")],
    });
  });

  it("promotes a man on the last row", () => {
    const state = position({ w: ["c7"], b: ["h2"] });
    const next = stepOf(state, 0, "c7", "d8");
    expect(at(next, "d8")?.king).toBe(true);
    const black = stepOf(position({ w: ["a1"], b: ["e2"] }, 1), 1, "e2", "f1");
    expect(at(black, "f1")?.king).toBe(true);
  });

  it("crowns a man mid-capture and continues capturing as a king", () => {
    // c6xe8 crowns; then the new king flies e8-f7 over g6 to h5.
    const state = position({ w: ["c6"], b: ["d7", "g6", "a3"] });
    let next = stepOf(state, 0, "c6", "e8");
    expect(at(next, "e8")?.king).toBe(true);
    expect(next.turn).toBe(0);
    expect(moves(next)).toEqual(["e8-h5"]);
    next = stepOf(next, 0, "e8", "h5");
    expect(next.turn).toBe(1);
    expect(next.pieces.filter((p) => p.owner === 1)).toHaveLength(1);
  });
});

describe("checkers kings", () => {
  it("fly any distance along a diagonal", () => {
    const state = position({ W: ["a1"], b: ["h2"] });
    expect(moves(state)).toEqual(["a1-b2", "a1-c3", "a1-d4", "a1-e5", "a1-f6", "a1-g7", "a1-h8"]);
  });

  it("capture from a distance and may land on any empty square beyond", () => {
    const state = position({ W: ["a1"], b: ["d4", "a7"] });
    expect(moves(state)).toEqual(["a1-e5", "a1-f6", "a1-g7", "a1-h8"]);
  });

  it("must land where the capture can continue when that is possible", () => {
    // a1xd4 could land on e5, f6, g7 or h8, but only from f6 can the king take g5 next.
    const state = position({ W: ["a1"], b: ["d4", "g5", "a7"] });
    expect(moves(state)).toEqual(["a1-f6"]);
    let next = stepOf(state, 0, "a1", "f6");
    expect(moves(next)).toEqual(["f6-h4"]);
    next = stepOf(next, 0, "f6", "h4");
    expect(next.turn).toBe(1);
  });

  it("cannot jump two pieces in a row or a piece guarded behind", () => {
    const state = position({ W: ["a1"], b: ["c3", "d4", "h8"] });
    expect(moves(state).some((m) => m.startsWith("a1-") && m !== "a1-b2")).toBe(false);
    expect(moves(state)).toEqual(["a1-b2"]);
  });

  it("follows the Turkish strike rule: captured pieces block until the move ends", () => {
    // c1xd2 → e3/f4, e3xd4 → c5, c5xb4 → a3, a3xb2 → c1. Back on c1 the jumped d2 still
    // stands in the way of g5, so the move ends there with four pieces taken.
    const state = position({ W: ["c1"], b: ["d2", "d4", "b4", "b2", "g5"] });
    expect(moves(state)).toEqual(["c1-a3", "c1-e3", "c1-f4"]);
    let next = stepOf(state, 0, "c1", "e3");
    // Over d4 only c5 lets the king continue (b6, a7 do not).
    expect(moves(next)).toEqual(["e3-c5", "e3-h6"]);
    next = stepOf(next, 0, "e3", "c5");
    expect(moves(next)).toEqual(["c5-a3"]);
    next = stepOf(next, 0, "c5", "a3");
    expect(moves(next)).toEqual(["a3-c1"]);
    next = stepOf(next, 0, "a3", "c1");
    expect(next.turn).toBe(1);
    expect(next.pieces.filter((p) => p.owner === 1).map((p) => squareName(p.square))).toEqual([
      "g5",
    ]);
    expect(next.lastMove?.captured).toHaveLength(4);
  });
});

describe("checkers endings", () => {
  it("wins when the opponent has no pieces left", () => {
    const next = stepOf(position({ w: ["c3"], b: ["d4"] }), 0, "c3", "e5");
    expect(engine.result(next)).toEqual({ winners: [0], draw: false, reason: "no_pieces" });
    expect(engine.active(next)).toEqual([]);
    expect(engine.move(clone(next), 1, { type: "offer-draw" }, ctx())).toEqual({
      ok: false,
      error: "game_over",
    });
  });

  it("wins when the opponent cannot move", () => {
    // Black's man on h2 is blocked by g1 and cannot capture.
    const next = stepOf(position({ w: ["g1", "a1"], b: ["h2"] }), 0, "a1", "b2");
    expect(engine.result(next)).toEqual({ winners: [0], draw: false, reason: "no_moves" });
  });

  it("draws on threefold repetition", () => {
    let state = position({ W: ["a1"], B: ["h4"] });
    const shuffle = [
      ["a1", "b2"],
      ["h4", "g5"],
      ["b2", "a1"],
      ["g5", "h4"],
    ] as const;
    for (let round = 0; round < 2; round++) {
      for (const [i, [from, to]] of shuffle.entries()) {
        expect(engine.result(state)).toBeNull();
        state = stepOf(state, i % 2, from, to);
      }
    }
    expect(engine.result(state)).toEqual({ winners: [], draw: true, reason: "repetition" });
  });

  it("draws after 15 moves each with only kings moving and no captures", () => {
    const state = position({ W: ["a1"], B: ["h4"], w: ["e1"], b: ["a7"] });
    state.kingsOnlyPlies = CHECKERS_KINGS_ONLY_PLIES - 2;
    let next = stepOf(state, 0, "a1", "b2");
    expect(engine.result(next)).toBeNull();
    next = stepOf(next, 1, "h4", "g5");
    expect(engine.result(next)).toEqual({ winners: [], draw: true, reason: "kings_only" });

    // A man move resets the count.
    const reset = stepOf(state, 0, "e1", "d2");
    expect(reset.kingsOnlyPlies).toBe(0);
  });

  it("handles draw offers", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    expect(engine.move(clone(state), 1, { type: "accept-draw" }, ctx())).toEqual({
      ok: false,
      error: "no_draw_offer",
    });
    let next = play(state, 0, { type: "offer-draw" });
    expect(next.drawOffer).toBe(0);
    expect(engine.view(next, 1, 1000).drawOffer).toBe(0);
    expect(engine.view(next, 0, 1000).canOfferDraw).toBe(false);
    expect(engine.move(clone(next), 0, { type: "accept-draw" }, ctx()).ok).toBe(false);

    const declined = play(next, 1, { type: "decline-draw" });
    expect(declined.drawOffer).toBeNull();
    // No new offer from the same seat before a move is made.
    expect(engine.move(clone(declined), 0, { type: "offer-draw" }, ctx())).toEqual({
      ok: false,
      error: "draw_offer_wait",
    });

    const accepted = play(next, 1, { type: "accept-draw" });
    expect(engine.result(accepted)).toEqual({ winners: [], draw: true, reason: "agreement" });

    // The offerer may still move; the opponent moving instead declines it.
    next = stepOf(next, 0, "c3", "d4");
    expect(next.drawOffer).toBe(0);
    next = stepOf(next, 1, "b6", "a5");
    expect(next.drawOffer).toBeNull();
  });

  it("loses on resign or leaving", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    expect(engine.result(engine.leave(clone(state), 0, ctx()))).toEqual({
      winners: [1],
      draw: false,
      reason: "resign",
    });
  });

  it("loses on time when a turn limit is set", () => {
    const state = engine.setup(2, { turnSeconds: 30 }, ctx(1000));
    expect(state.deadline).toBe(31_000);
    expect(engine.view(state, 0, 1000).deadline).toBe(31_000);
    expect(engine.tick!(state, ctx(30_999))).toBeNull();
    const next = play(state, 0, { type: "step", from: sq("c3"), to: sq("d4") }, 20_000);
    expect(next.deadline).toBe(50_000);
    const timedOut = engine.tick!(next, ctx(50_000));
    expect(timedOut?.result).toEqual({ winners: [0], draw: false, reason: "timeout" });
    expect(next.result).toBeNull(); // tick did not mutate its input
  });

  it("has no deadline without a turn limit", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    expect(engine.tick!(state, ctx(10 ** 12))).toBeNull();
  });
});

describe("checkers view", () => {
  it("shows legal steps only to the side to move", () => {
    const state = engine.setup(2, { turnSeconds: 0 }, ctx());
    const white = engine.view(state, 0, 1000);
    expect(white.legal).toHaveLength(7);
    expect(white.seat).toBe(0);
    expect(white.counts).toEqual([12, 12]);
    expect(white.mustCapture).toBe(false);
    expect(engine.view(state, 1, 1000).legal).toEqual([]);
    expect(engine.view(state, null, 1000).seat).toBeNull();
    // Plain JSON.
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
