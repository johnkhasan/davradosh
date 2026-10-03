import type { GameTexts } from "@/components/table/board-types";

/** "10 + 5" style label of a time control; minutes 0 = no clock. */
export function timeControlText(minutes: number, increment: number): string {
  if (minutes <= 0) return "Soatsiz";
  return increment > 0 ? `${minutes} + ${increment}` : `${minutes} daqiqa`;
}

export const texts: GameTexts = {
  RESULT_REASONS: {
    checkmate: "Mat",
    stalemate: "Pat: yurishga joy yo'q",
    threefold: "Pozitsiya uch marta takrorlandi",
    fifty: "50 yurish qoidasi",
    insufficient: "Mat qilishga dona yetmaydi",
    agreement: "Kelishilgan durang",
    timeout: "Vaqt tugadi",
    resign: "Raqib taslim bo'ldi yoki o'yindan chiqdi",
  },
  ERRORS: {
    illegal: "Bunday yurish mumkin emas",
    promotion_required: "Piyoda qaysi donaga aylanishini tanlang",
    no_draw_offer: "Durang taklifi yo'q",
    draw_offer_limit: "Bitta yurishda bir marta durang taklif qilish mumkin",
  },
  optionsText: (options) => {
    const o = (options ?? {}) as { minutes?: number; increment?: number };
    const minutes = o.minutes ?? 10;
    const increment = o.increment ?? 0;
    if (minutes <= 0) return "Vaqt nazoratisiz";
    return increment > 0
      ? `Vaqt: ${minutes} daqiqa + har yurishga ${increment} soniya`
      : `Vaqt: har kimga ${minutes} daqiqa`;
  },
  HOW_TO:
    "Birinchi o'yinchi oqlar bilan, ikkinchisi qoralar bilan o'ynaydi. Donani bosib yoki sudrab yuring: mumkin bo'lgan kataklar nuqta bilan ko'rsatiladi. Raqib shohiga mat qilgan g'olib bo'ladi.",
};
