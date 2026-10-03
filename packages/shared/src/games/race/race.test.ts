import { describe, expect, it } from "vitest";
import {
  RACE_COUNTDOWN_MS,
  raceEngine,
  raceMinSolveMs,
  readRaceOptions,
  type RaceMove,
  type RaceState,
} from "./index";

const image = {
  id: "picsum-10",
  url: "http://localhost/uploads/picsum-10.webp",
  thumbUrl: "http://localhost/uploads/picsum-10-thumb.jpg",
  width: 1600,
  height: 1200,
  credit: "Someone / Unsplash",
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const ctx = (now: number) => ({ now, random: () => 0.5 });

function start(players = 3, pieces = 48): RaceState {
  return raceEngine.setup(players, { image, pieces } as never, ctx(1_000));
}

function play(state: RaceState, seat: number, move: RaceMove, now: number) {
  return raceEngine.move(clone(state), seat, move, ctx(now));
}

const afterStart = (state: RaceState, ms = 0) => state.startsAt + ms;

describe("raceEngine options", () => {
  it("validates the client input and defaults to 48 pieces", () => {
    expect(raceEngine.optionsSchema.parse({ imageId: "picsum-10" })).toEqual({
      imageId: "picsum-10",
      pieces: 48,
    });
    expect(raceEngine.optionsSchema.safeParse({ imageId: "x", pieces: 50 }).success).toBe(false);
    expect(raceEngine.optionsSchema.safeParse({ imageId: "../etc", pieces: 48 }).success).toBe(
      false,
    );
    expect(raceEngine.optionsSchema.safeParse({ pieces: 48 }).success).toBe(false);
    expect(
      raceEngine.optionsSchema.safeParse({ imageId: "a", pieces: 24, rotation: false }).success,
    ).toBe(true);
    expect(
      raceEngine.optionsSchema.safeParse({ imageId: "a", pieces: 24, rotation: true }).success,
    ).toBe(false);
  });

  it("reads the prepared shape and tolerates a missing image", () => {
    expect(readRaceOptions({ image, pieces: 100 })).toEqual({ image, pieces: 100 });
    expect(readRaceOptions({ imageId: "x", pieces: 24 })).toEqual({ image: null, pieces: 24 });
    expect(readRaceOptions(undefined)).toEqual({ image: null, pieces: 48 });
  });
});

describe("raceEngine.setup", () => {
  it("cuts the grid for the image and starts after a countdown", () => {
    const state = start(3, 48);
    expect(state.image).toEqual(image);
    expect(state.total).toBe(state.cols * state.rows);
    expect(state.total).toBeGreaterThanOrEqual(40);
    expect(state.total).toBeLessThanOrEqual(56);
    expect(state.startsAt).toBe(1_000 + RACE_COUNTDOWN_MS);
    expect(state.racers).toHaveLength(3);
    expect(Number.isInteger(state.seed)).toBe(true);
    expect(raceEngine.active(state)).toEqual([0, 1, 2]);
    expect(raceEngine.result(state)).toBeNull();
  });

  it("uses the same seed for everyone (one state) and a different one per game", () => {
    const a = raceEngine.setup(2, { image, pieces: 24 } as never, { now: 0, random: () => 0.1 });
    const b = raceEngine.setup(2, { image, pieces: 24 } as never, { now: 0, random: () => 0.9 });
    expect(a.seed).not.toBe(b.seed);
  });
});

describe("raceEngine.move", () => {
  it("rejects moves during the countdown", () => {
    const state = start();
    const result = play(state, 0, { type: "progress", placed: 2 }, state.startsAt - 1);
    expect(result).toEqual({ ok: false, error: "not_started" });
  });

  it("records progress, never lowers it and refuses impossible counts", () => {
    let state = start();
    let result = play(state, 1, { type: "progress", placed: 10 }, afterStart(state, 5_000));
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.racers[1]!.placed).toBe(10);
    result = play(state, 1, { type: "progress", placed: 4 }, afterStart(state, 6_000));
    if (!result.ok) throw new Error(result.error);
    expect(result.state.racers[1]!.placed).toBe(10);
    expect(
      play(state, 1, { type: "progress", placed: state.total + 1 }, afterStart(state, 7_000)),
    ).toEqual({ ok: false, error: "invalid" });
  });

  it("refuses a finish faster than the sanity floor", () => {
    const state = start();
    const floor = raceMinSolveMs(state.total);
    expect(play(state, 0, { type: "finish" }, afterStart(state, floor - 1))).toEqual({
      ok: false,
      error: "too_fast",
    });
  });

  it("lets the first finisher win and ends the race", () => {
    let state = start();
    const at = afterStart(state, raceMinSolveMs(state.total) + 10_000);
    const result = play(state, 2, { type: "finish" }, at);
    if (!result.ok) throw new Error(result.error);
    state = result.state;
    expect(state.racers[2]).toEqual({ placed: state.total, finishedAt: at, left: false });
    expect(raceEngine.result(state)).toEqual({ winners: [2], draw: false, reason: "finished" });
    expect(raceEngine.active(state)).toEqual([]);
    expect(play(state, 0, { type: "finish" }, at + 1)).toEqual({ ok: false, error: "game_over" });
    expect(play(state, 0, { type: "progress", placed: 3 }, at + 1)).toEqual({
      ok: false,
      error: "game_over",
    });
  });

  it("refuses moves from a seat that left", () => {
    const state = raceEngine.leave(clone(start(3)), 1, ctx(5_000));
    expect(play(state, 1, { type: "progress", placed: 1 }, afterStart(state, 1_000))).toEqual({
      ok: false,
      error: "not_a_player",
    });
  });
});

describe("raceEngine.leave", () => {
  it("makes the last racer the winner", () => {
    let state = start(3);
    state = raceEngine.leave(clone(state), 0, ctx(5_000));
    expect(raceEngine.result(state)).toBeNull();
    expect(raceEngine.active(state)).toEqual([1, 2]);
    state = raceEngine.leave(clone(state), 2, ctx(6_000));
    expect(raceEngine.result(state)).toEqual({
      winners: [1],
      draw: false,
      reason: "last-player",
    });
  });

  it("does nothing after the race is over or for a seat that already left", () => {
    let state = start(2);
    state = raceEngine.leave(clone(state), 0, ctx(5_000));
    const again = raceEngine.leave(clone(state), 1, ctx(6_000));
    expect(raceEngine.result(again)).toEqual(raceEngine.result(state));
    expect(again.racers[1]!.left).toBe(false);
  });

  it("view shows everything to everyone", () => {
    const state = start(2);
    expect(raceEngine.view(state, null, 0)).toEqual(state);
    expect(raceEngine.view(state, 1, 0)).toEqual(state);
  });
});
