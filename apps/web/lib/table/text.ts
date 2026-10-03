/** Uzbek texts shared by every table game. Games add their own in components/games/<kind>/text.ts. */
export const ROOM_ERRORS: Record<string, string> = {
  not_host: "Buni faqat stol egasi qila oladi",
  not_ready: "Hamma tayyor emas yoki o'yinchilar yetarli emas",
  wrong_status: "Hozir buni qilib bo'lmaydi",
  invalid: "Amal bajarilmadi. Qayta urinib ko'ring",
  not_a_player: "Siz bu o'yinda o'ynamayapsiz",
  rate_limited: "Juda tez. Biroz kuting",
  game_over: "O'yin tugagan",
  not_your_turn: "Hozir sizning navbatingiz emas",
  illegal: "Bunday yurish mumkin emas",
};

export function errorText(code: string, extra?: Record<string, string>): string {
  return extra?.[code] ?? ROOM_ERRORS[code] ?? "Amal bajarilmadi";
}

export function playersText(min: number, max: number): string {
  return min === max ? `${min} kishilik` : `${min}–${max} kishilik`;
}
