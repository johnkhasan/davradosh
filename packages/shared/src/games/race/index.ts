import { z } from "zod";
import { PIECE_COUNT_OPTIONS } from "../../constants";
import { gridForPieceCount } from "../../puzzle/grid";
import type { GameEngine, GameResult } from "../engine";

/**
 * Puzzle race: every player solves their own copy of the same picture with the same cut
 * (same seed). Progress is reported by the clients; the first one to finish wins.
 */

/** Everyone starts together this long after the game is set up. */
export const RACE_COUNTDOWN_MS = 3_000;
/** Sanity floor for a finish: 2 seconds per 10 pieces. */
export const RACE_MIN_MS_PER_PIECE = 200;

/** What the client sends when creating a room. */
export const RaceOptionsSchema = z.object({
  imageId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  pieces: z
    .number()
    .int()
    .refine((n) => (PIECE_COUNT_OPTIONS as readonly number[]).includes(n))
    .default(48),
  rotation: z.literal(false).optional(),
});
export type RaceOptions = z.infer<typeof RaceOptionsSchema>;

export const RaceImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  thumbUrl: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().nullable().optional(),
});
export type RaceImage = z.infer<typeof RaceImageSchema>;

/**
 * What the server stores after looking the image up (apps/server/src/table/prepare.ts).
 * The room hands this shape (not the client's input) to `setup`.
 */
export const RacePreparedOptionsSchema = z.object({
  image: RaceImageSchema,
  pieces: z.number().int().min(2).max(1000),
});
export type RacePreparedOptions = z.infer<typeof RacePreparedOptionsSchema>;

export interface Racer {
  /** Pieces connected so far (as reported by the player; never goes down). */
  placed: number;
  /** Server time of the finish, null while solving. */
  finishedAt: number | null;
  left: boolean;
}

export type RaceEndReason = "finished" | "last-player" | "abandoned";

export interface RaceState {
  /** Null only when the room was created without a prepared image (should not happen). */
  image: RaceImage | null;
  seed: number;
  cols: number;
  rows: number;
  /** cols × rows: the real piece count. */
  total: number;
  /** Server time the race starts (after the countdown). */
  startsAt: number;
  racers: Racer[];
  winner: number | null;
  reason: RaceEndReason | null;
}

/** Nothing is hidden in a race: everyone sees everything. */
export type RaceView = RaceState;

export const RaceMoveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), placed: z.number().int().min(0).max(10_000) }),
  z.object({ type: z.literal("finish") }),
]);
export type RaceMove = z.infer<typeof RaceMoveSchema>;

/** Reads stored options (prepared shape); tolerant so a bad room never crashes the server. */
export function readRaceOptions(options: unknown): { image: RaceImage | null; pieces: number } {
  const prepared = RacePreparedOptionsSchema.safeParse(options);
  if (prepared.success) return prepared.data;
  const raw = options as { pieces?: unknown } | null | undefined;
  const pieces =
    typeof raw?.pieces === "number" && raw.pieces >= 2 && raw.pieces <= 1000 ? raw.pieces : 48;
  return { image: null, pieces };
}

/** Shortest believable solve for a puzzle of `total` pieces. */
export function raceMinSolveMs(total: number): number {
  return total * RACE_MIN_MS_PER_PIECE;
}

function stillRacing(state: RaceState): number[] {
  const seats: number[] = [];
  state.racers.forEach((racer, seat) => {
    if (!racer.left && racer.finishedAt === null) seats.push(seat);
  });
  return seats;
}

const over = (state: RaceState) => state.winner !== null || state.reason !== null;

export const raceEngine: GameEngine<RaceState, RaceMove, RaceView, RaceOptions> = {
  kind: "race",
  moveSchema: RaceMoveSchema,
  optionsSchema: RaceOptionsSchema,

  setup(players, options, ctx) {
    const { image, pieces } = readRaceOptions(options);
    const aspect = image ? image.width / image.height : 4 / 3;
    const { cols, rows } = gridForPieceCount(pieces, aspect);
    return {
      image,
      seed: Math.floor(ctx.random() * 0xffffffff) >>> 0,
      cols,
      rows,
      total: cols * rows,
      startsAt: ctx.now + RACE_COUNTDOWN_MS,
      racers: Array.from({ length: players }, () => ({
        placed: 0,
        finishedAt: null,
        left: false,
      })),
      winner: null,
      reason: null,
    };
  },

  move(state, seat, move, ctx) {
    if (over(state)) return { ok: false, error: "game_over" };
    const racer = state.racers[seat];
    if (!racer || racer.left) return { ok: false, error: "not_a_player" };
    if (ctx.now < state.startsAt) return { ok: false, error: "not_started" };
    if (racer.finishedAt !== null) return { ok: false, error: "already_finished" };

    if (move.type === "progress") {
      if (move.placed > state.total) return { ok: false, error: "invalid" };
      // A stale (smaller) report is ignored: progress only goes up.
      racer.placed = Math.max(racer.placed, move.placed);
      return { ok: true, state };
    }

    // Finishing implies every piece is in place.
    if (ctx.now - state.startsAt < raceMinSolveMs(state.total))
      return { ok: false, error: "too_fast" };
    racer.placed = state.total;
    racer.finishedAt = ctx.now;
    state.winner = seat;
    state.reason = "finished";
    return { ok: true, state };
  },

  view: (state) => state,

  active: (state) => (over(state) ? [] : stillRacing(state)),

  result(state): GameResult | null {
    if (state.winner !== null)
      return { winners: [state.winner], draw: false, reason: state.reason ?? "finished" };
    if (state.reason === "abandoned") return { winners: [], draw: true, reason: "abandoned" };
    return null;
  },

  leave(state, seat) {
    const racer = state.racers[seat];
    if (!racer || racer.left || over(state)) return state;
    racer.left = true;
    const remaining = stillRacing(state);
    if (remaining.length === 1) {
      state.winner = remaining[0]!;
      state.reason = "last-player";
    } else if (remaining.length === 0) {
      state.reason = "abandoned";
    }
    return state;
  },
};
