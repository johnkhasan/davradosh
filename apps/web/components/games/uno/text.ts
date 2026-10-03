import type { GameTexts } from "@/components/table/board-types";

export const texts: GameTexts = {
  RESULT_REASONS: {
    "empty-hand": "Barcha kartalarini tugatdi",
    "last-player": "Stolda yolg'iz qoldi",
  },
  ERRORS: {
    not_your_turn: "Hozir sizning navbatingiz emas",
    not_in_hand: "Bu karta qo'lingizda yo'q",
    cant_play: "Bu kartani hozir qo'yib bo'lmaydi",
    color_required: "Avval rangni tanlang",
    only_drawn_card: "Endi faqat olingan kartani qo'yish mumkin",
    already_drawn: "Bu navbatda karta olib bo'ldingiz",
    cant_pass: "O'tkazishdan oldin bitta karta oling",
    choose_color: "Avval rangni tanlang",
    not_choosing: "Rang allaqachon tanlangan",
    no_catch: "Kech qoldingiz: ushlab bo'lmaydi",
  },
  optionsText: (options) => {
    const o = (options ?? {}) as { stacking?: boolean; turnSeconds?: number };
    const seconds = o.turnSeconds ?? 30;
    return `Navbat ${seconds} soniya · ${o.stacking ? "+2 va +4 ustiga qo'yish mumkin" : "+2 va +4 ustiga qo'yilmaydi"}`;
  },
  HOW_TO:
    "Ochiq kartaga rangi, raqami yoki belgisi mos kartani qo'ying, mos kelmasa bitta karta oling. Oxirgidan oldingi kartani qo'yayotganda «Uno!» tugmasini bosing, aks holda boshqalar sizni ushlab, 2 ta karta oldirishadi. Birinchi bo'lib kartalarini tugatgan yutadi.",
};
