import { describe, expect, it } from "vitest";
import {
  BATTLESHIP_PLACEMENT_MS,
  SHOT_AROUND,
  SHOT_HIT,
  SHOT_MISS,
  battleshipEngine as engine,
  canPlace,
  cellIndex,
  cellName,
  isValidFleet,
  randomFleet,
  shipCells,
  type BattleshipMove,
  type BattleshipState,
  type Ship,
} from ".";

/** A seeded random source (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLEET_A: Ship[] = [
  { x: 0, y: 0, length: 4, vertical: false },
  { x: 5, y: 0, length: 3, vertical: false },
  { x: 0, y: 2, length: 3, vertical: true },
  { x: 2, y: 2, length: 2, vertical: false },
  { x: 5, y: 2, length: 2, vertical: false },
  { x: 8, y: 2, length: 2, vertical: true },
  { x: 2, y: 6, length: 1, vertical: false },
  { x: 4, y: 6, length: 1, vertical: false },
  { x: 6, y: 6, length: 1, vertical: false },
  { x: 9, y: 9, length: 1, vertical: false },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let now = 1_000;
const ctx = (seed = 1) => ({ now, random: seeded(seed) });

function play(state: BattleshipState, seat: number, move: BattleshipMove) {
  const parsed = engine.moveSchema.safeParse(move);
  if (!parsed.success) return { ok: false as const, error: "schema" };
  return engine.move(clone(state), seat, parsed.data, ctx());
}

function must(state: BattleshipState, seat: number, move: BattleshipMove) {
  const result = play(state, seat, move);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function battle(turnSeconds: 0 | 30 | 45 | 60 = 45) {
  now = 1_000;
  let state = engine.setup(2, { turnSeconds }, ctx());
  state = must(state, 0, { type: "place", ships: FLEET_A });
  state = must(state, 1, { type: "place", ships: FLEET_A });
  return state;
}

/** Cells of FLEET_A that are water and not next to a ship. */
const water = (() => {
  const busy = new Set<number>();
  for (const ship of FLEET_A) for (const c of shipCells(ship)) busy.add(c);
  return Array.from({ length: 100 }, (_, i) => i).filter((i) => !busy.has(i));
})();

const at = (cell: number) => ({ x: cell % 10, y: Math.floor(cell / 10) });

describe("fleet rules", () => {
  it("accepts the classic fleet", () => {
    expect(isValidFleet(FLEET_A)).toBe(true);
  });

  it("rejects touching ships, even diagonally", () => {
    const touching = FLEET_A.map((s) => ({ ...s }));
    touching[9] = { x: 7, y: 7, length: 1, vertical: false }; // diagonal to (6,6)
    expect(isValidFleet(touching)).toBe(false);
    const adjacent = FLEET_A.map((s) => ({ ...s }));
    adjacent[9] = { x: 4, y: 0, length: 1, vertical: false }; // right after the 4-deck
    expect(isValidFleet(adjacent)).toBe(false);
  });

  it("rejects a wrong fleet composition or ships off the board", () => {
    expect(isValidFleet(FLEET_A.slice(0, 9))).toBe(false);
    const twoFours = FLEET_A.map((s) => ({ ...s }));
    twoFours[1] = { x: 5, y: 0, length: 4, vertical: false };
    expect(isValidFleet(twoFours)).toBe(false);
    const off = FLEET_A.map((s) => ({ ...s }));
    off[0] = { x: 8, y: 9, length: 4, vertical: false };
    expect(isValidFleet(off)).toBe(false);
    expect(canPlace([], { x: 7, y: 0, length: 4, vertical: false })).toBe(false);
    expect(canPlace([], { x: 6, y: 0, length: 4, vertical: false })).toBe(true);
    expect(canPlace([], { x: 0, y: 7, length: 4, vertical: true })).toBe(false);
  });

  it("makes legal random fleets", () => {
    for (let seed = 1; seed < 200; seed++)
      expect(isValidFleet(randomFleet(seeded(seed)))).toBe(true);
    // Even a broken random source ends with a legal fleet.
    expect(isValidFleet(randomFleet(() => 0))).toBe(true);
  });

  it("names cells A1..J10", () => {
    expect(cellName(0)).toBe("A1");
    expect(cellName(cellIndex(9, 9))).toBe("J10");
    expect(cellName(cellIndex(1, 4))).toBe("B5");
  });
});

describe("options", () => {
  it("defaults to 45 seconds and only allows the listed values", () => {
    expect(engine.optionsSchema.parse({})).toEqual({ turnSeconds: 45 });
    expect(engine.optionsSchema.parse(undefined)).toEqual({ turnSeconds: 45 });
    expect(engine.optionsSchema.parse({ turnSeconds: 0 })).toEqual({ turnSeconds: 0 });
    expect(engine.optionsSchema.safeParse({ turnSeconds: 20 }).success).toBe(false);
  });
});

describe("placement", () => {
  it("starts in placement with a 120 s deadline and nobody ready", () => {
    now = 5_000;
    const state = engine.setup(2, { turnSeconds: 45 }, ctx());
    expect(state.phase).toBe("placement");
    expect(state.deadline).toBe(5_000 + BATTLESHIP_PLACEMENT_MS);
    expect(engine.active(state)).toEqual([0, 1]);
  });

  it("rejects an invalid fleet and shots before the battle", () => {
    const state = engine.setup(2, { turnSeconds: 45 }, ctx());
    expect(play(state, 0, { type: "place", ships: FLEET_A.slice(1) })).toEqual({
      ok: false,
      error: "bad_fleet",
    });
    expect(play(state, 0, { type: "shoot", x: 0, y: 0 })).toEqual({
      ok: false,
      error: "wrong_phase",
    });
  });

  it("lets a ready player unready and place again; battle starts when both are ready", () => {
    now = 1_000;
    let state = engine.setup(2, { turnSeconds: 30 }, ctx());
    state = must(state, 0, { type: "place", ships: FLEET_A });
    expect(state.seas[0].ready).toBe(true);
    expect(engine.active(state)).toEqual([1]);
    state = must(state, 0, { type: "unready" });
    expect(state.seas[0].ready).toBe(false);
    state = must(state, 0, { type: "place", ships: randomFleet(seeded(3)) });
    now = 2_000;
    state = must(state, 1, { type: "place", ships: FLEET_A });
    expect(state.phase).toBe("battle");
    expect(state.turn).toBe(0);
    expect(state.deadline).toBe(2_000 + 30_000);
    expect(play(state, 0, { type: "unready" })).toEqual({ ok: false, error: "wrong_phase" });
  });

  it("gives late players a random fleet when placement time runs out", () => {
    now = 1_000;
    let state = engine.setup(2, { turnSeconds: 45 }, ctx());
    state = must(state, 1, { type: "place", ships: FLEET_A });
    now = 1_000 + BATTLESHIP_PLACEMENT_MS - 1;
    expect(engine.tick!(state, ctx())).toBeNull();
    now = 1_000 + BATTLESHIP_PLACEMENT_MS;
    const before = clone(state);
    const next = engine.tick!(state, ctx(7))!;
    expect(state).toEqual(before); // tick does not mutate
    expect(next.phase).toBe("battle");
    expect(isValidFleet(next.seas[0].ships!)).toBe(true);
    expect(next.seas[1].ships).toEqual(FLEET_A);
  });

  it("keeps the last sent fleet of a player who unreadied", () => {
    now = 1_000;
    let state = engine.setup(2, { turnSeconds: 45 }, ctx());
    state = must(state, 0, { type: "place", ships: FLEET_A });
    state = must(state, 0, { type: "unready" });
    now += BATTLESHIP_PLACEMENT_MS;
    const next = engine.tick!(state, ctx())!;
    expect(next.seas[0].ships).toEqual(FLEET_A);
  });

  it("never shows the opponent's ships during placement or battle", () => {
    let state = engine.setup(2, { turnSeconds: 45 }, ctx());
    state = must(state, 0, { type: "place", ships: FLEET_A });
    const view1 = engine.view(state, 1, now);
    expect(view1.grids[0].ships).toEqual([]);
    expect(view1.grids[0].ready).toBe(true);
    const view0 = engine.view(state, 0, now);
    expect(view0.grids[0].ships).toHaveLength(10);
    state = must(state, 1, { type: "place", ships: FLEET_A });
    expect(engine.view(state, null, now).grids.every((g) => g.ships.length === 0)).toBe(true);
    expect(engine.view(state, 0, now).grids[1].ships).toEqual([]);
    expect(JSON.stringify(engine.view(state, 1, now).grids[0])).not.toContain('"length"');
  });
});

describe("battle", () => {
  it("passes the turn on a miss and keeps it on a hit", () => {
    let state = battle();
    expect(engine.active(state)).toEqual([0]);
    expect(play(state, 1, { type: "shoot", x: 0, y: 0 })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
    state = must(state, 0, { type: "shoot", x: 0, y: 0 }); // hit the 4-deck
    expect(state.turn).toBe(0);
    expect(state.seas[1].shots[0]).toBe(SHOT_HIT);
    const miss = water[water.length - 1]!;
    state = must(state, 0, { type: "shoot", ...at(miss) });
    expect(state.seas[1].shots[miss]).toBe(SHOT_MISS);
    expect(state.turn).toBe(1);
    expect(state.seas[1].lastShot).toBe(miss);
  });

  it("rejects a cell that was already shot", () => {
    let state = battle();
    state = must(state, 0, { type: "shoot", x: 0, y: 0 });
    expect(play(state, 0, { type: "shoot", x: 0, y: 0 })).toEqual({
      ok: false,
      error: "already_shot",
    });
  });

  it("rejects cells outside the board", () => {
    const state = battle();
    expect(play(state, 0, { type: "shoot", x: 10, y: 0 }).ok).toBe(false);
    expect(play(state, 0, { type: "shoot", x: -1, y: 0 }).ok).toBe(false);
  });

  it("marks the water around a sunk ship and reveals it", () => {
    let state = battle();
    // Sink the vertical 3-deck at (0,2)..(0,4).
    for (const y of [2, 3, 4]) state = must(state, 0, { type: "shoot", x: 0, y });
    for (const cell of [cellIndex(1, 1), cellIndex(1, 3), cellIndex(0, 5), cellIndex(1, 5)])
      expect(state.seas[1].shots[cell]).toBe(SHOT_AROUND);
    // (0,1) and (1,1) are next to both ships: still marked around the sunk one.
    expect(state.seas[1].shots[cellIndex(0, 1)]).toBe(SHOT_AROUND);
    expect(play(state, 0, { type: "shoot", x: 1, y: 3 })).toEqual({
      ok: false,
      error: "already_shot",
    });
    const view = engine.view(state, 0, now);
    expect(view.grids[1].ships).toEqual([{ x: 0, y: 2, length: 3, vertical: true, sunk: true }]);
    expect(view.grids[1].remaining).toEqual({ 4: 1, 3: 1, 2: 3, 1: 4 });
    expect(state.turn).toBe(0);
  });

  it("ends when the whole fleet is sunk and reveals every ship", () => {
    let state = battle();
    for (const ship of FLEET_A)
      for (const cell of shipCells(ship)) state = must(state, 0, { type: "shoot", ...at(cell) });
    expect(state.phase).toBe("over");
    expect(engine.result(state)).toEqual({ winners: [0], draw: false, reason: "fleet-sunk" });
    expect(engine.active(state)).toEqual([]);
    expect(play(state, 0, { type: "shoot", x: 9, y: 0 })).toEqual({
      ok: false,
      error: "game_over",
    });
    expect(engine.view(state, 1, now).grids[0].ships).toHaveLength(10);
  });

  it("reveals the loser's remaining ships at the end", () => {
    let state = battle();
    state = must(state, 0, { type: "shoot", x: 0, y: 0 });
    state = engine.leave(clone(state), 1, ctx());
    expect(engine.result(state)).toEqual({ winners: [0], draw: false, reason: "resign" });
    const view = engine.view(state, 0, now);
    expect(view.grids[1].ships).toHaveLength(10);
    expect(view.grids[1].ships.filter((s) => s.sunk)).toHaveLength(0);
  });

  it("fires a random shot for a player who ran out of time", () => {
    let state = battle(30);
    const deadline = state.deadline!;
    now = deadline - 1;
    expect(engine.tick!(state, ctx())).toBeNull();
    now = deadline;
    const before = clone(state);
    const next = engine.tick!(state, ctx(9))!;
    expect(state).toEqual(before);
    const shot = next.seas[1].lastShot!;
    expect(shot).not.toBeNull();
    expect(next.seas[1].shots[shot]).not.toBe(0);
    expect(next.deadline).toBe(now + 30_000);
    state = next;
  });

  it("never times out without a turn limit", () => {
    const state = battle(0);
    expect(state.deadline).toBeNull();
    now += 10 * 60_000;
    expect(engine.tick!(state, ctx())).toBeNull();
  });

  it("a timed-out player's random shots only hit free cells", () => {
    let state = battle(30);
    for (let i = 0; i < 300 && state.phase === "battle"; i++) {
      now = state.deadline!;
      const shooter = state.turn;
      const target = 1 - shooter;
      const free = state.seas[target]!.shots.filter((c) => c === 0).length;
      state = engine.tick!(state, ctx(i + 11))!;
      const after = state.seas[target]!.shots.filter((c) => c === 0).length;
      expect(after).toBeLessThan(free);
    }
    expect(state.phase).toBe("over");
    expect(engine.result(state)?.reason).toBe("fleet-sunk");
  });

  it("leaving in placement hands the win to the other seat", () => {
    const state = engine.setup(2, { turnSeconds: 45 }, ctx());
    const left = engine.leave(clone(state), 0, ctx());
    expect(engine.result(left)).toEqual({ winners: [1], draw: false, reason: "resign" });
    expect(engine.tick!(left, ctx())).toBeNull();
  });

  it("validates move shapes", () => {
    expect(engine.moveSchema.safeParse({ type: "shoot", x: 1.5, y: 0 }).success).toBe(false);
    expect(engine.moveSchema.safeParse({ type: "fly" }).success).toBe(false);
    expect(
      engine.moveSchema.safeParse({
        type: "place",
        ships: Array.from({ length: 11 }, () => ({ x: 0, y: 0, length: 1, vertical: false })),
      }).success,
    ).toBe(false);
  });
});
