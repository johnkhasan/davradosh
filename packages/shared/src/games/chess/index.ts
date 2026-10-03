import { Chess, DEFAULT_POSITION, type Square } from "chess.js";
import { z } from "zod";
import type { GameEngine, GameResult } from "../engine";

/**
 * Chess (FIDE rules through chess.js). Seat 0 plays white, seat 1 black.
 *
 * Clock: Fischer style. White's clock starts running as soon as the game starts; each move
 * deducts the time spent and then adds the increment. A flag fall loses, unless the opponent
 * has only a king or a king and one minor piece left (then it is a draw).
 */

export const CHESS_MINUTES = [0, 3, 5, 10, 15, 30] as const;
export const CHESS_INCREMENTS = [0, 2, 3, 5, 10] as const;
export type ChessMinutes = (typeof CHESS_MINUTES)[number];
export type ChessIncrement = (typeof CHESS_INCREMENTS)[number];

export interface ChessOptions {
  /** 0 = no clock. */
  minutes: ChessMinutes;
  /** Seconds added after each move. */
  increment: ChessIncrement;
}

export const CHESS_DEFAULT_OPTIONS: ChessOptions = { minutes: 10, increment: 0 };

export const ChessOptionsSchema = z.object({
  minutes: z.literal(CHESS_MINUTES).default(CHESS_DEFAULT_OPTIONS.minutes),
  increment: z.literal(CHESS_INCREMENTS).default(CHESS_DEFAULT_OPTIONS.increment),
});

const SquareSchema = z.string().regex(/^[a-h][1-8]$/);
export type PromotionPiece = "q" | "r" | "b" | "n";

export const ChessMoveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    from: SquareSchema,
    to: SquareSchema,
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
  }),
  z.object({ type: z.literal("offer-draw") }),
  z.object({ type: z.literal("accept-draw") }),
  z.object({ type: z.literal("decline-draw") }),
]);
export type ChessMove = z.infer<typeof ChessMoveSchema>;

export type ChessResultReason =
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty"
  | "insufficient"
  | "agreement"
  | "timeout"
  | "resign";

export interface ChessState {
  /** Position the game started from (the standard one; tests use others). */
  startFen: string;
  fen: string;
  /** Every move from the start position as UCI (e2e4, e7e8q): replayed for threefold repetition. */
  moves: string[];
  san: string[];
  /** Captured pieces in order, FEN letters (uppercase = a white piece was taken). */
  captured: string[];
  /** Null when the game has no clock. Times in ms. */
  clock: { increment: number; remaining: [number, number]; turnStartedAt: number } | null;
  /** Seat whose draw offer is waiting for an answer. */
  drawOffer: number | null;
  /** Ply count at each seat's last draw offer: one offer per move. */
  lastOfferPly: [number, number];
  result: GameResult | null;
}

export interface ChessClockView {
  /** Remaining ms for [white, black] as of `turnStartedAt` (the running side keeps ticking). */
  remaining: [number, number];
  increment: number;
  /** Seat whose clock runs now, null once the game is over. */
  running: number | null;
  /** Server time the running clock started from. */
  turnStartedAt: number;
}

export interface ChessView {
  fen: string;
  /** Seat to move (0 white, 1 black). */
  turn: number;
  lastMove: { from: string; to: string } | null;
  /** Square of the king in check, if any. */
  check: string | null;
  san: string[];
  /** Pieces each side has taken: white took black pieces (lowercase letters) and vice versa. */
  captured: { white: string[]; black: string[] };
  /** Material balance in pawns, white minus black. */
  material: number;
  clock: ChessClockView | null;
  drawOffer: number | null;
  /** The viewer may offer a draw now. */
  canOfferDraw: boolean;
  /** The viewer's legal moves when it is their turn: from-square → to-squares. */
  legal: Record<string, string[]>;
  result: GameResult | null;
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const turnOf = (fen: string) => (fen.split(" ")[1] === "b" ? 1 : 0);

/** Replays the whole game so chess.js knows the position history (threefold repetition). */
function replay(state: ChessState): Chess {
  const chess = new Chess(state.startFen);
  for (const uci of state.moves) {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
  }
  return chess;
}

/** Whether a side still has enough material to ever mate (more than a king, or a king and one minor piece). */
export function canMate(fen: string, seat: number): boolean {
  const placement = fen.split(" ")[0]!;
  const own = [...placement].filter((ch) => (seat === 0 ? /[PNBRQ]/ : /[pnbrq]/).test(ch));
  if (own.length === 0) return false;
  if (own.length === 1 && /[nbNB]/.test(own[0]!)) return false;
  return true;
}

function timeoutResult(fen: string, flagged: number): GameResult {
  const other = 1 - flagged;
  return canMate(fen, other)
    ? { winners: [other], draw: false, reason: "timeout" }
    : { winners: [], draw: true, reason: "timeout" };
}

/** Whether the clock of the side to move has run out at `now`. */
function flagFell(state: ChessState, now: number): boolean {
  if (!state.clock || state.result) return false;
  const seat = turnOf(state.fen);
  return state.clock.remaining[seat]! - (now - state.clock.turnStartedAt) <= 0;
}

function endResult(chess: Chess, mover: number): GameResult | null {
  if (chess.isCheckmate()) return { winners: [mover], draw: false, reason: "checkmate" };
  if (chess.isStalemate()) return { winners: [], draw: true, reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { winners: [], draw: true, reason: "insufficient" };
  if (chess.isThreefoldRepetition()) return { winners: [], draw: true, reason: "threefold" };
  if (chess.isDrawByFiftyMoves()) return { winners: [], draw: true, reason: "fifty" };
  return null;
}

export const chessEngine: GameEngine<ChessState, ChessMove, ChessView, ChessOptions> = {
  kind: "chess",
  moveSchema: ChessMoveSchema,
  optionsSchema: ChessOptionsSchema,

  setup(_players, options, ctx) {
    const ms = options.minutes * 60_000;
    return {
      startFen: DEFAULT_POSITION,
      fen: DEFAULT_POSITION,
      moves: [],
      san: [],
      captured: [],
      clock:
        options.minutes > 0
          ? { increment: options.increment * 1000, remaining: [ms, ms], turnStartedAt: ctx.now }
          : null,
      drawOffer: null,
      lastOfferPly: [-1, -1],
      result: null,
    };
  },

  move(state, seat, move, ctx) {
    if (state.result) return { ok: false, error: "game_over" };
    if (seat !== 0 && seat !== 1) return { ok: false, error: "not_a_player" };
    const other = 1 - seat;

    if (move.type === "offer-draw") {
      // Both sides offering is an agreement.
      if (state.drawOffer === other) {
        state.result = { winners: [], draw: true, reason: "agreement" };
        state.drawOffer = null;
        return { ok: true, state };
      }
      if (state.drawOffer === seat) return { ok: true, state };
      if (state.lastOfferPly[seat] === state.moves.length)
        return { ok: false, error: "draw_offer_limit" };
      state.drawOffer = seat;
      state.lastOfferPly[seat] = state.moves.length;
      return { ok: true, state };
    }
    if (move.type === "accept-draw" || move.type === "decline-draw") {
      if (state.drawOffer !== other) return { ok: false, error: "no_draw_offer" };
      state.drawOffer = null;
      if (move.type === "accept-draw")
        state.result = { winners: [], draw: true, reason: "agreement" };
      return { ok: true, state };
    }

    if (turnOf(state.fen) !== seat) return { ok: false, error: "not_your_turn" };
    // Too late: the flag fell before the move arrived.
    if (flagFell(state, ctx.now)) {
      state.clock!.remaining[seat] = 0;
      state.clock!.turnStartedAt = ctx.now;
      state.result = timeoutResult(state.fen, seat);
      state.drawOffer = null;
      return { ok: true, state };
    }

    const chess = replay(state);
    const from = move.from as Square;
    const to = move.to as Square;
    const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (candidates.length === 0) return { ok: false, error: "illegal" };
    const promotes = candidates.some((m) => m.promotion);
    if (promotes && !move.promotion) return { ok: false, error: "promotion_required" };
    const made = chess.move({ from, to, promotion: promotes ? move.promotion : undefined });

    state.fen = chess.fen();
    state.moves.push(made.lan);
    state.san.push(made.san);
    if (made.captured) {
      state.captured.push(made.color === "w" ? made.captured : made.captured.toUpperCase());
    }
    // An offer stands until the side it was made to moves instead of answering.
    if (state.drawOffer === other) state.drawOffer = null;
    if (state.clock) {
      const spent = ctx.now - state.clock.turnStartedAt;
      state.clock.remaining[seat] = state.clock.remaining[seat]! - spent + state.clock.increment;
      state.clock.turnStartedAt = ctx.now;
    }
    state.result = endResult(chess, seat);
    if (state.result) state.drawOffer = null;
    return { ok: true, state };
  },

  view(state, seat, now) {
    const chess = new Chess(state.fen);
    const turn = turnOf(state.fen);
    const last = state.moves.at(-1);

    const check = chess.inCheck()
      ? (chess.findPiece({ type: "k", color: chess.turn() })[0] ?? null)
      : null;

    const legal: Record<string, string[]> = {};
    if (!state.result && seat === turn && !flagFell(state, now)) {
      for (const m of chess.moves({ verbose: true })) {
        const list = (legal[m.from] ??= []);
        if (!list.includes(m.to)) list.push(m.to);
      }
    }

    let material = 0;
    for (const ch of state.fen.split(" ")[0]!) {
      const value = VALUES[ch.toLowerCase()];
      if (value === undefined) continue;
      material += ch === ch.toUpperCase() ? value : -value;
    }

    return {
      fen: state.fen,
      turn,
      lastMove: last ? { from: last.slice(0, 2), to: last.slice(2, 4) } : null,
      check,
      san: state.san,
      captured: {
        white: state.captured.filter((c) => c === c.toLowerCase()),
        black: state.captured.filter((c) => c === c.toUpperCase()),
      },
      material,
      clock: state.clock
        ? {
            remaining: [state.clock.remaining[0], state.clock.remaining[1]],
            increment: state.clock.increment,
            running: state.result ? null : turn,
            turnStartedAt: state.clock.turnStartedAt,
          }
        : null,
      drawOffer: state.drawOffer,
      canOfferDraw:
        !state.result &&
        (seat === 0 || seat === 1) &&
        state.drawOffer === null &&
        state.lastOfferPly[seat] !== state.moves.length,
      legal,
      result: state.result,
    };
  },

  active(state) {
    return state.result ? [] : [turnOf(state.fen)];
  },

  result(state) {
    return state.result;
  },

  tick(state, ctx) {
    if (!flagFell(state, ctx.now)) return null;
    const seat = turnOf(state.fen);
    const next = JSON.parse(JSON.stringify(state)) as ChessState;
    next.clock!.remaining[seat] = 0;
    next.clock!.turnStartedAt = ctx.now;
    next.result = timeoutResult(state.fen, seat);
    next.drawOffer = null;
    return next;
  },

  leave(state, seat) {
    if (state.result || (seat !== 0 && seat !== 1)) return state;
    state.result = { winners: [1 - seat], draw: false, reason: "resign" };
    state.drawOffer = null;
    return state;
  },
};
