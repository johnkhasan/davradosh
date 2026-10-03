import type { z } from "zod";
import type { TableGameKind } from "./catalog";

/** What an engine gets from the room: the clock and a random source (seeded in tests). */
export interface EngineContext {
  now: number;
  random: () => number;
}

/**
 * How a game ended. `winners` are seats; a draw has none. `reason` is a short code the
 * game's own UI turns into text (for example "checkmate", "resign", "timeout").
 */
export interface GameResult {
  winners: number[];
  draw: boolean;
  reason: string;
}

export type MoveResult<S> = { ok: true; state: S } | { ok: false; error: string };

/**
 * The rules of one table game. The room owns people and seats; the engine owns everything
 * else. Seats are numbered 0..players-1 in the order the room seated people.
 *
 * State is plain JSON (it is persisted). `move` and `leave` receive a private copy they may
 * change and return. `tick` must not change its input: it returns a new state or null.
 */
export interface GameEngine<S = unknown, M = unknown, V = unknown, O = unknown> {
  kind: TableGameKind;
  /** Validates player moves; anything else is rejected before `move` runs. */
  moveSchema: z.ZodType<M>;
  /** Validates room options chosen at creation (stored as given, after parsing). */
  optionsSchema: z.ZodType<O>;
  setup(players: number, options: O, ctx: EngineContext): S;
  move(state: S, seat: number, move: M, ctx: EngineContext): MoveResult<S>;
  /** What one seat sees; null is a spectator. Must not reveal hidden information. */
  view(state: S, seat: number | null, now: number): V;
  /** Seats that may act right now (highlighted in the UI). */
  active(state: S): number[];
  result(state: S): GameResult | null;
  /** Timers (turn limits, auto moves). Called a few times a second while playing. */
  tick?(state: S, ctx: EngineContext): S | null;
  /** A seat leaves for good: resigns, is kicked, or never came back after a disconnect. */
  leave(state: S, seat: number, ctx: EngineContext): S;
}

/** Erases the type parameters for registries that hold several engines. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameEngine = GameEngine<any, any, any, any>;
