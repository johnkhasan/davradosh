import { blackTeamSize } from "@puzzle/shared/mafia";
import type {
  MafiaActionError,
  MafiaEvent,
  MafiaResult,
  MafiaRole,
  MafiaRoomError,
  MafiaView,
} from "@puzzle/shared/mafia";

/** Uzbek texts for the mafia UI. */

export const ROLE_TEXT: Record<
  MafiaRole,
  { name: string; emoji: string; team: string; goal: string }
> = {
  civilian: {
    name: "Tinch aholi",
    emoji: "🙂",
    team: "Qizillar",
    goal: "Kunduzi mafiyani topib, ovoz bilan stoldan chiqaring.",
  },
  sheriff: {
    name: "Sherif",
    emoji: "⭐",
    team: "Qizillar",
    goal: "Har tun bitta o'yinchini tekshiring va shaharga mafiyani toping.",
  },
  mafia: {
    name: "Mafiya",
    emoji: "🕶️",
    team: "Qoralar",
    goal: "Jamoangiz bilan bitta nishonni oting va sezdirmang.",
  },
  don: {
    name: "Don",
    emoji: "🎩",
    team: "Qoralar",
    goal: "Mafiyani boshqaring va har tun Sherifni qidiring.",
  },
};

export function phaseTitle(view: MafiaView): string {
  switch (view.phase) {
    case "roleReveal":
      return "Rollar tarqatilmoqda";
    case "zeroNight":
      return "Tanishuv tuni";
    case "night":
      return view.night === 1 ? "Tanishuv tuni" : `${view.night}-tun`;
    case "speech":
      return `${view.day}-kun · muhokama`;
    case "voting":
      return "Ovoz berish";
    case "tieSpeech":
      return "Teng ovoz · qo'shimcha so'z";
    case "liftAllVote":
      return "Hammasi chiqsinmi?";
    case "lastWords":
      return "Oxirgi so'z";
    case "shoot":
      return "Mafiya ovda";
    case "donCheck":
      return "Don qidiryapti";
    case "sheriffCheck":
      return "Sherif tekshiradi";
    case "bestMove":
      return "Eng yaxshi yurish";
    case "dawn":
      return "Tong otdi";
    case "gameOver":
      return "O'yin tugadi";
  }
}

export const RESULT_TEXT: Record<MafiaResult, string> = {
  red: "Qizillar yutdi!",
  black: "Qoralar yutdi!",
  draw: "Durang",
};

const seat = (n: number) => `${n}-raqam`;
const seats = (list: number[]) => list.map(seat).join(", ");

export function eventText(event: MafiaEvent): string {
  switch (event.type) {
    case "day":
      return `☀️ ${event.day}-kun boshlandi`;
    case "night":
      return event.night === 1 ? "🌙 Tanishuv tuni" : `🌙 ${event.night}-tun`;
    case "nominated":
      return `${seat(event.by)} ${seat(event.seat)}ni nomzod qilib ko'rsatdi`;
    case "noVote":
      return event.reason === "firstDaySingle"
        ? "Birinchi kunda bitta nomzod: ovoz berilmaydi"
        : event.reason === "playerLeft"
          ? "O'yinchi stolni tark etgani uchun ovoz berilmaydi"
          : "Nomzod yo'q: ovoz berilmaydi";
    case "votes":
      return `Ovozlar${event.round > 1 ? " (qayta)" : ""}: ${event.tally
        .map((t) => `${seat(t.seat)} — ${t.voters.length}`)
        .join(", ")}`;
    case "tie":
      return `Teng ovoz: ${seats(event.seats)}`;
    case "liftAll":
      return `"Hammasi chiqsinmi?" — ${event.yes.length} ta "ha": ${event.passed ? "chiqarildi" : "qoladi"}`;
    case "votedOut":
      return `🗳️ ${seats(event.seats)} stolni tark etdi`;
    case "killed":
      return `🔫 Kechasi ${seat(event.seat)} o'ldirildi`;
    case "miss":
      return "🌅 Kechasi o'q tegmadi, hech kim o'lmadi";
    case "bestMove":
      return `🎯 ${seat(event.seat)}ning eng yaxshi yurishi: ${seats(event.seats)}`;
    case "left":
      return `🚪 ${seat(event.seat)} o'yindan chiqdi`;
    case "gameOver":
      return `🏁 ${RESULT_TEXT[event.result]}`;
  }
}

const ERROR_TEXT: Record<MafiaActionError | MafiaRoomError, string> = {
  wrong_phase: "Hozir bunday qilib bo'lmaydi",
  not_a_player: "Siz bu o'yinda o'ynamayapsiz",
  dead: "Siz stoldan chiqqansiz",
  not_your_turn: "Hozir sizning navbatingiz emas",
  not_allowed: "Rolingiz bunga ruxsat bermaydi",
  invalid_target: "Bu o'yinchini tanlab bo'lmaydi",
  already_done: "Buni allaqachon qildingiz",
  not_host: "Buni faqat xona egasi qila oladi",
  not_ready: "Hamma tayyor emas yoki 10 kishi to'lmadi",
  wrong_status: "Hozir bunday qilib bo'lmaydi",
  invalid: "Aloqa yo'q, qayta urinib ko'ring",
};

export function errorText(error: string): string {
  return ERROR_TEXT[error as keyof typeof ERROR_TEXT] ?? "Xatolik yuz berdi";
}

/** "3 qora (Don bilan) · 1 Sherif · 6 tinch aholi" for a table of `players`. */
export function castText(players: number): string {
  const black = blackTeamSize(players);
  return `${black} qora (Don bilan) · 1 Sherif · ${players - black - 1} tinch aholi`;
}

/** Seat grid columns on wider screens: rows of about five. */
export function seatColumns(players: number): string {
  return players <= 8 ? "sm:grid-cols-4" : players <= 10 ? "sm:grid-cols-5" : "sm:grid-cols-6";
}
