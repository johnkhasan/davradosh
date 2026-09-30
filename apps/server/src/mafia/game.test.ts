import {
  MAFIA_ROLE_DECK,
  MAFIA_TIMINGS,
  teamOf,
  type MafiaEvent,
  type MafiaPhaseKind,
} from "@puzzle/shared/mafia";
import { describe, expect, it } from "vitest";
import { MafiaGame } from "./game";

const players = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
}));

/**
 * `random(max) = max - 1` makes Fisher–Yates a no-op, so seat N is player pN and the deck is
 * dealt in order: seats 1–6 civilians, 7 Sheriff, 8–9 mafia, 10 Don.
 */
function fixedGame() {
  return new MafiaGame(players, 0, { random: (max) => max - 1 });
}

const SHERIFF = 7;
const MAFIA = [8, 9];
const DON = 10;
const BLACK = [...MAFIA, DON];

function id(game: MafiaGame, seat: number) {
  return game.playerAt(seat)!;
}

/** Advances phase by phase (never skipping one silently) until `kind` is reached. */
function until(game: MafiaGame, kind: MafiaPhaseKind, limit = 200) {
  for (let i = 0; game.phase !== kind; i++) {
    if (i > limit || game.phase === "gameOver")
      throw new Error(`never reached ${kind} (at ${game.phase})`);
    game.advance(game.endsAt);
  }
}

function skip(game: MafiaGame) {
  game.advance(game.endsAt);
}

/** Plays the day's speeches: `nominations` maps speaker seat → nominee. */
function speeches(game: MafiaGame, nominations: Record<number, number> = {}) {
  until(game, "speech");
  while (game.phase === "speech") {
    const speaker = game.speaker!;
    const nominee = nominations[speaker];
    if (nominee !== undefined)
      expect(game.nominate(id(game, speaker), nominee)).toEqual({ ok: true });
    expect(game.pass(id(game, speaker), game.endsAt - 1)).toEqual({ ok: true });
  }
}

/** Everyone alive votes as mapped (voter seat → candidate); unmapped players do not vote. */
function vote(game: MafiaGame, ballots: Record<number, number>) {
  expect(game.phase).toBe("voting");
  for (const [voter, target] of Object.entries(ballots)) {
    expect(game.vote(id(game, Number(voter)), target)).toEqual({ ok: true });
  }
  skip(game);
}

/** Night with the black team shooting `target` (null: nobody shoots, a miss). */
function night(game: MafiaGame, target: number | null) {
  until(game, "shoot");
  if (target !== null) {
    for (const seat of BLACK.filter((s) => game.isAlive(s))) {
      expect(game.shoot(id(game, seat), target)).toEqual({ ok: true });
    }
  }
  until(game, "dawn");
}

function events<T extends MafiaEvent["type"]>(game: MafiaGame, type: T) {
  return game.log.filter((e): e is Extract<MafiaEvent, { type: T }> => e.type === type);
}

/** Votes `seat` out today: two nominations (so day one votes too), everyone against `seat`. */
function voteOutToday(game: MafiaGame, seat: number) {
  until(game, "speech");
  const alive = game.aliveSeats();
  const other = alive.find((s) => s !== seat)!;
  const [a, b] = alive;
  speeches(game, { [a!]: seat, [b!]: other });
  vote(game, Object.fromEntries(alive.map((voter) => [voter, seat])));
  expect(events(game, "votedOut").at(-1)).toEqual({ type: "votedOut", seats: [seat] });
  skip(game); // last words
}

describe("MafiaGame: setup (1.1)", () => {
  it("deals exactly 6 civilians, the Sheriff, 2 mafia and the Don to 10 unique seats", () => {
    for (let i = 0; i < 50; i++) {
      const game = new MafiaGame(players, 0);
      const roles = Array.from({ length: 10 }, (_, s) => game.roleAt(s + 1)).sort();
      expect(roles).toEqual([...MAFIA_ROLE_DECK].sort());
      const seats = players.map((p) => game.seatOf(p.id));
      expect(new Set(seats).size).toBe(10);
      expect(seats.every((s) => s !== null && s >= 1 && s <= 10)).toBe(true);
    }
  });

  it("needs exactly ten distinct players", () => {
    expect(() => new MafiaGame(players.slice(0, 9), 0)).toThrow();
    expect(() => new MafiaGame([...players.slice(0, 9), players[0]!], 0)).toThrow();
  });

  it("starts with the role reveal and the zero night, without a kill", () => {
    const game = fixedGame();
    expect(game.phase).toBe("roleReveal");
    skip(game);
    expect(game.phase).toBe("zeroNight");
    expect(game.endsAt).toBe(MAFIA_TIMINGS.roleReveal + MAFIA_TIMINGS.zeroNight);
    expect(game.shoot(id(game, DON), 1)).toEqual({ ok: false, error: "wrong_phase" });
    skip(game);
    expect(game.phase).toBe("speech");
    expect(game.aliveSeats()).toHaveLength(10);
  });
});

describe("MafiaGame: zero night (4.2)", () => {
  it("shows the black team to each other and nobody else", () => {
    const game = fixedGame();
    until(game, "zeroNight");
    for (const seat of BLACK) {
      const view = game.viewFor(id(game, seat));
      expect(view.phase).toBe("zeroNight");
      const known = view.seats.filter((s) => s.role !== null).map((s) => s.seat);
      expect(known).toEqual(BLACK);
    }
    for (const seat of [1, SHERIFF]) {
      const view = game.viewFor(id(game, seat));
      expect(view.phase).toBe("night");
      expect(view.seats.filter((s) => s.role !== null).map((s) => s.seat)).toEqual([seat]);
    }
  });
});

describe("MafiaGame: day speeches (4.3)", () => {
  it("gives each player one minute in seat order, day one from seat 1", () => {
    const game = fixedGame();
    until(game, "speech");
    const order: number[] = [];
    while (game.phase === "speech") {
      order.push(game.speaker!);
      const started = game.endsAt - MAFIA_TIMINGS.speech;
      expect(game.endsAt - started).toBe(MAFIA_TIMINGS.speech);
      skip(game);
    }
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("starts each later day with the player after the previous first speaker, skipping the dead", () => {
    const game = fixedGame();
    speeches(game); // day 1: nobody nominated
    night(game, 2); // seat 2 is killed
    until(game, "speech");
    expect(game.dayNumber).toBe(2);
    expect(game.speaker).toBe(3); // seat 2 would start, but is dead
    const order = [game.speaker];
    while (game.phase === "speech") {
      skip(game);
      if (game.phase === "speech") order.push(game.speaker);
    }
    expect(order).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 1]);
  });

  it("only the speaker can pass, and a pass ends the minute at once", () => {
    const game = fixedGame();
    until(game, "speech");
    expect(game.pass(id(game, 2), 5)).toEqual({ ok: false, error: "not_your_turn" });
    const now = game.endsAt - 30_000;
    expect(game.pass(id(game, 1), now)).toEqual({ ok: true });
    expect(game.speaker).toBe(2);
    expect(game.endsAt).toBe(now + MAFIA_TIMINGS.speech);
  });

  it("waits only briefly for a disconnected speaker", () => {
    const game = fixedGame();
    game.setConnected(id(game, 1), false);
    until(game, "speech");
    const start = MAFIA_TIMINGS.roleReveal + MAFIA_TIMINGS.zeroNight;
    expect(game.endsAt).toBe(start + MAFIA_TIMINGS.absentSpeaker);
  });
});

describe("MafiaGame: nominations (4.4.2–4.4.3)", () => {
  it("allows one nomination per day, only during one's own minute, each candidate once", () => {
    const game = fixedGame();
    until(game, "speech");
    expect(game.nominate(id(game, 2), 5)).toEqual({ ok: false, error: "not_your_turn" });
    expect(game.nominate(id(game, 1), 5)).toEqual({ ok: true });
    expect(game.nominate(id(game, 1), 6)).toEqual({ ok: false, error: "already_done" });
    game.pass(id(game, 1), 1);
    expect(game.nominate(id(game, 2), 5)).toEqual({ ok: false, error: "invalid_target" });
    expect(game.nominate(id(game, 2), 6)).toEqual({ ok: true });
    expect(game.viewFor(null).nominations).toEqual([
      { seat: 5, by: 1 },
      { seat: 6, by: 2 },
    ]);
  });

  it("does not accept dead candidates", () => {
    const game = fixedGame();
    speeches(game);
    night(game, 4);
    until(game, "speech");
    expect(game.nominate(id(game, game.speaker!), 4)).toEqual({
      ok: false,
      error: "invalid_target",
    });
  });
});

describe("MafiaGame: voting (4.4)", () => {
  it("skips the vote on day one when only one candidate was nominated (4.4.10)", () => {
    const game = fixedGame();
    speeches(game, { 1: 5 });
    expect(game.phase).toBe("shoot");
    expect(events(game, "noVote")).toEqual([{ type: "noVote", reason: "firstDaySingle" }]);
  });

  it("votes on a single candidate from day two on, and he takes the silent votes (4.4.8)", () => {
    const game = fixedGame();
    speeches(game);
    night(game, null);
    speeches(game, { 3: 5 });
    expect(game.phase).toBe("voting");
    skip(game); // nobody votes
    expect(events(game, "votedOut")).toEqual([{ type: "votedOut", seats: [5] }]);
  });

  it("gives silent votes to the last candidate and voted-out players their last word, role hidden", () => {
    const game = fixedGame();
    speeches(game, { 1: 5, 2: 6 });
    expect(game.viewFor(null).ballot).toEqual([5, 6]);
    expect(game.endsAt - (game.endsAt - 2 * MAFIA_TIMINGS.votePerCandidate)).toBe(
      2 * MAFIA_TIMINGS.votePerCandidate,
    );
    vote(game, { 1: 5, 2: 5, 3: 5, 4: 5 }); // 4 for seat 5; the other 6 are silent -> seat 6
    expect(events(game, "votes")[0]!.tally).toEqual([
      { seat: 5, voters: [1, 2, 3, 4] },
      { seat: 6, voters: [5, 6, 7, 8, 9, 10] },
    ]);
    expect(game.isAlive(6)).toBe(false);
    expect(game.phase).toBe("lastWords");
    expect(game.speaker).toBe(6);
    expect(game.endsAt).toBeGreaterThan(0);
    // The public never learns the role of a player who left (4.4.13).
    expect(game.viewFor(null).seats.find((s) => s.seat === 6)!.role).toBeNull();
    expect(game.viewFor(id(game, 1)).seats.find((s) => s.seat === 6)!.role).toBeNull();
    // The leaving player can end his last words early.
    expect(game.pass(id(game, 6), game.endsAt - 1)).toEqual({ ok: true });
    expect(game.phase).toBe("shoot");
  });

  it("lets each player vote once, for a candidate only", () => {
    const game = fixedGame();
    speeches(game, { 1: 5, 2: 6 });
    expect(game.vote(id(game, 1), 3)).toEqual({ ok: false, error: "invalid_target" });
    expect(game.vote(id(game, 1), 5)).toEqual({ ok: true });
    expect(game.vote(id(game, 1), 6)).toEqual({ ok: false, error: "already_done" });
    expect(game.viewFor(id(game, 1)).myVote).toBe(5);
    expect(game.viewFor(id(game, 2)).myVote).toBeNull();
  });

  it("on a tie gives the tied players 30 s each in nomination order, then revotes (4.4.12)", () => {
    const game = fixedGame();
    speeches(game, { 1: 6, 2: 5 });
    vote(game, { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 5, 7: 5, 8: 5, 9: 5, 10: 5 });
    expect(events(game, "tie")).toEqual([{ type: "tie", seats: [6, 5] }]);
    expect(game.phase).toBe("tieSpeech");
    expect(game.speaker).toBe(6);
    skip(game);
    expect(game.speaker).toBe(5);
    skip(game);
    expect(game.phase).toBe("voting");
    expect(game.viewFor(null).ballot).toEqual([6, 5]);
  });

  it("repeats the speeches when a revote ties fewer candidates (4.4.12.2)", () => {
    const game = fixedGame();
    speeches(game, { 1: 4, 2: 5, 3: 6 });
    // 3-3-3 with seat 10 silent -> +1 for seat 6: 3,3,4? Make it an exact three-way tie instead.
    vote(game, { 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 7: 6, 8: 6, 9: 6 }); // seat 10 -> 6 (last)
    // 3,3,4: seat 6 leads alone.
    expect(events(game, "votedOut")).toEqual([{ type: "votedOut", seats: [6] }]);

    const tied = fixedGame();
    speeches(tied, { 1: 4, 2: 5, 3: 6, 4: 7 });
    // 4:3, 5:3, 6:2, 7:2 -> tie between 4 and 5
    vote(tied, { 1: 4, 2: 4, 3: 4, 4: 5, 5: 5, 6: 5, 8: 6, 9: 6, 10: 7 }); // seat 7 silent -> 7
    expect(events(tied, "tie")).toEqual([{ type: "tie", seats: [4, 5] }]);
    until(tied, "voting");
    expect(tied.viewFor(null).ballot).toEqual([4, 5]);
  });

  it("asks whether all tied candidates leave after the same tie twice (4.4.12.3)", () => {
    const passing = fixedGame();
    const split = { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6 };
    speeches(passing, { 1: 5, 2: 6 });
    vote(passing, split);
    until(passing, "voting");
    vote(passing, split);
    expect(passing.phase).toBe("liftAllVote");
    for (const seat of [1, 2, 3, 4, 7, 8]) passing.liftAll(id(passing, seat), true);
    passing.liftAll(id(passing, 9), false);
    expect(passing.liftAll(id(passing, 9), true)).toEqual({ ok: false, error: "already_done" });
    skip(passing);
    expect(events(passing, "liftAll")).toEqual([
      { type: "liftAll", seats: [5, 6], yes: [1, 2, 3, 4, 7, 8], passed: true },
    ]);
    expect(passing.isAlive(5) || passing.isAlive(6)).toBe(false);
    expect(passing.phase).toBe("lastWords");
    skip(passing);
    expect(passing.speaker).toBe(6);

    // An even split (5 of 10) keeps everyone at the table.
    const failing = fixedGame();
    speeches(failing, { 1: 5, 2: 6 });
    vote(failing, split);
    until(failing, "voting");
    vote(failing, split);
    for (const seat of [1, 2, 3, 4, 7]) failing.liftAll(id(failing, seat), true);
    skip(failing);
    expect(events(failing, "liftAll")[0]!.passed).toBe(false);
    expect(failing.aliveSeats()).toHaveLength(10);
    expect(failing.phase).toBe("shoot");
  });

  it("holds no 'all leave' vote when every player at the table is tied (7.8)", () => {
    const game = fixedGame();
    // Leave 1, 2, 3 and 8 at the table (3 red vs 1 black), through kills and votes.
    speeches(game);
    night(game, 4);
    voteOutToday(game, 9);
    night(game, 5);
    voteOutToday(game, DON);
    night(game, 6);
    voteOutToday(game, SHERIFF);
    night(game, null);
    until(game, "speech");
    expect(game.aliveSeats()).toEqual([1, 2, 3, 8]);

    // Each speaker nominates the next one, so all four become candidates.
    const alive = game.aliveSeats();
    const first = alive.indexOf(game.speaker!);
    const order = alive.map((_, i) => alive[(first + i) % alive.length]!);
    speeches(game, Object.fromEntries(order.map((s, i) => [s, order[(i + 1) % order.length]!])));
    const ballot = game.viewFor(null).ballot;
    expect([...ballot].sort()).toEqual([1, 2, 3, 8]);

    // One vote each: a four-way tie, twice.
    const even = Object.fromEntries(ballot.map((c, i) => [ballot[(i + 1) % ballot.length]!, c]));
    vote(game, even);
    until(game, "voting");
    vote(game, even);
    expect(game.phase).toBe("shoot");
    expect(game.aliveSeats()).toEqual([1, 2, 3, 8]);
    expect(events(game, "liftAll")).toEqual([]);
  });
});

describe("MafiaGame: night (4.5)", () => {
  it("kills when every living black player shoots the same seat (4.5.4)", () => {
    const game = fixedGame();
    speeches(game);
    night(game, 3);
    expect(events(game, "killed")).toEqual([{ type: "killed", seat: 3 }]);
    skip(game);
    expect(game.phase).toBe("lastWords");
    expect(game.speaker).toBe(3);
  });

  it("misses when the shots disagree or someone does not shoot (4.5.5)", () => {
    const disagree = fixedGame();
    speeches(disagree);
    until(disagree, "shoot");
    disagree.shoot(id(disagree, 8), 3);
    disagree.shoot(id(disagree, 9), 3);
    disagree.shoot(id(disagree, 10), 4);
    until(disagree, "dawn");
    expect(events(disagree, "miss")).toHaveLength(1);
    expect(disagree.aliveSeats()).toHaveLength(10);

    const blank = fixedGame();
    speeches(blank);
    until(blank, "shoot");
    blank.shoot(id(blank, 8), 3);
    blank.shoot(id(blank, 9), 3);
    until(blank, "dawn");
    expect(events(blank, "miss")).toHaveLength(1);
  });

  it("only lets living black players shoot, once", () => {
    const game = fixedGame();
    speeches(game);
    until(game, "shoot");
    expect(game.shoot(id(game, 1), 3)).toEqual({ ok: false, error: "not_allowed" });
    expect(game.shoot(id(game, 8), 3)).toEqual({ ok: true });
    expect(game.shoot(id(game, 8), 4)).toEqual({ ok: false, error: "already_done" });
  });

  it("counts only the living black players after one of them is out", () => {
    const game = fixedGame();
    voteOutToday(game, 9);
    until(game, "shoot");
    game.shoot(id(game, 8), 2);
    game.shoot(id(game, 10), 2);
    expect(game.shoot(id(game, 9), 2)).toEqual({ ok: false, error: "dead" });
    until(game, "dawn");
    expect(events(game, "killed")).toEqual([{ type: "killed", seat: 2 }]);
  });

  it("gives the Don and the Sheriff one private check a night (4.5.6–4.5.8)", () => {
    const game = fixedGame();
    speeches(game);
    until(game, "donCheck");
    expect(game.check(id(game, SHERIFF), 8)).toEqual({ ok: false, error: "not_allowed" });
    expect(game.check(id(game, DON), SHERIFF)).toEqual({ ok: true });
    expect(game.check(id(game, DON), 1)).toEqual({ ok: false, error: "already_done" });
    until(game, "sheriffCheck");
    expect(game.check(id(game, SHERIFF), SHERIFF)).toEqual({ ok: false, error: "invalid_target" });
    expect(game.check(id(game, SHERIFF), 9)).toEqual({ ok: true });

    expect(game.viewFor(id(game, DON)).checks).toEqual([
      { night: 2, seat: SHERIFF, result: "sheriff" },
    ]);
    expect(game.viewFor(id(game, SHERIFF)).checks).toEqual([
      { night: 2, seat: 9, result: "black" },
    ]);
    expect(game.viewFor(id(game, 8)).checks).toEqual([]);
    expect(game.viewFor(id(game, 1)).checks).toEqual([]);
    expect(game.viewFor(null).checks).toEqual([]);
  });

  it("runs every night step at full length even when its role is out, and hides them all", () => {
    const game = fixedGame();
    voteOutToday(game, DON);
    until(game, "shoot");
    const start = game.endsAt - MAFIA_TIMINGS.shoot;
    until(game, "donCheck");
    expect(game.endsAt).toBe(start + MAFIA_TIMINGS.shoot + MAFIA_TIMINGS.donCheck);
    for (const seat of [1, SHERIFF, 8, DON])
      expect(game.viewFor(id(game, seat)).phase).toBe("night");
    until(game, "sheriffCheck");
    expect(game.viewFor(id(game, SHERIFF)).phase).toBe("sheriffCheck");
    expect(game.viewFor(id(game, 1)).phase).toBe("night");
  });
});

describe("MafiaGame: best move (4.5.9, 7.10)", () => {
  it("lets the player shot on the first shooting night name three seats, announced at dawn", () => {
    const g = fixedGame();
    speeches(g);
    until(g, "shoot");
    for (const seat of BLACK) g.shoot(id(g, seat), 2);
    until(g, "bestMove");
    expect(g.viewFor(id(g, 2)).phase).toBe("bestMove");
    expect(g.viewFor(id(g, 2)).actions).toEqual(["bestMove"]);
    expect(g.viewFor(id(g, 1)).phase).toBe("night");
    expect(g.bestMove(id(g, 1), [8, 9, 10])).toEqual({ ok: false, error: "not_allowed" });
    expect(g.bestMove(id(g, 2), [8, 9, 2])).toEqual({ ok: false, error: "invalid_target" });
    expect(g.bestMove(id(g, 2), [8, 8, 9])).toEqual({ ok: false, error: "invalid_target" });
    expect(g.bestMove(id(g, 2), [8, 9, 10])).toEqual({ ok: true });
    skip(g);
    expect(g.phase).toBe("dawn");
    expect(events(g, "bestMove")).toEqual([{ type: "bestMove", seat: 2, seats: [8, 9, 10] }]);
    expect(g.viewFor(null).bestMove).toEqual({ seat: 2, seats: [8, 9, 10] });
  });

  it("is only for the first shooting night", () => {
    const game = fixedGame();
    speeches(game);
    night(game, null); // night 2: miss
    speeches(game);
    until(game, "shoot");
    for (const seat of BLACK) game.shoot(id(game, seat), 2);
    until(game, "sheriffCheck");
    skip(game);
    expect(game.phase).toBe("dawn");
    expect(events(game, "bestMove")).toEqual([]);
  });

  it("is not given when day one voted out two or more players (7.10)", () => {
    const game = fixedGame();
    const split = { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 6, 7: 6, 8: 6, 9: 6, 10: 6 };
    speeches(game, { 1: 5, 2: 6 });
    vote(game, split);
    until(game, "voting");
    vote(game, split);
    for (const seat of [1, 2, 3, 4, 7, 8]) game.liftAll(id(game, seat), true);
    until(game, "shoot");
    for (const seat of BLACK) game.shoot(id(game, seat), 2);
    until(game, "sheriffCheck");
    skip(game);
    expect(game.phase).toBe("dawn");
  });
});

describe("MafiaGame: winning (1.4) and draw (7.7)", () => {
  it("red wins once every black player is out, after the last word", () => {
    const game = fixedGame();
    voteOutToday(game, 8);
    night(game, null);
    voteOutToday(game, 9);
    night(game, null);
    until(game, "speech");
    const alive = game.aliveSeats();
    speeches(game, { [alive[0]!]: DON, [alive[1]!]: 1 });
    vote(game, Object.fromEntries(alive.map((v) => [v, DON])));
    expect(game.phase).toBe("lastWords");
    expect(game.speaker).toBe(DON);
    expect(game.result).toBeNull();
    skip(game);
    expect(game.phase).toBe("gameOver");
    expect(game.result).toBe("red");
    // Game over reveals every role.
    expect(game.viewFor(null).seats.every((s) => s.role !== null)).toBe(true);
  });

  it("black wins as soon as it has as many players as red", () => {
    const game = fixedGame();
    // 7 red, 3 black. Kill 1, 2, 3 at night and vote out 4: 3 red + 3 black.
    speeches(game);
    night(game, 1);
    voteOutToday(game, 4);
    night(game, 2);
    speeches(game);
    night(game, 3);
    expect(game.phase).toBe("dawn");
    skip(game);
    expect(game.phase).toBe("lastWords");
    skip(game);
    expect(game.result).toBe("black");
  });

  it("ends in a draw after three nights in a row without anyone leaving", () => {
    const game = fixedGame();
    for (let i = 0; i < 3; i++) {
      speeches(game);
      night(game, null);
    }
    skip(game);
    expect(game.phase).toBe("gameOver");
    expect(game.result).toBe("draw");
  });

  it("a vote on the day in between resets the draw count", () => {
    const game = fixedGame();
    speeches(game);
    night(game, null);
    voteOutToday(game, 5);
    night(game, null);
    speeches(game);
    night(game, null);
    skip(game);
    expect(game.phase).toBe("speech");
  });
});

describe("MafiaGame: players leaving the table", () => {
  it("hides the role, cancels that day's vote (7.1) and checks the winner", () => {
    const game = fixedGame();
    until(game, "speech");
    game.nominate(id(game, 1), 5);
    game.pass(id(game, 1), 1);
    game.nominate(id(game, 2), 6);
    expect(game.removePlayer(id(game, 4), 2)).toEqual({ ok: true });
    expect(game.viewFor(null).seats.find((s) => s.seat === 4)).toMatchObject({
      alive: false,
      exit: "left",
      role: null,
    });
    until(game, "shoot");
    expect(events(game, "noVote")).toEqual([{ type: "noVote", reason: "playerLeft" }]);

    const lastBlack = fixedGame();
    voteOutToday(lastBlack, 8);
    night(lastBlack, null);
    voteOutToday(lastBlack, 9);
    lastBlack.removePlayer(id(lastBlack, DON), lastBlack.endsAt - 1);
    expect(lastBlack.result).toBe("red");
  });
});

// ---------------------------------------------------------------------------- simulation

/** Small seeded PRNG so a failing simulation can be replayed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(seed: number, onStep?: (game: MafiaGame) => void) {
  const rand = mulberry32(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
  const game = new MafiaGame(players, 0, { random: (max) => Math.floor(rand() * max) });
  let now = 0;
  for (let step = 0; step < 5000 && game.phase !== "gameOver"; step++) {
    onStep?.(game);
    for (const player of players) {
      const view = game.viewFor(player.id);
      for (const action of view.actions) {
        if (rand() < 0.35) continue;
        const alive = game.aliveSeats();
        switch (action) {
          case "nominate":
            game.nominate(player.id, pick(alive));
            break;
          case "vote":
            game.vote(player.id, pick(view.ballot));
            break;
          case "liftAll":
            game.liftAll(player.id, rand() < 0.5);
            break;
          case "shoot":
            game.shoot(
              player.id,
              rand() < 0.7
                ? pick(alive.filter((s) => teamOf(game.roleAt(s)!) === "red"))
                : pick(alive),
            );
            break;
          case "check":
            game.check(player.id, pick(alive.filter((s) => s !== view.me)));
            break;
          case "bestMove": {
            const others = players.map((_, i) => i + 1).filter((s) => s !== view.me);
            const seats = others.sort(() => rand() - 0.5).slice(0, 3);
            game.bestMove(player.id, seats);
            break;
          }
          case "pass":
            if (rand() < 0.5) game.pass(player.id, now);
            break;
        }
      }
    }
    if (rand() < 0.01) {
      const alive = game.aliveSeats();
      if (alive.length > 0) game.removePlayer(game.playerAt(pick(alive))!, now);
    }
    // Actions can end the game (a pass into a decided last word, a player leaving).
    if ((game.phase as MafiaPhaseKind) === "gameOver") break;
    now = Math.max(now, game.endsAt);
    game.advance(now);
  }
  onStep?.(game);
  return game;
}

describe("MafiaGame: simulation", () => {
  it("always finishes 1000 random games with a consistent result", () => {
    const results = { red: 0, black: 0, draw: 0 };
    for (let seed = 1; seed <= 1000; seed++) {
      const game = simulate(seed);
      expect(game.phase, `seed ${seed}`).toBe("gameOver");
      const result = game.result!;
      results[result]++;
      const alive = game.aliveSeats().map((s) => teamOf(game.roleAt(s)!));
      const black = alive.filter((t) => t === "black").length;
      const red = alive.length - black;
      if (result === "red") expect(black, `seed ${seed}`).toBe(0);
      if (result === "black") expect(black, `seed ${seed}`).toBeGreaterThanOrEqual(red);
      if (result === "draw") expect(black > 0 && black < red, `seed ${seed}`).toBe(true);
      expect(events(game, "gameOver")).toHaveLength(1);
    }
    // Every outcome is reachable.
    expect(results.red).toBeGreaterThan(0);
    expect(results.black).toBeGreaterThan(0);
    expect(results.draw).toBeGreaterThan(0);
  }, 60_000);
});

describe("MafiaGame: secrecy", () => {
  it("never shows anyone a role, a check or a night step they are not entitled to", () => {
    for (let seed = 1; seed <= 200; seed++) {
      simulate(seed, (game) => {
        const over = game.phase === "gameOver";
        const viewers: Array<string | null> = [null, ...players.map((p) => p.id)];
        for (const viewer of viewers) {
          const view = game.viewFor(viewer);
          const mySeat = viewer ? game.seatOf(viewer) : null;
          const myRole = mySeat ? game.roleAt(mySeat)! : null;
          const seesBlack = mySeat !== null && game.isAlive(mySeat) && teamOf(myRole!) === "black";
          for (const seat of view.seats) {
            const allowed =
              over ||
              seat.seat === mySeat ||
              (seesBlack && teamOf(game.roleAt(seat.seat)!) === "black");
            if (allowed) expect(seat.role).toBe(game.roleAt(seat.seat));
            else expect(seat.role, `seed ${seed}: ${viewer} sees ${seat.seat}`).toBeNull();
          }
          if (myRole !== "sheriff" && myRole !== "don") expect(view.checks).toEqual([]);
          const hiddenNight: string[] = [
            "shoot",
            "donCheck",
            "sheriffCheck",
            "bestMove",
            "zeroNight",
          ];
          if (hiddenNight.includes(view.phase)) {
            // Only the actors of a night step learn that it is running.
            expect(mySeat).not.toBeNull();
          }
          // The public log carries no roles and no night choices.
          const serialized = JSON.stringify(view.log);
          expect(serialized).not.toMatch(/"role"|sheriff|civilian|"mafia"|"don"|shot/i);
        }
      });
    }
  }, 120_000);
});
