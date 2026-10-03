import type { AnyGameEngine, TableGameKind } from "@puzzle/shared/games";
import { battleshipEngine } from "@puzzle/shared/games/battleship";
import { checkersEngine } from "@puzzle/shared/games/checkers";
import { chessEngine } from "@puzzle/shared/games/chess";
import { raceEngine } from "@puzzle/shared/games/race";
import { unoEngine } from "@puzzle/shared/games/uno";

export const ENGINES: Record<TableGameKind, AnyGameEngine> = {
  chess: chessEngine,
  checkers: checkersEngine,
  uno: unoEngine,
  battleship: battleshipEngine,
  race: raceEngine,
};
