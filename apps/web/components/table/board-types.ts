import type { TableGameDTO, TableResult, TableRoomStateDTO } from "@puzzle/shared/games";
import type { ComponentType } from "react";

/** What the room screen gives a game's board. */
export interface BoardProps<V = unknown> {
  /** The engine's view for this viewer (`game.view`, typed). */
  view: V;
  game: TableGameDTO;
  room: TableRoomStateDTO;
  /** Local time minus server time: `endsAt + clockOffset` is a local timestamp. */
  clockOffset: number;
  /** Sends a move. Errors are already shown to the player by the room screen. */
  move: (move: unknown) => Promise<TableResult>;
}

/** Texts a game adds to the shared room screen (components/games/<kind>/text.ts). */
export interface GameTexts {
  /** GameResult.reason → sentence, for example { checkmate: "Mat" }. */
  RESULT_REASONS: Record<string, string>;
  /** Engine error codes → sentence. */
  ERRORS: Record<string, string>;
  /** One line about the room's options shown in the lobby, or null. */
  optionsText?: (options: unknown) => string | null;
  /** How to play, in two or three short sentences, shown in the lobby. */
  HOW_TO: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BoardComponent = ComponentType<BoardProps<any>>;
