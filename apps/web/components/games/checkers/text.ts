import type { GameTexts } from "@/components/table/board-types";

export const texts: GameTexts = {
  RESULT_REASONS: {
    no_pieces: "Yutqazgan tomonning barcha donalari urib olindi",
    no_moves: "Yutqazgan tomonning yuradigan joyi qolmadi",
    resign: "O'yinchi taslim bo'ldi yoki o'yindan chiqdi",
    timeout: "Yurish vaqti tugadi",
    agreement: "O'yinchilar durangga kelishdi",
    repetition: "Bir xil holat uch marta takrorlandi",
    kings_only: "15 yurish davomida faqat damkalar yurdi va urish bo'lmadi",
  },
  ERRORS: {
    not_your_turn: "Hozir sizning navbatingiz emas",
    illegal_move: "Bunday yurish mumkin emas",
    must_capture: "Urish majburiy: avval raqib donasini uring",
    must_continue: "Urishni o'sha dona bilan davom ettiring",
    no_draw_offer: "Durang taklifi yo'q",
    draw_already_offered: "Durang allaqachon taklif qilingan",
    draw_offer_wait: "Yana taklif qilish uchun bir yurish kuting",
  },
  optionsText: (options) => {
    const seconds = (options as { turnSeconds?: number } | null)?.turnSeconds ?? 0;
    return seconds > 0 ? `Har bir yurishga ${seconds} soniya` : "Vaqt cheklovisiz";
  },
  HOW_TO:
    "Oqlar birinchi yuradi. Donalar diagonal bo'ylab oldinga yuradi, urish esa majburiy va orqaga ham mumkin. Oxirgi qatorga yetgan dona damkaga aylanadi va istalgancha uzoqqa yuradi.",
};
