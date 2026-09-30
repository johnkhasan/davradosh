/**
 * Sports mafia, following the official rules of the Sports Mafia Federation
 * (ФСМ, edition of 17 October 2022). Clause numbers in comments refer to that document.
 * See mafia-plan.md for the online adaptations.
 */

/** 1.1: exactly ten players. */
export const MAFIA_PLAYERS = 10;

export type MafiaRole = "civilian" | "sheriff" | "mafia" | "don";
export type MafiaTeam = "red" | "black";

/** 1.1: 7 red cards (one of them the Sheriff) and 3 black cards (one of them the Don). */
export const MAFIA_ROLE_DECK: readonly MafiaRole[] = [
  "civilian",
  "civilian",
  "civilian",
  "civilian",
  "civilian",
  "civilian",
  "sheriff",
  "mafia",
  "mafia",
  "don",
];

export function teamOf(role: MafiaRole): MafiaTeam {
  return role === "mafia" || role === "don" ? "black" : "red";
}

/** Phase lengths in milliseconds. Values marked "official" come straight from the rules. */
export const MAFIA_TIMINGS = {
  roleReveal: 10_000,
  /** 4.2.1: the black team gets exactly one minute to meet and agree on the shooting order. */
  zeroNight: 60_000,
  /** 4.3.1: one minute per player per day (official). */
  speech: 60_000,
  /** How long a disconnected speaker is waited for before their minute counts as passed. */
  absentSpeaker: 10_000,
  /** Online ballot: a few seconds per candidate (offline it is ~1.5 s of raised fists, 4.4.5). */
  votePerCandidate: 5_000,
  /** 4.4.12: extra 30 seconds for each tied candidate (official). */
  tieSpeech: 30_000,
  liftAllVote: 5_000,
  /** 4.4.13, 4.5.4: one minute of last words for anyone leaving the table (official). */
  lastWords: 60_000,
  shoot: 10_000,
  /** 4.5.6 / 4.5.7: at most 10 seconds for each check (official). */
  donCheck: 10_000,
  sheriffCheck: 10_000,
  /** 4.5.9: 20 seconds to name three numbers (official). */
  bestMove: 20_000,
  dawn: 5_000,
} as const;

export type MafiaTimings = { [K in keyof typeof MAFIA_TIMINGS]: number };

/** 7.7: a draw once three nights in a row pass without anyone leaving the table. */
export const MAFIA_DRAW_NIGHTS = 3;

/** 4.5.9: the best move names exactly three numbers. */
export const BEST_MOVE_SIZE = 3;
