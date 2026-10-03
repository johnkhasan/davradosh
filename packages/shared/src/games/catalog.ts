/** Turn-based table games that share one room system (lobby, seats, chat, rematch). */
export const TABLE_GAME_KINDS = ["chess", "checkers", "uno", "battleship", "race"] as const;
export type TableGameKind = (typeof TABLE_GAME_KINDS)[number];

export interface TableGameInfo {
  kind: TableGameKind;
  /** Uzbek name shown in the UI. */
  name: string;
  emoji: string;
  /** Site path of the game page; rooms live under `${path}/${id}`. */
  path: string;
  minPlayers: number;
  maxPlayers: number;
}

export const TABLE_GAMES: Record<TableGameKind, TableGameInfo> = {
  chess: {
    kind: "chess",
    name: "Shaxmat",
    emoji: "♟️",
    path: "/shaxmat",
    minPlayers: 2,
    maxPlayers: 2,
  },
  checkers: {
    kind: "checkers",
    name: "Shashka",
    emoji: "⚫",
    path: "/shashka",
    minPlayers: 2,
    maxPlayers: 2,
  },
  uno: { kind: "uno", name: "Uno", emoji: "🃏", path: "/uno", minPlayers: 2, maxPlayers: 8 },
  battleship: {
    kind: "battleship",
    name: "Dengiz jangi",
    emoji: "🚢",
    path: "/dengiz-jangi",
    minPlayers: 2,
    maxPlayers: 2,
  },
  race: {
    kind: "race",
    name: "Puzzle poyga",
    emoji: "🏁",
    path: "/puzzle/poyga",
    minPlayers: 2,
    maxPlayers: 8,
  },
};

export function isTableGameKind(value: unknown): value is TableGameKind {
  return typeof value === "string" && (TABLE_GAME_KINDS as readonly string[]).includes(value);
}
