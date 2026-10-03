import { z } from "zod";
import type { EngineContext, GameEngine, GameResult } from "../engine";
import {
  BOARD_SIZE,
  CELLS,
  FLEET,
  SHOT_AROUND,
  SHOT_HIT,
  SHOT_MISS,
  SHOT_NONE,
  cellIndex,
  fullFleetCount,
  isSunk,
  isValidFleet,
  normaliseShip,
  randomFleet,
  remainingBySize,
  shipCells,
  shipHalo,
  type Ship,
  type ShotCode,
} from "./rules";

export * from "./rules";

/** Time to place the fleet; whoever is not ready by then gets a random one. */
export const BATTLESHIP_PLACEMENT_MS = 120_000;
export const BATTLESHIP_TURN_SECONDS = [0, 30, 45, 60] as const;
export const BATTLESHIP_DEFAULT_TURN_SECONDS = 45;

export type BattleshipPhase = "placement" | "battle" | "over";

export interface BattleshipOptions {
  /** Seconds per shot; 0 means no limit. */
  turnSeconds: (typeof BATTLESHIP_TURN_SECONDS)[number];
}

/** One seat's sea: its fleet and the shots the opponent fired at it. */
interface Sea {
  ships: Ship[] | null;
  ready: boolean;
  /** CELLS entries of ShotCode. */
  shots: ShotCode[];
  lastShot: number | null;
}

export interface BattleshipState {
  phase: BattleshipPhase;
  turnSeconds: number;
  /** seas[i] belongs to seat i. */
  seas: [Sea, Sea];
  turn: number;
  /** Placement end in the placement phase, shot deadline in battle (null: no limit). */
  deadline: number | null;
  winner: number | null;
  reason: string | null;
}

export type BattleshipMove =
  { type: "place"; ships: Ship[] } | { type: "unready" } | { type: "shoot"; x: number; y: number };

export interface BattleshipShipView extends Ship {
  sunk: boolean;
}

export interface BattleshipGridView {
  /** Whose sea this is. */
  seat: number;
  /** Ships the viewer may see: all of their own, only sunk ones of others (all at the end). */
  ships: BattleshipShipView[];
  /** CELLS entries of ShotCode: the shots fired at this sea. */
  shots: ShotCode[];
  lastShot: number | null;
  ready: boolean;
  /** Ships still afloat by size, for example { 4: 1, 3: 1, 2: 3, 1: 4 }. */
  remaining: Record<number, number>;
}

export interface BattleshipView {
  phase: BattleshipPhase;
  /** The viewer's seat, null for spectators. */
  you: number | null;
  turn: number;
  /** Server ms: end of placement, or of the current shot. */
  deadline: number | null;
  turnSeconds: number;
  placementMs: number;
  /** Indexed by seat. */
  grids: [BattleshipGridView, BattleshipGridView];
  winner: number | null;
}

const coord = z
  .number()
  .int()
  .min(0)
  .max(BOARD_SIZE - 1);

const moveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("place"),
    ships: z
      .array(
        z.object({
          x: coord,
          y: coord,
          length: z.number().int().min(1).max(4),
          vertical: z.boolean(),
        }),
      )
      .max(FLEET.length),
  }),
  z.object({ type: z.literal("unready") }),
  z.object({ type: z.literal("shoot"), x: coord, y: coord }),
]);

const optionsSchema = z
  .object({
    turnSeconds: z
      .union([z.literal(0), z.literal(30), z.literal(45), z.literal(60)])
      .default(BATTLESHIP_DEFAULT_TURN_SECONDS),
  })
  .default({ turnSeconds: BATTLESHIP_DEFAULT_TURN_SECONDS });

const emptySea = (): Sea => ({
  ships: null,
  ready: false,
  shots: Array<ShotCode>(CELLS).fill(SHOT_NONE),
  lastShot: null,
});

const other = (seat: number) => 1 - seat;

function shotDeadline(state: BattleshipState, now: number): number | null {
  return state.turnSeconds > 0 ? now + state.turnSeconds * 1000 : null;
}

function startBattle(state: BattleshipState, now: number) {
  state.phase = "battle";
  state.turn = 0;
  state.deadline = shotDeadline(state, now);
}

/** `seat` fires at the opponent's sea; the cell must be free. Mutates `state`. */
function fire(state: BattleshipState, seat: number, cell: number, now: number) {
  const sea = state.seas[other(seat)]!;
  const ships = sea.ships ?? [];
  sea.lastShot = cell;
  const ship = ships.find((s) => shipCells(s).includes(cell));
  if (!ship) {
    sea.shots[cell] = SHOT_MISS;
    state.turn = other(seat);
    state.deadline = shotDeadline(state, now);
    return;
  }
  sea.shots[cell] = SHOT_HIT;
  if (isSunk(ship, sea.shots)) {
    // Classic rule: the water around a sunk ship is marked, nothing can be there.
    for (const around of shipHalo(ship)) {
      if (sea.shots[around] === SHOT_NONE) sea.shots[around] = SHOT_AROUND;
    }
    if (ships.every((s) => isSunk(s, sea.shots))) {
      state.phase = "over";
      state.winner = seat;
      state.reason = "fleet-sunk";
      state.deadline = null;
      return;
    }
  }
  // A hit earns another shot.
  state.deadline = shotDeadline(state, now);
}

function gridView(state: BattleshipState, seat: number, viewer: number | null): BattleshipGridView {
  const sea = state.seas[seat]!;
  const ships = sea.ships ?? [];
  const reveal = viewer === seat || state.phase === "over";
  return {
    seat,
    ships: ships
      .map((ship) => ({ ...ship, sunk: isSunk(ship, sea.shots) }))
      .filter((ship) => reveal || ship.sunk),
    shots: [...sea.shots],
    lastShot: sea.lastShot,
    ready: sea.ready,
    remaining: sea.ships ? remainingBySize(sea.ships, sea.shots) : fullFleetCount(),
  };
}

export const battleshipEngine: GameEngine<
  BattleshipState,
  BattleshipMove,
  BattleshipView,
  BattleshipOptions
> = {
  kind: "battleship",
  moveSchema,
  optionsSchema,

  setup(_players, options, ctx) {
    return {
      phase: "placement",
      turnSeconds: options?.turnSeconds ?? BATTLESHIP_DEFAULT_TURN_SECONDS,
      seas: [emptySea(), emptySea()],
      turn: 0,
      deadline: ctx.now + BATTLESHIP_PLACEMENT_MS,
      winner: null,
      reason: null,
    };
  },

  move(state, seat, move, ctx) {
    if (state.phase === "over") return { ok: false, error: "game_over" };
    const sea = state.seas[seat];
    if (!sea) return { ok: false, error: "not_a_player" };

    if (move.type === "place") {
      if (state.phase !== "placement") return { ok: false, error: "wrong_phase" };
      const ships = move.ships.map(normaliseShip);
      if (!isValidFleet(ships)) return { ok: false, error: "bad_fleet" };
      sea.ships = ships;
      sea.ready = true;
      if (state.seas.every((s) => s.ready)) startBattle(state, ctx.now);
      return { ok: true, state };
    }

    if (move.type === "unready") {
      if (state.phase !== "placement") return { ok: false, error: "wrong_phase" };
      sea.ready = false;
      return { ok: true, state };
    }

    if (state.phase !== "battle") return { ok: false, error: "wrong_phase" };
    if (state.turn !== seat) return { ok: false, error: "not_your_turn" };
    const cell = cellIndex(move.x, move.y);
    if (state.seas[other(seat)]!.shots[cell] !== SHOT_NONE)
      return { ok: false, error: "already_shot" };
    fire(state, seat, cell, ctx.now);
    return { ok: true, state };
  },

  view(state, seat) {
    const you = seat === 0 || seat === 1 ? seat : null;
    return {
      phase: state.phase,
      you,
      turn: state.turn,
      deadline: state.deadline,
      turnSeconds: state.turnSeconds,
      placementMs: BATTLESHIP_PLACEMENT_MS,
      grids: [gridView(state, 0, you), gridView(state, 1, you)],
      winner: state.winner,
    };
  },

  active(state) {
    if (state.phase === "placement") return [0, 1].filter((seat) => !state.seas[seat]!.ready);
    if (state.phase === "battle") return [state.turn];
    return [];
  },

  result(state): GameResult | null {
    if (state.phase !== "over" || state.winner === null) return null;
    return { winners: [state.winner], draw: false, reason: state.reason ?? "fleet-sunk" };
  },

  tick(state, ctx: EngineContext) {
    if (state.phase === "over" || state.deadline === null || ctx.now < state.deadline) return null;
    const next = JSON.parse(JSON.stringify(state)) as BattleshipState;
    if (next.phase === "placement") {
      // Late players keep the fleet they last sent, or get a random one.
      for (const sea of next.seas) {
        if (sea.ready) continue;
        if (!sea.ships || !isValidFleet(sea.ships)) sea.ships = randomFleet(ctx.random);
        sea.ready = true;
      }
      startBattle(next, ctx.now);
      return next;
    }
    // Out of time: a random shot at a free cell keeps the game going.
    const target = next.seas[other(next.turn)]!;
    const free: number[] = [];
    target.shots.forEach((code, cell) => {
      if (code === SHOT_NONE) free.push(cell);
    });
    if (free.length === 0) return null;
    const cell = free[Math.min(free.length - 1, Math.floor(ctx.random() * free.length))]!;
    fire(next, next.turn, cell, ctx.now);
    return next;
  },

  leave(state, seat) {
    if (state.phase === "over") return state;
    state.phase = "over";
    state.winner = other(seat);
    state.reason = "resign";
    state.deadline = null;
    return state;
  },
};
