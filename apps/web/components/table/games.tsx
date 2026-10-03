"use client";

import type { TableGameKind } from "@puzzle/shared/games";
import dynamic from "next/dynamic";
import { texts as battleship } from "@/components/games/battleship/text";
import { texts as checkers } from "@/components/games/checkers/text";
import { texts as chess } from "@/components/games/chess/text";
import { texts as race } from "@/components/games/race/text";
import { texts as uno } from "@/components/games/uno/text";
import { PuzzleLoader } from "@/components/puzzle-loader";
import type { BoardComponent, GameTexts } from "./board-types";

const loading = () => <PuzzleLoader label="O'yin yuklanmoqda" />;

/** Each board is its own chunk: a chess player never downloads the uno cards. */
export const BOARDS: Record<TableGameKind, BoardComponent> = {
  chess: dynamic(() => import("@/components/games/chess/board"), { ssr: false, loading }),
  checkers: dynamic(() => import("@/components/games/checkers/board"), { ssr: false, loading }),
  uno: dynamic(() => import("@/components/games/uno/board"), { ssr: false, loading }),
  battleship: dynamic(() => import("@/components/games/battleship/board"), { ssr: false, loading }),
  race: dynamic(() => import("@/components/games/race/board"), { ssr: false, loading }),
};

export const GAME_TEXTS: Record<TableGameKind, GameTexts> = {
  chess,
  checkers,
  uno,
  battleship,
  race,
};
