import type { PuzzleSnapshot } from "@puzzle/shared";
import type { PuzzleImage } from "./images";

/**
 * Single-player progress kept in localStorage, so a refresh (or closing the tab)
 * resumes the practice puzzle exactly where it was left.
 */
const KEY = "puzzle:practice:v1";

export interface PracticeSave {
  pieces: number;
  seed: number;
  table: string;
  /** Time already spent; the clock only runs while the page is open. */
  elapsedMs: number;
  /** "demo" for the built-in picture, otherwise a JPEG data URL of the uploaded one. */
  image: "demo" | { src: string; width: number; height: number };
  snapshot: PuzzleSnapshot;
}

export function loadPracticeSave(): PracticeSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as PracticeSave;
    if (!Array.isArray(save?.snapshot?.groups) || typeof save.seed !== "number") return null;
    return save;
  } catch {
    return null;
  }
}

export function writePracticeSave(save: PracticeSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Quota exceeded (large upload) or storage blocked: progress just isn't kept.
  }
}

export function clearPracticeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

const encoded = new WeakMap<PuzzleImage, string>();

/** JPEG data URL of an uploaded picture, cached so it is encoded once per image. */
export function encodeImage(image: PuzzleImage): string {
  let src = encoded.get(image);
  if (!src) {
    src = image.toDataURL("image/jpeg", 0.85);
    encoded.set(image, src);
  }
  return src;
}

/** Redraws a saved picture at its original size, so piece geometry matches the snapshot. */
export async function decodeImage(saved: {
  src: string;
  width: number;
  height: number;
}): Promise<PuzzleImage> {
  const element = new Image();
  element.src = saved.src;
  await element.decode();
  const canvas = document.createElement("canvas");
  canvas.width = saved.width;
  canvas.height = saved.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(element, 0, 0, saved.width, saved.height);
  encoded.set(canvas, saved.src);
  return canvas;
}

/** A snapshot is usable only if it covers every piece of the current grid exactly once. */
export function snapshotFits(snapshot: PuzzleSnapshot, pieceCount: number) {
  const seen = new Set<number>();
  for (const group of snapshot.groups) {
    for (const id of group.pieceIds) {
      if (!Number.isInteger(id) || id < 0 || id >= pieceCount || seen.has(id)) return false;
      seen.add(id);
    }
  }
  return seen.size === pieceCount;
}
