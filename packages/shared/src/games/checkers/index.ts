import { z } from "zod";
import type { EngineContext, GameEngine, GameResult, MoveResult } from "../engine";
import {
  capturesFrom,
  initialPieces,
  positionKey,
  promotionRow,
  rowOf,
  startSteps,
  toGrid,
  type CheckersPiece,
  type CheckersStep,
  type Seat,
} from "./rules";

export {
  capturesFrom,
  colOf,
  initialPieces,
  isDark,
  parseSquare,
  rowOf,
  squareName,
  startSteps,
  type CheckersPiece,
  type CheckersStep,
} from "./rules";
export type { Seat as CheckersSeat };

/** Turn limits a room may choose, in seconds (0 = no limit). */
export const CHECKERS_TURN_SECONDS = [0, 30, 60] as const;
/** Plies (both sides' moves) with only kings moving and nothing captured that end in a draw. */
export const CHECKERS_KINGS_ONLY_PLIES = 30;

export const CheckersOptionsSchema = z
  .object({
    turnSeconds: z.union([z.literal(0), z.literal(30), z.literal(60)]).default(0),
  })
  .default({ turnSeconds: 0 });
export type CheckersOptions = z.output<typeof CheckersOptionsSchema>;

const square = z.number().int().min(0).max(63);
export const CheckersMoveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step"), from: square, to: square }),
  z.object({ type: z.literal("offer-draw") }),
  z.object({ type: z.literal("accept-draw") }),
  z.object({ type: z.literal("decline-draw") }),
]);
export type CheckersMove = z.output<typeof CheckersMoveSchema>;

/** The squares a finished (or running) move went through and what it took. */
export interface CheckersPath {
  seat: Seat;
  /** Start square, then every landing square. */
  path: number[];
  /** Squares of the pieces it captured. */
  captured: number[];
}

/** A capture sequence in progress: the same piece has to keep jumping. */
interface Chain {
  square: number;
  path: number[];
  captured: number[];
  /** The piece was a man when the move began (the move resets the draw counters). */
  startedAsMan: boolean;
}

export interface CheckersState {
  pieces: CheckersPiece[];
  turn: Seat;
  chain: Chain | null;
  lastMove: CheckersPath | null;
  /** Finished moves (plies) so far. */
  plies: number;
  /** Plies in a row with only kings moving and no capture. */
  kingsOnlyPlies: number;
  /** Times each position occurred since the last capture or man move. */
  positions: Record<string, number>;
  drawOffer: Seat | null;
  /** Ply count when each seat last offered a draw (one offer per ply). */
  drawOfferedAt: [number, number];
  turnSeconds: number;
  /** Server time the current turn runs out, or null without a turn limit. */
  deadline: number | null;
  result: GameResult | null;
}

export interface CheckersViewPiece {
  id: number;
  square: number;
  owner: Seat;
  king: boolean;
}

export interface CheckersView {
  pieces: CheckersViewPiece[];
  turn: Seat;
  /** The viewer's seat (0 white, 1 black), null for spectators. */
  seat: Seat | null;
  /** Steps the viewer may make now (empty when it is not their turn). */
  legal: { from: number; to: number; capture: boolean }[];
  /** True when the side to move is obliged to capture. */
  mustCapture: boolean;
  /** Square of the piece that must keep capturing, if a capture sequence is under way. */
  continuing: number | null;
  /** Pieces jumped in the move under way (still on the board until it ends). */
  capturing: number[];
  /** The move under way, or else the last finished move. */
  lastMove: CheckersPath | null;
  /** Pieces left: [white, black]. */
  counts: [number, number];
  drawOffer: Seat | null;
  /** True when the viewer may offer a draw right now. */
  canOfferDraw: boolean;
  turnSeconds: number;
  deadline: number | null;
  kingsOnlyPlies: number;
  result: GameResult | null;
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const isSeat = (seat: number): seat is Seat => seat === 0 || seat === 1;

/** Builds a state from a list of pieces (used by setup and by tests). */
export function createCheckersState(
  pieces: CheckersPiece[],
  turn: Seat,
  options: Partial<CheckersOptions>,
  now: number,
): CheckersState {
  const turnSeconds = options.turnSeconds ?? 0;
  const state: CheckersState = {
    pieces,
    turn,
    chain: null,
    lastMove: null,
    plies: 0,
    kingsOnlyPlies: 0,
    positions: { [positionKey(pieces, turn)]: 1 },
    drawOffer: null,
    drawOfferedAt: [-1, -1],
    turnSeconds,
    deadline: turnSeconds > 0 ? now + turnSeconds * 1000 : null,
    result: null,
  };
  state.result = noMovesResult(state);
  return state;
}

/** The steps the side to move may make now. */
export function legalSteps(state: CheckersState): CheckersStep[] {
  if (state.result) return [];
  if (state.chain) {
    return capturesFrom(toGrid(state.pieces), state.chain.square, state.chain.captured);
  }
  return startSteps(state.pieces, state.turn);
}

function noMovesResult(state: CheckersState): GameResult | null {
  const mover = state.turn;
  if (!state.pieces.some((p) => p.owner === mover)) {
    return { winners: [other(mover)], draw: false, reason: "no_pieces" };
  }
  if (startSteps(state.pieces, mover).length === 0) {
    return { winners: [other(mover)], draw: false, reason: "no_moves" };
  }
  return null;
}

/** Makes one step; returns an error code or null. */
function step(state: CheckersState, seat: Seat, from: number, to: number, now: number) {
  const steps = legalSteps(state);
  const chosen = steps.find((s) => s.from === from && s.to === to);
  if (!chosen) {
    if (state.chain && from !== state.chain.square) return "must_continue";
    if (steps.some((s) => s.capture !== null)) return "must_capture";
    return "illegal_move";
  }
  const piece = state.pieces.find((p) => p.square === from)!;
  const chain: Chain = state.chain ?? {
    square: from,
    path: [from],
    captured: [],
    startedAsMan: !piece.king,
  };
  piece.square = to;
  // A man reaching the far row is crowned at once, even in the middle of a capture.
  if (!piece.king && rowOf(to) === promotionRow(seat)) piece.king = true;
  chain.square = to;
  chain.path.push(to);
  if (chosen.capture !== null) {
    chain.captured.push(chosen.capture);
    if (capturesFrom(toGrid(state.pieces), to, chain.captured).length > 0) {
      state.chain = chain;
      return null;
    }
  }
  finishMove(state, seat, chain, now);
  return null;
}

function finishMove(state: CheckersState, seat: Seat, chain: Chain, now: number) {
  state.pieces = state.pieces.filter((p) => !chain.captured.includes(p.square));
  state.chain = null;
  state.lastMove = { seat, path: chain.path, captured: chain.captured };
  state.plies++;
  state.turn = other(seat);
  // Moving instead of answering declines the opponent's draw offer.
  if (state.drawOffer !== null && state.drawOffer !== seat) state.drawOffer = null;
  state.deadline = state.turnSeconds > 0 ? now + state.turnSeconds * 1000 : null;

  if (chain.captured.length > 0 || chain.startedAsMan) {
    state.kingsOnlyPlies = 0;
    state.positions = {};
  } else {
    state.kingsOnlyPlies++;
  }
  const key = positionKey(state.pieces, state.turn);
  const seen = (state.positions[key] ?? 0) + 1;
  state.positions[key] = seen;

  state.result = noMovesResult(state);
  if (state.result) return;
  if (seen >= 3) state.result = { winners: [], draw: true, reason: "repetition" };
  else if (state.kingsOnlyPlies >= CHECKERS_KINGS_ONLY_PLIES) {
    state.result = { winners: [], draw: true, reason: "kings_only" };
  }
}

function canOfferDraw(state: CheckersState, seat: Seat) {
  return !state.result && state.drawOffer === null && state.drawOfferedAt[seat] !== state.plies;
}

export const checkersEngine: GameEngine<
  CheckersState,
  CheckersMove,
  CheckersView,
  CheckersOptions
> = {
  kind: "checkers",
  moveSchema: CheckersMoveSchema,
  optionsSchema: CheckersOptionsSchema,

  setup(_players, options, ctx: EngineContext) {
    return createCheckersState(initialPieces(), 0, options ?? {}, ctx.now);
  },

  move(state, seat, move, ctx): MoveResult<CheckersState> {
    if (state.result) return { ok: false, error: "game_over" };
    if (!isSeat(seat)) return { ok: false, error: "not_a_player" };
    switch (move.type) {
      case "step": {
        if (seat !== state.turn) return { ok: false, error: "not_your_turn" };
        const error = step(state, seat, move.from, move.to, ctx.now);
        return error ? { ok: false, error } : { ok: true, state };
      }
      case "offer-draw": {
        // Both sides offering is an agreement.
        if (state.drawOffer === other(seat)) {
          state.result = { winners: [], draw: true, reason: "agreement" };
          return { ok: true, state };
        }
        if (state.drawOffer === seat) return { ok: false, error: "draw_already_offered" };
        if (!canOfferDraw(state, seat)) return { ok: false, error: "draw_offer_wait" };
        state.drawOffer = seat;
        state.drawOfferedAt[seat] = state.plies;
        return { ok: true, state };
      }
      case "accept-draw": {
        if (state.drawOffer !== other(seat)) return { ok: false, error: "no_draw_offer" };
        state.result = { winners: [], draw: true, reason: "agreement" };
        return { ok: true, state };
      }
      case "decline-draw": {
        if (state.drawOffer !== other(seat)) return { ok: false, error: "no_draw_offer" };
        state.drawOffer = null;
        return { ok: true, state };
      }
    }
  },

  view(state, seat): CheckersView {
    const viewer = seat !== null && isSeat(seat) ? seat : null;
    const steps = legalSteps(state);
    const chain = state.chain;
    return {
      pieces: state.pieces.map((p) => ({
        id: p.id,
        square: p.square,
        owner: p.owner,
        king: p.king,
      })),
      turn: state.turn,
      seat: viewer,
      legal:
        viewer === state.turn
          ? steps.map((s) => ({ from: s.from, to: s.to, capture: s.capture !== null }))
          : [],
      mustCapture: steps.some((s) => s.capture !== null),
      continuing: chain ? chain.square : null,
      capturing: chain ? [...chain.captured] : [],
      lastMove: chain
        ? { seat: state.turn, path: [...chain.path], captured: [...chain.captured] }
        : state.lastMove,
      counts: [
        state.pieces.filter((p) => p.owner === 0).length,
        state.pieces.filter((p) => p.owner === 1).length,
      ],
      drawOffer: state.drawOffer,
      canOfferDraw: viewer !== null && canOfferDraw(state, viewer),
      turnSeconds: state.turnSeconds,
      deadline: state.result ? null : state.deadline,
      kingsOnlyPlies: state.kingsOnlyPlies,
      result: state.result,
    };
  },

  active(state) {
    return state.result ? [] : [state.turn];
  },

  result(state) {
    return state.result;
  },

  tick(state, ctx) {
    if (state.result || state.deadline === null || ctx.now < state.deadline) return null;
    return {
      ...state,
      deadline: null,
      result: { winners: [other(state.turn)], draw: false, reason: "timeout" },
    };
  },

  leave(state, seat) {
    if (state.result || !isSeat(seat)) return state;
    state.result = { winners: [other(seat)], draw: false, reason: "resign" };
    return state;
  },
};
