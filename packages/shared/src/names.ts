const ADJECTIVES = [
  "Chaqqon",
  "Aqlli",
  "Quvnoq",
  "Sabrli",
  "Epchil",
  "Dadil",
  "Ziyrak",
  "Mehribon",
  "Shijoatli",
  "Hushyor",
  "Sirli",
  "Yorqin",
];

const ANIMALS = [
  "Tulki",
  "Boyqush",
  "Burgut",
  "Sher",
  "Qunduz",
  "Delfin",
  "Panda",
  "Yo'lbars",
  "Kiyik",
  "Lochin",
  "Tipratikan",
  "Olmaxon",
];

export const AVATAR_EMOJIS = [
  "🦊",
  "🦉",
  "🦅",
  "🦁",
  "🦫",
  "🐬",
  "🐼",
  "🐯",
  "🦌",
  "🐿️",
  "🦔",
  "🐧",
] as const;

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

/** Fun random display name such as "Chaqqon Tulki". */
export function randomUsername(random: () => number = Math.random): string {
  return `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`;
}

export function randomAvatar(random: () => number = Math.random): string {
  return pick(AVATAR_EMOJIS, random);
}
