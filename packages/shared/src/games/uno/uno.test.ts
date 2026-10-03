import { describe, expect, it } from "vitest";
import type { EngineContext } from "../engine";
import {
  UNO_CARDS,
  unoCard,
  unoEngine,
  unoOptionsSchema,
  unoMoveSchema,
  type UnoColor,
  type UnoMove,
  type UnoOptions,
  type UnoState,
  type UnoValue,
} from "./index";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ctx = (now = 1000, seed = 1): EngineContext => ({ now, random: seeded(seed) });
const OPTS: UnoOptions = { stacking: false, turnSeconds: 30 };

/** Id of a card by colour/value that is not in `used`. */
function find(color: UnoColor | "wild", value: UnoValue, used: Set<number>): number {
  const card = UNO_CARDS.find((c) => c.color === color && c.value === value && !used.has(c.id));
  if (!card) throw new Error(`no ${color} ${value}`);
  used.add(card.id);
  return card.id;
}

type Spec = [UnoColor | "wild", UnoValue];

/** A controlled game: given hands, top discard and the rest of the deck in id order. */
function game(
  hands: Spec[][],
  top: Spec,
  options: Partial<UnoOptions> = {},
  deckTop: Spec[] = [],
): UnoState {
  const used = new Set<number>();
  const handIds = hands.map((h) => h.map(([c, v]) => find(c, v, used)));
  const topId = find(top[0], top[1], used);
  const deckTopIds = deckTop.map(([c, v]) => find(c, v, used));
  const rest = UNO_CARDS.map((c) => c.id).filter((id) => !used.has(id));
  const state = unoEngine.setup(hands.length, { ...OPTS, ...options }, ctx());
  return {
    ...state,
    hands: handIds,
    discard: [topId],
    // The top of the deck is the end of the array.
    deck: [...rest, ...deckTopIds.reverse()],
    color: unoCard(topId).color === "wild" ? "red" : (unoCard(topId).color as UnoColor),
    direction: 1,
    turn: 0,
    hasDrawn: false,
    drawnCard: null,
    pendingDraw: 0,
    pendingType: null,
    log: [],
  };
}

function play(state: UnoState, seat: number, move: UnoMove, now = 2000) {
  const result = unoEngine.move(clone(state), seat, move, ctx(now));
  return result;
}

function ok(state: UnoState, seat: number, move: UnoMove, now = 2000): UnoState {
  const result = play(state, seat, move, now);
  if (!result.ok) throw new Error(`move failed: ${result.error}`);
  return result.state;
}

function idOf(state: UnoState, seat: number, color: UnoColor | "wild", value: UnoValue): number {
  const id = state.hands[seat]!.find((i) => {
    const c = unoCard(i);
    return c.color === color && c.value === value;
  });
  if (id === undefined) throw new Error("not in hand");
  return id;
}

function total(state: UnoState): number {
  return state.deck.length + state.discard.length + state.hands.reduce((a, h) => a + h.length, 0);
}

describe("deck and setup", () => {
  it("has 108 cards with the standard mix", () => {
    expect(UNO_CARDS).toHaveLength(108);
    expect(new Set(UNO_CARDS.map((c) => c.id)).size).toBe(108);
    const count = (pred: (c: (typeof UNO_CARDS)[number]) => boolean) =>
      UNO_CARDS.filter(pred).length;
    expect(count((c) => c.value === "0")).toBe(4);
    expect(count((c) => c.value === "7")).toBe(8);
    expect(count((c) => c.value === "skip")).toBe(8);
    expect(count((c) => c.value === "reverse")).toBe(8);
    expect(count((c) => c.value === "draw2")).toBe(8);
    expect(count((c) => c.value === "wild")).toBe(4);
    expect(count((c) => c.value === "wild4")).toBe(4);
    expect(count((c) => c.color === "red")).toBe(25);
  });

  it("deals 7 each and never starts with a Wild Draw Four", () => {
    for (let seed = 1; seed < 200; seed++) {
      const players = 2 + (seed % 7);
      const state = unoEngine.setup(players, OPTS, ctx(1000, seed));
      expect(total(state)).toBe(108);
      expect(unoCard(state.discard[0]!).value).not.toBe("wild4");
      const first = unoCard(state.discard[0]!);
      const sizes = state.hands.map((h) => h.length);
      if (first.value === "draw2") {
        expect(sizes[0]).toBe(9);
        expect(state.turn).toBe(1);
      } else {
        expect(sizes.every((s) => s === 7)).toBe(true);
      }
      if (first.value === "skip") expect(state.turn).toBe(1);
      if (first.value === "reverse") {
        expect(state.direction).toBe(-1);
        expect(state.turn).toBe(players - 1);
      }
      if (first.value === "wild") expect(state.color).toBeNull();
      if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "wild"].includes(first.value))
        expect(state.turn).toBe(0);
      expect(state.deadline).toBe(1000 + 30_000);
    }
  });

  it("is deterministic for a seed", () => {
    expect(unoEngine.setup(4, OPTS, ctx(0, 7))).toEqual(unoEngine.setup(4, OPTS, ctx(0, 7)));
  });

  it("parses options with defaults", () => {
    expect(unoOptionsSchema.parse(undefined)).toEqual({ stacking: false, turnSeconds: 30 });
    expect(unoOptionsSchema.parse({})).toEqual({ stacking: false, turnSeconds: 30 });
    expect(unoOptionsSchema.parse({ stacking: true, turnSeconds: 15 })).toEqual({
      stacking: true,
      turnSeconds: 15,
    });
    expect(unoOptionsSchema.safeParse({ turnSeconds: 20 }).success).toBe(false);
  });

  it("validates moves", () => {
    expect(unoMoveSchema.safeParse({ type: "play", card: 3, color: "red" }).success).toBe(true);
    expect(unoMoveSchema.safeParse({ type: "play", card: 108 }).success).toBe(false);
    expect(unoMoveSchema.safeParse({ type: "play", card: 3, color: "pink" }).success).toBe(false);
    expect(unoMoveSchema.safeParse({ type: "catch", seat: 2 }).success).toBe(true);
    expect(unoMoveSchema.safeParse({ type: "noop" }).success).toBe(false);
  });

  it("first Wild: seat 0 chooses the colour, or a random one on timeout", () => {
    let state = game([[["red", "5"]], [["blue", "5"]]], ["wild", "wild"]);
    state.color = null;
    expect(play(state, 0, { type: "play", card: idOf(state, 0, "red", "5") })).toEqual({
      ok: false,
      error: "choose_color",
    });
    expect(unoEngine.view(state, 0, 0).choosingColor).toBe(true);
    expect(play(state, 1, { type: "color", color: "red" })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
    const chosen = ok(state, 0, { type: "color", color: "blue" });
    expect(chosen.color).toBe("blue");
    expect(chosen.turn).toBe(0);
    expect(play(chosen, 0, { type: "color", color: "red" })).toEqual({
      ok: false,
      error: "not_choosing",
    });

    state = { ...state, deadline: 5000 };
    const timed = unoEngine.tick!(state, ctx(5000))!;
    expect(timed.color).not.toBeNull();
    expect(timed.turn).toBe(0);
    expect(state.color).toBeNull();
  });
});

describe("playing cards", () => {
  it("matches colour, number or symbol; wilds always", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["blue", "7"],
          ["green", "skip"],
          ["yellow", "2"],
          ["wild", "wild"],
          ["wild", "wild4"],
        ],
        [["blue", "1"]],
      ],
      ["red", "7"],
    );
    const view = unoEngine.view(state, 0, 0);
    const playable = view.playable.map((id) => `${unoCard(id).color} ${unoCard(id).value}`);
    expect(playable.sort()).toEqual(["blue 7", "red 3", "wild wild", "wild wild4"]);
    expect(play(state, 0, { type: "play", card: idOf(state, 0, "yellow", "2") })).toEqual({
      ok: false,
      error: "cant_play",
    });
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "blue", "7") });
    expect(next.color).toBe("blue");
    expect(next.turn).toBe(1);
    expect(next.deadline).toBe(2000 + 30_000);
    // Symbol on symbol.
    const s2 = game(
      [
        [
          ["green", "skip"],
          ["red", "1"],
        ],
        [["blue", "1"]],
        [["red", "2"]],
      ],
      ["red", "skip"],
    );
    expect(unoEngine.view(s2, 0, 0).playable).toContain(idOf(s2, 0, "green", "skip"));
  });

  it("rejects moves out of turn and cards not in hand", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [
          ["red", "5"],
          ["red", "6"],
        ],
      ],
      ["red", "7"],
    );
    expect(play(state, 1, { type: "play", card: idOf(state, 1, "red", "5") })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
    expect(play(state, 0, { type: "play", card: idOf(state, 1, "red", "5") })).toEqual({
      ok: false,
      error: "not_in_hand",
    });
  });

  it("wilds need a colour and set it", () => {
    const state = game(
      [
        [
          ["wild", "wild"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["blue", "7"],
    );
    const id = idOf(state, 0, "wild", "wild");
    expect(play(state, 0, { type: "play", card: id })).toEqual({
      ok: false,
      error: "color_required",
    });
    const next = ok(state, 0, { type: "play", card: id, color: "green" });
    expect(next.color).toBe("green");
    expect(next.log.at(-1)).toMatchObject({ kind: "play", seat: 0, color: "green" });
  });

  it("skip skips the next player", () => {
    const state = game(
      [
        [
          ["red", "skip"],
          ["red", "1"],
        ],
        [["red", "5"]],
        [["red", "6"]],
      ],
      ["red", "7"],
    );
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "skip") });
    expect(next.turn).toBe(2);
  });

  it("reverse changes direction; with two players it acts as skip", () => {
    const three = game(
      [
        [
          ["red", "reverse"],
          ["red", "1"],
        ],
        [["red", "5"]],
        [["red", "6"]],
      ],
      ["red", "7"],
    );
    const n3 = ok(three, 0, { type: "play", card: idOf(three, 0, "red", "reverse") });
    expect(n3.direction).toBe(-1);
    expect(n3.turn).toBe(2);

    const two = game(
      [
        [
          ["red", "reverse"],
          ["red", "1"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    const n2 = ok(two, 0, { type: "play", card: idOf(two, 0, "red", "reverse") });
    expect(n2.turn).toBe(0);
  });

  it("draw two: next player draws 2 and loses the turn", () => {
    const state = game(
      [
        [
          ["red", "draw2"],
          ["red", "1"],
        ],
        [["red", "5"]],
        [["red", "6"]],
      ],
      ["red", "7"],
    );
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "draw2") });
    expect(next.hands[1]).toHaveLength(3);
    expect(next.turn).toBe(2);
    expect(next.log.at(-1)).toMatchObject({ kind: "penalty", seat: 1, count: 2 });
  });

  it("wild draw four: playable any time, next draws 4 and loses the turn", () => {
    const state = game(
      [
        [
          ["wild", "wild4"],
          ["red", "1"],
        ],
        [["red", "5"]],
        [["red", "6"]],
      ],
      ["red", "7"],
    );
    const next = ok(state, 0, {
      type: "play",
      card: idOf(state, 0, "wild", "wild4"),
      color: "yellow",
    });
    expect(next.hands[1]).toHaveLength(5);
    expect(next.turn).toBe(2);
    expect(next.color).toBe("yellow");
  });

  it("emptying the hand wins", () => {
    const state = game([[["red", "3"]], [["red", "5"]]], ["red", "7"]);
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "3") });
    expect(unoEngine.result(next)).toEqual({ winners: [0], draw: false, reason: "empty-hand" });
    expect(unoEngine.active(next)).toEqual([]);
    expect(play(next, 1, { type: "draw" })).toEqual({ ok: false, error: "game_over" });
  });

  it("a last card that is an action still wins", () => {
    const state = game([[["red", "draw2"]], [["red", "5"]]], ["red", "7"]);
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "draw2") });
    expect(next.winner).toBe(0);
  });
});

describe("drawing and passing", () => {
  it("pass is only allowed after drawing", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    expect(play(state, 0, { type: "pass" })).toEqual({ ok: false, error: "cant_pass" });
  });

  it("an unplayable drawn card ends the turn", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
      {},
      [["blue", "1"]],
    );
    const next = ok(state, 0, { type: "draw" });
    expect(next.hands[0]).toHaveLength(3);
    expect(next.turn).toBe(1);
    expect(next.hasDrawn).toBe(false);
  });

  it("a playable drawn card may be played (only that one) or passed", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
      {},
      [["red", "9"]],
    );
    const drawn = ok(state, 0, { type: "draw" });
    expect(drawn.turn).toBe(0);
    expect(drawn.hasDrawn).toBe(true);
    const view = unoEngine.view(drawn, 0, 0);
    expect(view.drawnCard).toBe(idOf(drawn, 0, "red", "9"));
    expect(view.playable).toEqual([idOf(drawn, 0, "red", "9")]);
    expect(unoEngine.view(drawn, 1, 0).drawnCard).toBeNull();
    expect(play(drawn, 0, { type: "draw" })).toEqual({ ok: false, error: "already_drawn" });
    expect(play(drawn, 0, { type: "play", card: idOf(drawn, 0, "red", "3") })).toEqual({
      ok: false,
      error: "only_drawn_card",
    });
    const played = ok(drawn, 0, { type: "play", card: idOf(drawn, 0, "red", "9") });
    expect(played.turn).toBe(1);
    const passed = ok(drawn, 0, { type: "pass" });
    expect(passed.turn).toBe(1);
    expect(passed.hands[0]).toHaveLength(3);
    expect(passed.log.at(-1)).toMatchObject({ kind: "pass", seat: 0 });
  });

  it("reshuffles the discard pile (except the top) when the deck runs out", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    const used = [...state.deck];
    state.discard = [...used.slice(0, 10), state.discard[0]!];
    state.deck = [];
    // Park the remaining cards in a third pretend place: seat 1's hand.
    state.hands[1] = [...state.hands[1]!, ...used.slice(10)];
    const before = total(state);
    const top = state.discard.at(-1);
    const next = ok(state, 0, { type: "draw" });
    expect(total(next)).toBe(before);
    expect(next.discard).toEqual([top]);
    expect(next.deck.length + 1).toBe(10);
    expect(next.hands[0]).toHaveLength(3);
  });

  it("drawing from an empty table draws nothing and passes", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    state.hands[1] = [...state.hands[1]!, ...state.deck];
    state.deck = [];
    const next = ok(state, 0, { type: "draw" });
    expect(next.hands[0]).toHaveLength(2);
    expect(next.turn).toBe(1);
  });
});

describe("stacking", () => {
  it("is off by default: +2 cannot be answered", () => {
    const state = game(
      [
        [
          ["red", "draw2"],
          ["red", "1"],
        ],
        [
          ["blue", "draw2"],
          ["red", "2"],
        ],
      ],
      ["red", "7"],
    );
    const next = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "draw2") });
    expect(next.turn).toBe(0);
    expect(next.hands[1]).toHaveLength(4);
  });

  it("passes the total on, and the loser draws it all", () => {
    const state = game(
      [
        [
          ["red", "draw2"],
          ["red", "1"],
        ],
        [
          ["blue", "draw2"],
          ["red", "2"],
          ["wild", "wild4"],
        ],
        [
          ["green", "3"],
          ["green", "draw2"],
        ],
      ],
      ["red", "7"],
      { stacking: true },
    );
    let s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "draw2") });
    expect(s.turn).toBe(1);
    expect(s.pendingDraw).toBe(2);
    const v = unoEngine.view(s, 1, 0);
    expect(v.pendingDraw).toBe(2);
    expect(v.playable).toEqual([idOf(s, 1, "blue", "draw2")]);
    expect(play(s, 1, { type: "play", card: idOf(s, 1, "wild", "wild4"), color: "red" })).toEqual({
      ok: false,
      error: "cant_play",
    });
    expect(play(s, 1, { type: "pass" })).toEqual({ ok: false, error: "cant_pass" });
    s = ok(s, 1, { type: "play", card: idOf(s, 1, "blue", "draw2") });
    expect(s.pendingDraw).toBe(4);
    expect(s.turn).toBe(2);
    s = ok(s, 2, { type: "play", card: idOf(s, 2, "green", "draw2") });
    expect(s.pendingDraw).toBe(6);
    expect(s.turn).toBe(0);
    s = ok(s, 0, { type: "draw" });
    expect(s.hands[0]).toHaveLength(7);
    expect(s.pendingDraw).toBe(0);
    expect(s.turn).toBe(1);
    expect(s.log.at(-1)).toMatchObject({ kind: "penalty", seat: 0, count: 6 });
  });

  it("+4 answers +4 only", () => {
    const state = game(
      [
        [
          ["wild", "wild4"],
          ["red", "1"],
        ],
        [
          ["wild", "wild4"],
          ["red", "draw2"],
        ],
      ],
      ["red", "7"],
      { stacking: true },
    );
    let s = ok(state, 0, { type: "play", card: idOf(state, 0, "wild", "wild4"), color: "red" });
    expect(unoEngine.view(s, 1, 0).playable).toEqual([idOf(s, 1, "wild", "wild4")]);
    s = ok(s, 1, { type: "play", card: idOf(s, 1, "wild", "wild4"), color: "blue", uno: true });
    expect(s.pendingDraw).toBe(8);
    expect(s.turn).toBe(0);
  });

  it("timeout takes the pending total", () => {
    const state = game(
      [
        [
          ["red", "draw2"],
          ["red", "1"],
        ],
        [
          ["red", "5"],
          ["red", "6"],
        ],
      ],
      ["red", "7"],
      { stacking: true },
    );
    const s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "draw2") }, 2000);
    const t = unoEngine.tick!(s, ctx(2000 + 30_000))!;
    expect(t.hands[1]).toHaveLength(4);
    expect(t.turn).toBe(0);
    expect(t.pendingDraw).toBe(0);
  });
});

describe("Uno! call and catch", () => {
  it("calling Uno protects the player", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [
          ["red", "5"],
          ["red", "6"],
        ],
      ],
      ["red", "7"],
    );
    const s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "3"), uno: true });
    expect(unoEngine.view(s, 1, 0).catchable).toEqual([]);
    expect(unoEngine.view(s, 1, 0).unoSaid).toEqual([0]);
    expect(play(s, 1, { type: "catch", seat: 0 })).toEqual({ ok: false, error: "no_catch" });
  });

  it("forgetting Uno can be caught by any other player for 2 cards", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [
          ["red", "5"],
          ["red", "6"],
        ],
        [["blue", "1"]],
      ],
      ["red", "7"],
    );
    const s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "3") });
    expect(unoEngine.view(s, 2, 0).catchable).toEqual([0]);
    expect(play(s, 0, { type: "catch", seat: 0 })).toEqual({ ok: false, error: "no_catch" });
    const caught = ok(s, 2, { type: "catch", seat: 0 });
    expect(caught.hands[0]).toHaveLength(3);
    expect(caught.turn).toBe(1);
    expect(caught.log.at(-1)).toMatchObject({ kind: "catch", seat: 2, target: 0, count: 2 });
    expect(play(caught, 1, { type: "catch", seat: 0 })).toEqual({ ok: false, error: "no_catch" });
  });

  it("the window closes on the next action", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [
          ["red", "5"],
          ["red", "6"],
        ],
      ],
      ["red", "7"],
    );
    let s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "3") });
    s = ok(s, 1, { type: "play", card: idOf(s, 1, "red", "5"), uno: true });
    expect(unoEngine.view(s, 1, 0).catchable).toEqual([]);
    expect(play(s, 1, { type: "catch", seat: 0 })).toEqual({ ok: false, error: "no_catch" });
  });

  it("uno flag is ignored when not going down to one card", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
          ["red", "1"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    const s = ok(state, 0, { type: "play", card: idOf(state, 0, "red", "3"), uno: true });
    expect(unoEngine.view(s, 1, 0).unoSaid).toEqual([]);
  });
});

describe("timer", () => {
  it("does nothing before the deadline and never mutates its input", () => {
    const state = game([[["red", "3"]], [["red", "5"]]], ["red", "7"]);
    state.deadline = 10_000;
    expect(unoEngine.tick!(state, ctx(9_999))).toBeNull();
    const copy = clone(state);
    const t = unoEngine.tick!(state, ctx(10_000))!;
    expect(state).toEqual(copy);
    expect(t.hands[0]).toHaveLength(2);
    expect(t.turn).toBe(1);
    expect(t.deadline).toBe(10_000 + 30_000);
    expect(t.log.map((e) => e.kind)).toEqual(["draw", "timeout"]);
  });

  it("after drawing a playable card, timeout just passes", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
      {},
      [["red", "9"]],
    );
    const drawn = ok(state, 0, { type: "draw" }, 2000);
    const t = unoEngine.tick!(drawn, ctx(2000 + 30_000))!;
    expect(t.hands[0]).toHaveLength(3);
    expect(t.turn).toBe(1);
  });

  it("uses the option's turn length", () => {
    const state = unoEngine.setup(3, { stacking: false, turnSeconds: 15 }, ctx(0, 3));
    expect(state.deadline).toBe(15_000);
  });
});

describe("leaving", () => {
  it("puts the hand under the deck and skips the seat", () => {
    const state = game(
      [
        [
          ["red", "3"],
          ["red", "4"],
        ],
        [
          ["red", "5"],
          ["blue", "6"],
        ],
        [["green", "1"]],
      ],
      ["red", "7"],
    );
    const deckBefore = state.deck.length;
    const hand1 = [...state.hands[1]!];
    const s = unoEngine.leave(clone(state), 1, ctx());
    expect(s.left[1]).toBe(true);
    expect(s.hands[1]).toEqual([]);
    expect(s.deck.slice(0, 2)).toEqual(hand1);
    expect(s.deck.length).toBe(deckBefore + 2);
    expect(unoEngine.result(s)).toBeNull();
    const n = ok(s, 0, { type: "play", card: idOf(s, 0, "red", "3") });
    expect(n.turn).toBe(2);
    expect(play(s, 1, { type: "draw" })).toEqual({ ok: false, error: "not_a_player" });
  });

  it("passes the turn on when the current player leaves", () => {
    const state = game([[["red", "3"]], [["red", "5"]], [["green", "1"]]], ["red", "7"], {
      stacking: true,
    });
    state.pendingDraw = 4;
    state.pendingType = "draw2";
    const s = unoEngine.leave(clone(state), 0, ctx(5000));
    expect(s.turn).toBe(1);
    expect(s.pendingDraw).toBe(0);
    expect(s.deadline).toBe(5000 + 30_000);
  });

  it("the last player left wins", () => {
    const state = game([[["red", "3"]], [["red", "5"]], [["green", "1"]]], ["red", "7"]);
    let s = unoEngine.leave(clone(state), 0, ctx());
    expect(unoEngine.result(s)).toBeNull();
    s = unoEngine.leave(s, 2, ctx());
    expect(unoEngine.result(s)).toEqual({ winners: [1], draw: false, reason: "last-player" });
  });

  it("reverse acts as skip once only two players remain", () => {
    const state = game(
      [
        [
          ["red", "reverse"],
          ["red", "1"],
        ],
        [["red", "5"]],
        [["red", "6"]],
      ],
      ["red", "7"],
    );
    const s = unoEngine.leave(clone(state), 2, ctx());
    const n = ok(s, 0, { type: "play", card: idOf(s, 0, "red", "reverse") });
    expect(n.turn).toBe(0);
  });
});

describe("view", () => {
  it("hides other hands and the deck order", () => {
    const state = unoEngine.setup(4, OPTS, ctx(0, 11));
    const view = unoEngine.view(state, 1, 0);
    expect(view.hand.map((c) => c.id).sort()).toEqual([...state.hands[1]!].sort());
    expect(view.counts).toEqual(state.hands.map((h) => h.length));
    const json = JSON.stringify(view);
    expect(json).not.toContain('"deck"');
    expect(json).not.toContain('"hands"');
    const spectator = unoEngine.view(state, null, 0);
    expect(spectator.hand).toEqual([]);
    expect(spectator.playable).toEqual([]);
    expect(spectator.you).toBeNull();
  });

  it("sorts the hand by colour then value", () => {
    const state = game(
      [
        [
          ["wild", "wild"],
          ["blue", "2"],
          ["red", "skip"],
          ["red", "3"],
          ["yellow", "0"],
        ],
        [["red", "5"]],
      ],
      ["red", "7"],
    );
    const hand = unoEngine.view(state, 0, 0).hand.map((c) => `${c.color} ${c.value}`);
    expect(hand).toEqual(["red 3", "red skip", "yellow 0", "blue 2", "wild wild"]);
  });

  it("only the player on turn has playable cards", () => {
    const state = game([[["red", "3"]], [["red", "5"]]], ["red", "7"]);
    expect(unoEngine.view(state, 1, 0).playable).toEqual([]);
    expect(unoEngine.active(state)).toEqual([0]);
  });
});

describe("random games", () => {
  it("always end with a winner and keep 108 cards", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const players = 2 + (seed % 7);
      const random = seeded(seed * 31);
      let state = unoEngine.setup(
        players,
        { stacking: seed % 2 === 0, turnSeconds: 30 },
        {
          now: 0,
          random,
        },
      );
      let now = 0;
      for (let step = 0; step < 5000 && state.winner === null; step++) {
        now += 100;
        const c = { now, random };
        if (state.color === null) {
          state = (
            unoEngine.move(state, state.turn, { type: "color", color: "green" }, c) as {
              state: UnoState;
            }
          ).state;
          continue;
        }
        const view = unoEngine.view(state, state.turn, now);
        let move: UnoMove;
        if (view.playable.length > 0 && random() < 0.9) {
          const id = view.playable[Math.floor(random() * view.playable.length)]!;
          move = { type: "play", card: id, color: "blue", uno: random() < 0.7 };
        } else if (view.hasDrawn) move = { type: "pass" };
        else move = { type: "draw" };
        const result = unoEngine.move(clone(state), state.turn, move, c);
        if (!result.ok) throw new Error(`seed ${seed}: ${result.error}`);
        state = result.state;
        expect(total(state)).toBe(108);
        if (step % 50 === 7 && players > 2 && !state.left[players - 1])
          state = unoEngine.leave(state, players - 1, c);
      }
      expect(state.winner).not.toBeNull();
    }
  });
});
