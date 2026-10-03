import type { PuzzleSnapshot } from "@puzzle/shared";
import { snapshotFits } from "@/lib/game/practice-save";

/**
 * Progress of a race or a daily puzzle kept in localStorage, so a reload continues the same
 * puzzle instead of starting over. One entry per key (room + game, or day).
 */
export interface ModeSave {
  seed: number;
  snapshot: PuzzleSnapshot;
  /** Time already spent (daily puzzle; the clock only runs while the page is open). */
  elapsedMs?: number;
}

const PREFIX = "puzzle:mode:";

export function loadModeSave(key: string, seed: number, pieceCount: number): ModeSave | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const save = JSON.parse(raw) as ModeSave;
    if (save?.seed !== seed || !Array.isArray(save.snapshot?.groups)) return null;
    return snapshotFits(save.snapshot, pieceCount) ? save : null;
  } catch {
    return null;
  }
}

export function hasModeSave(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null;
  } catch {
    return false;
  }
}

export function writeModeSave(key: string, save: ModeSave) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(save));
  } catch {
    // Storage blocked or full: progress just isn't kept.
  }
}

export function clearModeSave(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Drops saves of other days/rooms with the same prefix, so storage does not fill up. */
export function pruneModeSaves(prefix: string, keep: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const name = localStorage.key(i);
      if (name?.startsWith(PREFIX + prefix) && name !== PREFIX + keep)
        localStorage.removeItem(name);
    }
  } catch {
    // ignore
  }
}

/** "1:23" or "1:02:03" for a running clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
