import { describe, expect, it } from "vitest";
import { canMate, chessEngine as engine, type ChessMove, type ChessState } from "./index";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ctx = (now = 0) => ({ now, random: () => 0.5 });

function start(minutes = 0, increment = 0, now = 0): ChessState {
  const options = engine.optionsSchema.parse({ minutes, increment });
  return engine.setup(2, options, ctx(now));
}

function play(state: ChessState, seat: number, move: ChessMove, now = 0): ChessState {
  const parsed = engine.moveSchema.parse(move);
  const result = engine.move(clone(state), seat, parsed, ctx(now));
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function attempt(state: ChessState, seat: number, move: ChessMove, now = 0) {
  return engine.move(clone(state), seat, engine.moveSchema.parse(move), ctx(now));
}

/** Plays UCI moves alternately starting with white. */
function line(state: ChessState, ucis: string[], now = 0): ChessState {
  for (const uci of ucis) {
    const seat = state.fen.split(" ")[1] === "w" ? 0 : 1;
    state = play(
      state,
      seat,
      {
        type: "move",
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: (uci[4] as "q" | undefined) ?? undefined,
      },
      now,
    );
  }
  return state;
}

/** A state from a custom position (no history). */
function fromFen(fen: string): ChessState {
  return { ...start(), startFen: fen, fen };
}

describe("options", () => {
  it("defaults to 10+0", () => {
    expect(engine.optionsSchema.parse({})).toEqual({ minutes: 10, increment: 0 });
  });
  it("rejects unknown time controls", () => {
    expect(engine.optionsSchema.safeParse({ minutes: 7 }).success).toBe(false);
    expect(engine.optionsSchema.safeParse({ minutes: 5, increment: 4 }).success).toBe(false);
  });
  it("minutes 0 means no clock", () => {
    expect(start(0).clock).toBeNull();
    expect(start(5, 3).clock).toEqual({
      increment: 3000,
      remaining: [300_000, 300_000],
      turnStartedAt: 0,
    });
  });
});

describe("move schema", () => {
  it("rejects bad squares and promotion pieces", () => {
    const s = engine.moveSchema;
    expect(s.safeParse({ type: "move", from: "e9", to: "e4" }).success).toBe(false);
    expect(s.safeParse({ type: "move", from: "e2", to: "e4", promotion: "k" }).success).toBe(false);
    expect(s.safeParse({ type: "resign" }).success).toBe(false);
  });
});

describe("moves", () => {
  it("plays legal moves and records SAN", () => {
    const s = line(start(), ["e2e4", "e7e5", "g1f3"]);
    expect(s.san).toEqual(["e4", "e5", "Nf3"]);
    expect(engine.active(s)).toEqual([1]);
  });

  it("rejects illegal moves and the wrong side", () => {
    const s = start();
    expect(attempt(s, 1, { type: "move", from: "e7", to: "e5" })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
    expect(attempt(s, 0, { type: "move", from: "e2", to: "e5" })).toEqual({
      ok: false,
      error: "illegal",
    });
    expect(attempt(s, 0, { type: "move", from: "e7", to: "e5" })).toEqual({
      ok: false,
      error: "illegal",
    });
  });

  it("castles both ways", () => {
    let s = line(start(), ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "d7d6", "e1g1"]);
    expect(s.san.at(-1)).toBe("O-O");
    expect(s.fen.split(" ")[0]).toContain("RNBQ1RK1");
    s = line(s, ["c8g4", "d2d3", "d8d7", "b1c3"]);
    s = line(s, ["e8c8"]);
    expect(s.san.at(-1)).toBe("O-O-O");
  });

  it("refuses castling through check", () => {
    // Black bishop on c5 covers f2... use rook on f8 attacking f1.
    const s = fromFen("4kr2/8/8/8/8/8/8/4K2R w K - 0 1");
    expect(attempt(s, 0, { type: "move", from: "e1", to: "g1" })).toMatchObject({ ok: false });
  });

  it("captures en passant", () => {
    const s = line(start(), ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
    expect(s.san.at(-1)).toBe("exd6");
    expect(s.captured).toEqual(["p"]);
    const v = engine.view(s, 0, 0);
    expect(v.captured.white).toEqual(["p"]);
    expect(v.material).toBe(1);
  });

  it("requires and applies a promotion piece", () => {
    const s = fromFen("8/P7/8/8/8/8/8/k6K w - - 0 1");
    expect(attempt(s, 0, { type: "move", from: "a7", to: "a8" })).toEqual({
      ok: false,
      error: "promotion_required",
    });
    const next = play(s, 0, { type: "move", from: "a7", to: "a8", promotion: "n" });
    expect(next.san.at(-1)).toBe("a8=N");
    expect(next.fen.startsWith("N7/")).toBe(true);
  });

  it("ignores a promotion piece on a normal move", () => {
    const s = play(start(), 0, { type: "move", from: "e2", to: "e4", promotion: "q" });
    expect(s.san).toEqual(["e4"]);
  });
});

describe("game end", () => {
  it("checkmate (fool's mate)", () => {
    const s = line(start(), ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(engine.result(s)).toEqual({ winners: [1], draw: false, reason: "checkmate" });
    expect(engine.active(s)).toEqual([]);
    expect(engine.view(s, 0, 0).check).toBe("e1");
    expect(attempt(s, 0, { type: "move", from: "a2", to: "a3" })).toEqual({
      ok: false,
      error: "game_over",
    });
  });

  it("stalemate", () => {
    const s = fromFen("7k/8/6Q1/8/8/8/8/K7 w - - 0 1");
    const next = play(s, 0, { type: "move", from: "g6", to: "f7" });
    expect(engine.result(next)).toEqual({ winners: [], draw: true, reason: "stalemate" });
  });

  it("insufficient material", () => {
    const s = fromFen("8/8/8/8/1k6/8/3q4/3K4 w - - 0 1");
    const next = play(s, 0, { type: "move", from: "d1", to: "d2" });
    expect(engine.result(next)?.reason).toBe("insufficient");
  });

  it("threefold repetition", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    let s = line(start(), shuffle);
    expect(engine.result(s)).toBeNull();
    s = line(s, shuffle);
    expect(engine.result(s)).toEqual({ winners: [], draw: true, reason: "threefold" });
  });

  it("fifty-move rule", () => {
    const s = fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 80");
    const next = play(s, 0, { type: "move", from: "a1", to: "a2" });
    expect(engine.result(next)?.reason).toBe("fifty");
  });

  it("checkmate beats the fifty-move rule", () => {
    const s = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80");
    const next = play(s, 0, { type: "move", from: "a1", to: "a8" });
    expect(engine.result(next)?.reason).toBe("checkmate");
  });

  it("leaving resigns", () => {
    const s = engine.leave(start(), 0, ctx());
    expect(engine.result(s)).toEqual({ winners: [1], draw: false, reason: "resign" });
    // Leaving after the end changes nothing.
    expect(engine.leave(clone(s), 1, ctx()).result?.winners).toEqual([1]);
  });
});

describe("draw offers", () => {
  it("offer and accept", () => {
    let s = play(start(), 0, { type: "offer-draw" });
    expect(engine.view(s, 1, 0).drawOffer).toBe(0);
    expect(attempt(s, 0, { type: "accept-draw" })).toEqual({ ok: false, error: "no_draw_offer" });
    s = play(s, 1, { type: "accept-draw" });
    expect(engine.result(s)).toEqual({ winners: [], draw: true, reason: "agreement" });
  });

  it("decline, and only one offer per move", () => {
    let s = play(start(), 0, { type: "offer-draw" });
    s = play(s, 1, { type: "decline-draw" });
    expect(s.drawOffer).toBeNull();
    expect(attempt(s, 0, { type: "offer-draw" })).toEqual({
      ok: false,
      error: "draw_offer_limit",
    });
    expect(engine.view(s, 0, 0).canOfferDraw).toBe(false);
    s = line(s, ["e2e4"]);
    expect(engine.view(s, 0, 0).canOfferDraw).toBe(true);
  });

  it("an offer stays while the offerer moves and ends when the other side moves", () => {
    let s = play(start(), 0, { type: "offer-draw" });
    s = line(s, ["e2e4"]);
    expect(s.drawOffer).toBe(0);
    s = line(s, ["e7e5"]);
    expect(s.drawOffer).toBeNull();
  });

  it("two offers make an agreement", () => {
    let s = play(start(), 0, { type: "offer-draw" });
    s = play(s, 1, { type: "offer-draw" });
    expect(engine.result(s)?.reason).toBe("agreement");
  });
});

describe("clock", () => {
  it("deducts time and adds the increment", () => {
    let s = start(3, 2, 1000);
    s = play(s, 0, { type: "move", from: "e2", to: "e4" }, 6000);
    expect(s.clock!.remaining).toEqual([180_000 - 5000 + 2000, 180_000]);
    expect(s.clock!.turnStartedAt).toBe(6000);
    s = play(s, 1, { type: "move", from: "e7", to: "e5" }, 16_000);
    expect(s.clock!.remaining[1]).toBe(180_000 - 10_000 + 2000);
    const v = engine.view(s, null, 16_000);
    expect(v.clock).toMatchObject({ running: 0, turnStartedAt: 16_000 });
  });

  it("tick does nothing before the flag falls and does not mutate", () => {
    const s = start(3, 0, 0);
    expect(engine.tick!(s, ctx(179_999))).toBeNull();
    const copy = clone(s);
    const next = engine.tick!(s, ctx(180_000));
    expect(s).toEqual(copy);
    expect(engine.result(next!)).toEqual({ winners: [1], draw: false, reason: "timeout" });
    expect(next!.clock!.remaining[0]).toBe(0);
  });

  it("flag fall is a draw when the opponent cannot mate", () => {
    const s: ChessState = {
      ...start(3, 0, 0),
      startFen: "4k3/8/8/8/8/8/4P3/4K1n1 w - - 0 1",
      fen: "4k3/8/8/8/8/8/4P3/4K1n1 w - - 0 1",
    };
    const next = engine.tick!(s, ctx(200_000));
    expect(engine.result(next!)).toEqual({ winners: [], draw: true, reason: "timeout" });
  });

  it("a move after the flag fell loses on time", () => {
    const s = start(3, 0, 0);
    const r = attempt(s, 0, { type: "move", from: "e2", to: "e4" }, 181_000);
    expect(r.ok && r.state.result?.reason).toBe("timeout");
    expect(r.ok && r.state.san).toEqual([]);
  });

  it("no clock: tick never ends the game", () => {
    expect(engine.tick!(start(0), ctx(10 ** 12))).toBeNull();
  });
});

describe("view", () => {
  it("lists legal moves only for the side to move", () => {
    const s = start();
    const white = engine.view(s, 0, 0);
    expect(Object.keys(white.legal)).toHaveLength(10);
    expect(white.legal["g1"]?.sort()).toEqual(["f3", "h3"]);
    expect(engine.view(s, 1, 0).legal).toEqual({});
    expect(engine.view(s, null, 0).legal).toEqual({});
  });

  it("shows the last move and is JSON-safe", () => {
    const s = line(start(), ["e2e4"]);
    const v = engine.view(s, 1, 0);
    expect(v.lastMove).toEqual({ from: "e2", to: "e4" });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("canMate", () => {
    expect(canMate("4k3/8/8/8/8/8/8/4K3 w - - 0 1", 0)).toBe(false);
    expect(canMate("4k3/8/8/8/8/8/8/3NK3 w - - 0 1", 0)).toBe(false);
    expect(canMate("4k3/8/8/8/8/8/8/2NNK3 w - - 0 1", 0)).toBe(true);
    expect(canMate("4k3/p7/8/8/8/8/8/4K3 w - - 0 1", 1)).toBe(true);
  });
});
