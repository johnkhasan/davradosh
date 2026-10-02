import { MAX_PLAYERS_PER_ROOM, PIECE_COUNT_OPTIONS } from "@puzzle/shared";
import { MAFIA_MAX_PLAYERS, MAFIA_MIN_PLAYERS, MAFIA_PLAYERS } from "@puzzle/shared/mafia";
import { SITE_URL } from "./env";

// ------------------------------------------------------------------ brand

export const SITE_NAME = "Davradosh";

export const SITE_TITLE = "Davradosh — do'stlar bilan onlayn o'yinlar";

export const SITE_DESCRIPTION =
  "Do'stlar davrasida o'ynaladigan bepul onlayn o'yinlar: pazl (puzzle) va sport mafiasi. Havolani Telegram'da ulashing, ovozli chatda gaplashing, ro'yxatdan o'tmasdan o'ynang.";

/**
 * Shared Open Graph fields. No title/description here: Next fills them from each page's own
 * title and description (room invites keep their text). A page that sets `openGraph` spreads these.
 */
export const OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
  locale: "uz_UZ",
} as const;

/** Searches people in Uzbekistan make for this kind of site, in Uzbek and Russian. */
export const SITE_KEYWORDS = [
  "davradosh",
  "onlayn o'yinlar",
  "do'stlar bilan o'yin",
  "do'stlar bilan onlayn o'yinlar",
  "bepul onlayn o'yinlar",
  "pazl onlayn",
  "puzzle o'yini",
  "mafia onlayn",
  "sport mafiasi",
  "ovozli chat o'yin",
  "онлайн игры с друзьями",
  "мафия онлайн",
  "пазлы онлайн",
];

// ------------------------------------------------------------------ games

const minPieces = PIECE_COUNT_OPTIONS[0];
const maxPieces = PIECE_COUNT_OPTIONS[PIECE_COUNT_OPTIONS.length - 1];

export const PUZZLE_TITLE = "Pazl onlayn: do'stlar bilan birga puzzle yig'ing";
export const PUZZLE_DESCRIPTION = `Bepul onlayn pazl (puzzle) o'yini: o'z rasmingizdan puzzle yarating, havolani Telegram'da ulashing va ${MAX_PLAYERS_PER_ROOM} kishigacha do'stlaringiz bilan real vaqtda birga yig'ing. Ro'yxatdan o'tish shart emas.`;

export const MAFIA_TITLE = "Mafia onlayn: do'stlar bilan ovozli sport mafiasi";
export const MAFIA_DESCRIPTION = `Bepul onlayn mafia o'yini: ${MAFIA_MIN_PLAYERS}–${MAFIA_MAX_PLAYERS} kishilik stol, rasmiy sport mafiasi qoidalari, ovozli chat va avtomatik boshlovchi. Stol yarating, havolani do'stlaringizga yuboring va o'ynang.`;

export const RULES_TITLE = "Mafia qoidalari: rollar, kun va tun, ovoz berish";
export const RULES_DESCRIPTION =
  "Sport mafiasining rasmiy qoidalari o'zbek tilida: Don, Sherif, mafiya va tinch aholi, tanishuv tuni, nomzod ko'rsatish, ovoz berish, eng yaxshi yurish, folllar va g'alaba shartlari.";

export interface GameInfo {
  slug: "puzzle" | "mafia";
  name: string;
  path: string;
  emoji: string;
  tagline: string;
  players: string;
  minPlayers: number;
  maxPlayers: number;
  genre: string[];
  description: string;
}

export const GAMES: GameInfo[] = [
  {
    slug: "puzzle",
    name: "Puzzle",
    path: "/puzzle",
    emoji: "🧩",
    tagline: "Bitta pazlni birga yig'ing: har kimning kursori ismi bilan ko'rinadi.",
    players: `1–${MAX_PLAYERS_PER_ROOM} kishi`,
    minPlayers: 1,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    genre: ["Jigsaw puzzle", "Puzzle", "Cooperative"],
    description: PUZZLE_DESCRIPTION,
  },
  {
    slug: "mafia",
    name: "Mafia",
    path: "/mafia",
    emoji: "🕵️",
    tagline: "Sport mafiasi: kunduzi muhokama, kechasi otishma, hammasi ovozli chatda.",
    players: `${MAFIA_MIN_PLAYERS}–${MAFIA_MAX_PLAYERS} kishi`,
    minPlayers: MAFIA_MIN_PLAYERS,
    maxPlayers: MAFIA_MAX_PLAYERS,
    genre: ["Party game", "Social deduction", "Mafia"],
    description: MAFIA_DESCRIPTION,
  },
];

// ------------------------------------------------------------------ FAQ

type Faq = ReadonlyArray<{ question: string; answer: string }>;

export const HOME_FAQ: Faq = [
  {
    question: "Davradosh nima?",
    answer:
      "Davradosh — do'stlar, oila yoki hamkasblar bilan birga o'ynaladigan onlayn o'yinlar sayti. Hozircha pazl (puzzle) va sport mafiasi bor, yangi o'yinlar qo'shilib boradi.",
  },
  {
    question: "O'yinlar bepulmi?",
    answer:
      "Ha, hammasi bepul. Ro'yxatdan o'tish, parol yoki email kerak emas: ism tanlaysiz, xolos.",
  },
  {
    question: "Do'stlarim bilan qanday o'ynayman?",
    answer:
      "O'yinni tanlang, stol yoki xona yarating va havolani Telegram yoki WhatsApp orqali yuboring. Havolani ochgan do'stlaringiz shu zahoti siz bilan o'ynaydi.",
  },
  {
    question: "Telefonda o'ynasa bo'ladimi?",
    answer:
      "Ha. Hamma o'yinlar telefon, planshet va kompyuter brauzerida ishlaydi, hech narsa yuklab olish shart emas.",
  },
  {
    question: "Ovozli chat bormi?",
    answer:
      "Ha. Mafiada so'z navbati kelganda mikrofoningiz o'zi ochiladi, puzzleda esa yig'ish davomida gaplashib turasiz.",
  },
];

export const PUZZLE_FAQ: Faq = [
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
];

export const MAFIA_FAQ: Faq = [
  {
    question: "Onlayn mafia o'yini bepulmi?",
    answer:
      "Ha, bepul. Ro'yxatdan o'tish shart emas: stol yaratasiz va havolani do'stlaringizga yuborasiz.",
  },
  {
    question: "Mafia necha kishi bilan o'ynaladi?",
    answer: `Rasmiy sport mafiasi ${MAFIA_PLAYERS} kishi bilan o'ynaladi. Davradosh'da ${MAFIA_MIN_PLAYERS} dan ${MAFIA_MAX_PLAYERS} kishigacha stol yaratish mumkin: qoidalar o'sha-o'sha, faqat qoralar soni o'zgaradi.`,
  },
  {
    question: "Boshlovchi kerakmi?",
    answer:
      "Yo'q. Boshlovchini server bajaradi: rollarni tarqatadi, so'z navbatini beradi, ovozlarni sanaydi va tunni yuritadi. Hamma o'ynaydi.",
  },
  {
    question: "Ovozli chatda qanday gaplashiladi?",
    answer:
      "Kunduzi har kim navbat bilan gapiradi: navbatingiz kelganda mikrofoningiz o'zi ochiladi. Tanishuv tunida faqat mafiya o'zaro gaplashadi. Mikrofon bo'lmasa, navbatingizda matn bilan yozasiz.",
  },
  {
    question: "Qaysi rollar bor?",
    answer:
      "Tinch aholi, Sherif, mafiya va Don. Sherif kechasi o'yinchilarni tekshiradi, Don Sherifni qidiradi, mafiya esa jamoasi bilan birga «otadi».",
  },
];

// ------------------------------------------------------------------ JSON-LD

const abs = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

const website = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: ["Davradosh.uz"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "uz",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
};

function faqPage(faq: Faq) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

function breadcrumbs(items: Array<[name: string, path: string]>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: abs(path),
    })),
  };
}

function videoGame(game: GameInfo) {
  return {
    "@type": ["VideoGame", "WebApplication"],
    "@id": `${abs(game.path)}#game`,
    name: `${game.name} — ${SITE_NAME}`,
    url: abs(game.path),
    description: game.description,
    genre: game.genre,
    applicationCategory: "GameApplication",
    gamePlatform: "Web browser",
    operatingSystem: "Any (web browser)",
    playMode: "MultiPlayer",
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: game.minPlayers,
      maxValue: game.maxPlayers,
    },
    inLanguage: "uz",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

const graph = (...nodes: object[]) => ({ "@context": "https://schema.org", "@graph": nodes });
const gameInfo = (slug: GameInfo["slug"]) => GAMES.find((g) => g.slug === slug)!;

export const homeJsonLd = () =>
  graph(
    website,
    organization,
    {
      "@type": "ItemList",
      name: "Davradosh o'yinlari",
      itemListElement: GAMES.map((game, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: abs(game.path),
        name: game.name,
      })),
    },
    faqPage(HOME_FAQ),
  );

export const puzzleJsonLd = () =>
  graph(
    videoGame(gameInfo("puzzle")),
    faqPage(PUZZLE_FAQ),
    breadcrumbs([
      [SITE_NAME, "/"],
      ["Puzzle", "/puzzle"],
    ]),
  );

export const mafiaJsonLd = () =>
  graph(
    videoGame(gameInfo("mafia")),
    faqPage(MAFIA_FAQ),
    breadcrumbs([
      [SITE_NAME, "/"],
      ["Mafia", "/mafia"],
    ]),
  );

export const rulesJsonLd = () =>
  graph(
    {
      "@type": "Article",
      headline: RULES_TITLE,
      description: RULES_DESCRIPTION,
      url: abs("/mafia/qoidalar"),
      inLanguage: "uz",
      about: { "@id": `${abs("/mafia")}#game` },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    breadcrumbs([
      [SITE_NAME, "/"],
      ["Mafia", "/mafia"],
      ["Qoidalar", "/mafia/qoidalar"],
    ]),
  );

/** Safe to inline in <script type="application/ld+json">. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
