/** The daily puzzle changes at midnight in Tashkent (UTC+5, no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" of the given moment in Tashkent. */
export function tashkentDay(now: number): string {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Server time when the given Tashkent day began. */
export function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - TASHKENT_OFFSET_MS;
}

export function previousDay(day: string): string {
  return tashkentDay(dayStart(day) - 1);
}

/** Milliseconds until the next Tashkent midnight. */
export function msUntilNextDay(now: number): number {
  return dayStart(tashkentDay(now)) + DAY_MS - now;
}

/**
 * Pieces of the day: a bigger puzzle on weekends (Saturday and Sunday, 100 pieces),
 * a quicker one on weekdays (64 pieces).
 */
export function piecesForDay(day: string): number {
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6 ? 100 : 64;
}

/** FNV-1a: a stable 32-bit number for a string (same day → same picture and cut). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seedForDay(day: string): number {
  return hashString(`daily-seed:${day}`);
}
