import type { GameTexts } from "@/components/table/board-types";

export function turnSecondsText(seconds: number): string {
  return seconds > 0 ? `Har o'qqa ${seconds} soniya` : "Vaqt cheklovi yo'q";
}

export const texts: GameTexts = {
  RESULT_REASONS: {
    "fleet-sunk": "Butun flot cho'ktirildi",
    resign: "Raqibi taslim bo'ldi yoki o'yindan chiqdi",
  },
  ERRORS: {
    bad_fleet: "Kemalar noto'g'ri joylashgan: 10 ta kema bir-biriga tegmasligi kerak",
    wrong_phase: "Hozir buni qilib bo'lmaydi",
    already_shot: "Bu katakka allaqachon o'q uzilgan",
    not_your_turn: "Hozir raqib o'q uzmoqda",
  },
  optionsText: (options) => {
    const seconds = (options as { turnSeconds?: number } | null)?.turnSeconds ?? 45;
    return turnSecondsText(seconds);
  },
  HOW_TO:
    "Avval 10 ta kemangizni joylashtiring: ular bir-biriga, hatto burchagi bilan ham tegmasligi kerak. Keyin navbat bilan raqib dengiziga o'q uzasiz: tekkizsangiz yana otasiz. Raqibning hamma kemasini birinchi bo'lib cho'ktirgan yutadi.",
};
