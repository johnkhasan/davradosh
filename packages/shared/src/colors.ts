/**
 * High-contrast player colors. Each one stays readable as a cursor label
 * background with white text, on both light and dark tables.
 */
export const PLAYER_COLORS = [
  "#6C5CE7", // violet
  "#E84393", // pink
  "#00B894", // green
  "#0984E3", // blue
  "#E17055", // coral
  "#FDAA2C", // amber
  "#00A8B5", // teal
  "#D63031", // red
  "#8E44AD", // purple
  "#2D9CDB", // sky
  "#27AE60", // emerald
  "#F2994A", // orange
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export function isPlayerColor(value: string): value is PlayerColor {
  return (PLAYER_COLORS as readonly string[]).includes(value);
}
