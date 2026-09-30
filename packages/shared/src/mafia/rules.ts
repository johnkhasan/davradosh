/**
 * Sports mafia, following the official rules of the Sports Mafia Federation
 * (ФСМ, edition of 17 October 2022). Clause numbers in comments refer to that document.
 * See mafia-plan.md for the online adaptations.
 */

/** 1.1: the official table has exactly ten players. */
export const MAFIA_PLAYERS = 10;

/**
 * Tables of other sizes are an (unofficial) club variant with the same rules: only the cast
 * changes. Below six the black team would be one player; above twelve a day gets very long.
 */
export const MAFIA_MIN_PLAYERS = 6;
export const MAFIA_MAX_PLAYERS = 12;

export type MafiaRole = "civilian" | "sheriff" | "mafia" | "don";
export type MafiaTeam = "red" | "black";

/** Size of the black team (the Don included): about a third of the table, 3 of 10 officially. */
export function blackTeamSize(players: number): number {
  return players <= 8 ? 2 : players <= 11 ? 3 : 4;
}

/**
 * The cards for a table: one Don and the rest of the black team, one Sheriff, civilians.
 * For ten players this is the official deck (1.1): 7 red with the Sheriff, 3 black with the Don.
 */
export function mafiaRoleDeck(players: number): MafiaRole[] {
  if (!Number.isInteger(players) || players < MAFIA_MIN_PLAYERS || players > MAFIA_MAX_PLAYERS) {
    throw new Error(
      `mafia tables have ${MAFIA_MIN_PLAYERS}–${MAFIA_MAX_PLAYERS} players, not ${players}`,
    );
  }
  const black = blackTeamSize(players);
  return [
    ...Array<MafiaRole>(players - black - 1).fill("civilian"),
    "sheriff",
    ...Array<MafiaRole>(black - 1).fill("mafia"),
    "don",
  ];
}

/** 1.1: the official deck. */
export const MAFIA_ROLE_DECK: readonly MafiaRole[] = mafiaRoleDeck(MAFIA_PLAYERS);

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

/** Longest text a player without a microphone can send in one message. */
export const MAFIA_SAY_MAX = 200;

/** 6.4: three fouls cost the player their next minute of speech (they may still nominate). */
export const MAFIA_FOULS_SILENCE = 3;
/** 6.5: a fourth foul removes the player at once, without last words. */
export const MAFIA_FOULS_OUT = 4;

/** 4.5.9: the best move names exactly three numbers. */
export const BEST_MOVE_SIZE = 3;
