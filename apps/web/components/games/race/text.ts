import { gridForPieceCount } from "@puzzle/shared";
import { readRaceOptions } from "@puzzle/shared/games/race";
import type { GameTexts } from "@/components/table/board-types";

export const texts: GameTexts = {
  RESULT_REASONS: {
    finished: "Puzzle'ni birinchi bo'lib yig'di",
    "last-player": "Boshqa poygachilar poygani tark etdi",
    abandoned: "Hamma poygani tark etdi",
  },
  ERRORS: {
    not_started: "Poyga hali boshlanmadi",
    too_fast: "Juda tez: natija qabul qilinmadi",
    already_finished: "Siz allaqachon marraga yetdingiz",
    game_over: "Poyga tugadi",
  },
  optionsText: (options) => {
    // The same cut the engine makes, so the lobby shows the exact count.
    const { image, pieces } = readRaceOptions(options);
    const { cols, rows } = gridForPieceCount(pieces, image ? image.width / image.height : 4 / 3);
    return `${cols * rows} bo'lak · bir xil rasm`;
  },
  HOW_TO:
    "Hamma bir xil rasmni bir xil bo'laklar bilan bir vaqtda yig'adi. Boshqalarning qancha yig'gani jonli ko'rinib turadi. Kim birinchi bo'lib tugatsa, o'sha yutadi.",
};
