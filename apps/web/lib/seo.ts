import { MAX_PLAYERS_PER_ROOM, PIECE_COUNT_OPTIONS } from "@puzzle/shared";
import { SITE_URL } from "./env";

export const SITE_NAME = "Puzzle — birga yig'amiz";

export const SITE_TITLE = "Pazl onlayn: do'stlar bilan birga puzzle yig'ing";

export const SITE_DESCRIPTION = `Bepul onlayn pazl (puzzle) o'yini: o'z rasmingizdan puzzle yarating, havolani Telegram'da ulashing va ${MAX_PLAYERS_PER_ROOM} kishigacha do'stlaringiz bilan real vaqtda birga yig'ing. Ro'yxatdan o'tish shart emas.`;

/**
 * Shared Open Graph fields. No title/description here: Next fills them from each page's own
 * title and description (room invites keep their text). A page that sets `openGraph` spreads these.
 */
export const OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
  locale: "uz_UZ",
} as const;

const minPieces = PIECE_COUNT_OPTIONS[0];
const maxPieces = PIECE_COUNT_OPTIONS[PIECE_COUNT_OPTIONS.length - 1];

/** Questions shown on the landing page and published as FAQPage structured data. */
export const FAQ = [
  {
    question: "Onlayn pazl o'yini bepulmi?",
    answer:
      "Ha, butunlay bepul. Ro'yxatdan o'tish, parol yoki email kerak emas: ism va rang tanlaysiz, xolos.",
  },
  {
    question: "Do'stlar bilan qanday birga puzzle yig'iladi?",
    answer: `Rasm tanlang, puzzle yarating va havolani Telegram yoki WhatsApp orqali yuboring. Havolani ochgan ${MAX_PLAYERS_PER_ROOM} kishigacha do'stingiz shu zahoti bitta stolda siz bilan yig'ishni boshlaydi, har kimning kursori ismi bilan ko'rinadi.`,
  },
  {
    question: "O'z rasmimdan puzzle yasasam bo'ladimi?",
    answer:
      "Bo'ladi. Oilaviy surat, sayohat rasmi yoki istalgan JPG, PNG, WebP rasmni yuklang yoki galereyadan tanlang.",
  },
  {
    question: "Puzzle necha bo'lakdan iborat bo'ladi?",
    answer: `${minPieces} dan ${maxPieces} gacha bo'lak: tezkor 5 daqiqalik o'yindan butun oqshomlik sarguzashtgacha.`,
  },
  {
    question: "Telefonda o'ynasa bo'ladimi?",
    answer:
      "Ha. Puzzle telefon, planshet va kompyuterda ishlaydi: bo'laklarni barmoq, sichqoncha yoki trackpad bilan surasiz, ikki barmoq bilan kattalashtirasiz.",
  },
  {
    question: "Yig'ib bo'lmagan puzzle saqlanadimi?",
    answer:
      "Ha, puzzle 7 kun saqlanadi. Bugun tugata olmasangiz, ertaga xuddi shu havola orqali qolgan joyingizdan davom etasiz.",
  },
] as const;

/** JSON-LD for the landing page: the web app itself and its FAQ. */
export function landingJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      alternateName: ["Pazl onlayn", "Online jigsaw puzzle"],
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: "GameApplication",
      genre: ["Jigsaw puzzle", "Multiplayer"],
      operatingSystem: "Any (web browser)",
      inLanguage: "uz",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}

/** Safe to inline in <script type="application/ld+json">. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
