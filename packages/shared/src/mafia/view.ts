import type { MafiaRole, MafiaTeam } from "./rules";

export type MafiaPhaseKind =
  | "roleReveal"
  | "zeroNight"
  | "speech"
  | "voting"
  | "tieSpeech"
  | "liftAllVote"
  | "lastWords"
  | "shoot"
  | "donCheck"
  | "sheriffCheck"
  | "bestMove"
  | "dawn"
  | "gameOver";

/** Night sub-phases are shown to everyone as one plain "night", so their order and length reveal nothing. */
export const NIGHT_PHASES: readonly MafiaPhaseKind[] = [
  "zeroNight",
  "shoot",
  "donCheck",
  "sheriffCheck",
  "bestMove",
];

export type MafiaResult = "red" | "black" | "draw";

/** Why a player left the table. Roles are never part of it (4.4.13). */
/** Why a player left the table. Roles are never part of it (4.4.13). "fouled": a fourth foul (6.5). */
export type MafiaExit = "voted" | "killed" | "left" | "fouled";

export interface MafiaSeatView {
  seat: number;
  playerId: string;
  name: string;
  alive: boolean;
  exit: MafiaExit | null;
  /** Fouls given by the host (6.3–6.5). */
  fouls: number;
  /** Only filled in for the viewer's own seat, for black teammates of a black viewer, and for everyone at game over. */
  role: MafiaRole | null;
}

export interface MafiaCheckView {
  night: number;
  seat: number;
  /** Sheriff: "red" | "black". Don: "sheriff" | "not-sheriff". */
  result: MafiaTeam | "sheriff" | "not-sheriff";
}

/** Public log line. Built only from public facts: nominations, votes, exits (never roles or night choices). */
export type MafiaEvent =
  | { type: "day"; day: number }
  | { type: "night"; night: number }
  | { type: "nominated"; by: number; seat: number }
  | { type: "noVote"; reason: "firstDaySingle" | "noCandidates" | "playerLeft" }
  | { type: "votes"; round: number; tally: Array<{ seat: number; voters: number[] }> }
  | { type: "tie"; seats: number[] }
  | { type: "liftAll"; seats: number[]; yes: number[]; passed: boolean }
  | { type: "votedOut"; seats: number[] }
  | { type: "killed"; seat: number }
  | { type: "miss" }
  | { type: "bestMove"; seat: number; seats: number[] }
  | { type: "left"; seat: number }
  /** Typed speech of a player without a microphone, only during their own minute. */
  | { type: "said"; seat: number; text: string }
  | { type: "foul"; seat: number; count: number }
  | { type: "fouledOut"; seat: number }
  | { type: "gameOver"; result: MafiaResult };

export type MafiaAction =
  "pass" | "nominate" | "vote" | "liftAll" | "shoot" | "check" | "bestMove" | "say";

/** One night of the game, revealed to everyone at game over. */
export interface MafiaNightRecord {
  night: number;
  /** Each living black player's shot (null: did not shoot). */
  shots: Array<{ seat: number; target: number | null }>;
  killed: number | null;
  don: MafiaCheckView | null;
  sheriff: MafiaCheckView | null;
  bestMove: number[] | null;
}

/**
 * Everything one person may know about the game, computed per viewer by the server.
 * Spectators (and dead players) get the same shape with `me: null` or a dead seat.
 */
export interface MafiaView {
  /** What the viewer sees: night sub-phases collapse to "night" unless the viewer acts in them. */
  phase: MafiaPhaseKind | "night";
  endsAt: number;
  day: number;
  night: number;
  seats: MafiaSeatView[];
  me: number | null;
  /** Seat whose microphone is open (speech, tie speech, last words). */
  speaker: number | null;
  /** Candidates in nomination order, for the current day. */
  nominations: Array<{ seat: number; by: number }>;
  /** Candidates of the ballot in progress (voting / lift-all). */
  ballot: number[];
  /** The viewer's own choice in the ballot in progress, if any. */
  myVote: number | boolean | null;
  /** Night checks the viewer made (Sheriff or Don), oldest first. */
  checks: MafiaCheckView[];
  /** Actions the viewer can take right now. */
  actions: MafiaAction[];
  /** The 4.5.9 best move, once announced. */
  bestMove: { seat: number; seats: number[] } | null;
  log: MafiaEvent[];
  result: MafiaResult | null;
  /** The current speaker lost this minute to three fouls (6.4): no microphone, nominating only. */
  speakerSilenced: boolean;
  /** Zero-night text chat of the black team; empty for everyone else. */
  teamChat: Array<{ seat: number; text: string }>;
  /** Every night's shots and checks, only once the game is over. */
  history: MafiaNightRecord[] | null;
}
