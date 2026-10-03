import type { ImageDTO } from "@puzzle/shared";
import type { GalleryItem, GalleryService } from "../images/gallery";
import { publicPlayerId } from "../lib/ids";
import {
  dayStart,
  hashString,
  msUntilNextDay,
  piecesForDay,
  previousDay,
  seedForDay,
  tashkentDay,
} from "./day";
import type { DailyEntry, DailyRepository } from "./repository";

export interface DailyPuzzle {
  day: string;
  image: ImageDTO;
  seed: number;
  pieces: number;
  /** Until the next puzzle, measured on the server when this was sent. */
  nextInMs: number;
}

export interface DailyLeaderRow {
  rank: number;
  /** Public player id. */
  id: string;
  name: string;
  color: string;
  avatar: string;
  ms: number;
  you: boolean;
}

export interface DailyLeaderboard {
  day: string;
  total: number;
  top: DailyLeaderRow[];
  /** The caller's own row (also when outside the top), null without a time. */
  you: DailyLeaderRow | null;
}

export type DailySubmitResult =
  | { ok: true; day: string; ms: number; improved: boolean; rank: number; total: number }
  | { ok: false; error: "wrong_day" | "too_fast" | "too_slow" | "time_mismatch" };

/** Nobody places a piece faster than this on average. */
export const DAILY_MIN_MS_PER_PIECE = 400;
/** A result is refused after a whole day of solving. */
export const DAILY_MAX_MS = 24 * 60 * 60 * 1000;
/** Allowance for network delay between the start request and the first move. */
export const DAILY_START_SLACK_MS = 5_000;
/** Yesterday's puzzle can still be finished this long after midnight. */
export const DAILY_LATE_MS = 3 * 60 * 60 * 1000;
export const DAILY_TOP = 20;

/**
 * The puzzle of the day: the same picture and cut for everyone, chosen from the gallery
 * by the date. Start times live in memory; best times go to the repository.
 */
export class DailyService {
  private readonly puzzles = new Map<string, Promise<Omit<DailyPuzzle, "nextInMs">>>();
  /** day → (public player id → start time). */
  private readonly starts = new Map<string, Map<string, number>>();
  private readonly now: () => number;

  constructor(
    private readonly opts: {
      gallery: Pick<GalleryService, "list" | "import">;
      repository: DailyRepository;
      now?: () => number;
    },
  ) {
    this.now = opts.now ?? Date.now;
  }

  today(): string {
    return tashkentDay(this.now());
  }

  async puzzle(): Promise<DailyPuzzle> {
    const day = this.today();
    let pending = this.puzzles.get(day);
    if (!pending) {
      pending = this.choose(day);
      this.puzzles.set(day, pending);
      // A failed download is retried on the next request.
      pending.catch(() => this.puzzles.delete(day));
      for (const key of this.puzzles.keys()) if (key < previousDay(day)) this.puzzles.delete(key);
    }
    return { ...(await pending), nextInMs: msUntilNextDay(this.now()) };
  }

  private async choose(day: string) {
    const items = await this.opts.gallery.list();
    if (items.length === 0) throw new Error("Gallery is empty");
    // Landscape photos suit a screen best; keep the order stable whatever the provider sends.
    const landscape = items.filter(
      (item) => item.width >= item.height && item.width / item.height <= 2,
    );
    const pool = [...(landscape.length > 0 ? landscape : items)].sort((a, b) =>
      key(a).localeCompare(key(b)),
    );
    const first = hashString(`daily-image:${day}`) % pool.length;
    let lastError: unknown;
    for (let attempt = 0; attempt < Math.min(3, pool.length); attempt++) {
      const item = pool[(first + attempt) % pool.length]!;
      try {
        const image = await this.opts.gallery.import(item.provider, item.id);
        return { day, image, seed: seedForDay(day), pieces: piecesForDay(day) };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /** Remembers when a player first opened the day's puzzle (in memory only). */
  start(clientId: string, day = this.today()): { day: string; startedAt: number } | null {
    if (!this.acceptsDay(day)) return null;
    const now = this.now();
    for (const key of this.starts.keys())
      if (key < previousDay(this.today())) this.starts.delete(key);
    let byPlayer = this.starts.get(day);
    if (!byPlayer) {
      byPlayer = new Map();
      this.starts.set(day, byPlayer);
    }
    const id = publicPlayerId(clientId);
    const startedAt = byPlayer.get(id) ?? now;
    byPlayer.set(id, startedAt);
    return { day, startedAt };
  }

  /** Today, or yesterday shortly after midnight (a solve that crossed midnight). */
  private acceptsDay(day: string): boolean {
    const today = this.today();
    if (day === today) return true;
    return day === previousDay(today) && this.now() - dayStart(today) <= DAILY_LATE_MS;
  }

  async submit(input: {
    clientId: string;
    name: string;
    color: string;
    avatar: string;
    ms: number;
    day?: string;
  }): Promise<DailySubmitResult> {
    const day = input.day ?? this.today();
    if (!this.acceptsDay(day)) return { ok: false, error: "wrong_day" };
    if (input.ms < piecesForDay(day) * DAILY_MIN_MS_PER_PIECE)
      return { ok: false, error: "too_fast" };
    if (input.ms > DAILY_MAX_MS) return { ok: false, error: "too_slow" };
    const playerId = publicPlayerId(input.clientId);
    const startedAt = this.starts.get(day)?.get(playerId);
    // The clock on the page can only be slower than the server's (it pauses when closed).
    if (startedAt !== undefined && input.ms > this.now() - startedAt + DAILY_START_SLACK_MS) {
      // Claims more time than has passed: harmless, but not believable either.
      return { ok: false, error: "time_mismatch" };
    }
    const previous = await this.opts.repository.get(day, playerId);
    const saved = await this.opts.repository.saveBest({
      day,
      playerId,
      name: input.name,
      color: input.color,
      avatar: input.avatar,
      ms: Math.round(input.ms),
    });
    const [faster, total] = await Promise.all([
      this.opts.repository.countFaster(day, saved.ms),
      this.opts.repository.count(day),
    ]);
    return {
      ok: true,
      day,
      ms: saved.ms,
      improved: !previous || saved.ms < previous.ms,
      rank: faster + 1,
      total,
    };
  }

  async leaderboard(day = this.today(), clientId?: string): Promise<DailyLeaderboard> {
    const you = clientId ? publicPlayerId(clientId) : null;
    const [rows, total] = await Promise.all([
      this.opts.repository.top(day, DAILY_TOP),
      this.opts.repository.count(day),
    ]);
    const top: DailyLeaderRow[] = [];
    rows.forEach((row, index) => {
      const prev = top[index - 1];
      const rank = prev && prev.ms === row.ms ? prev.rank : index + 1;
      top.push(toRow(row, rank, row.playerId === you));
    });
    let own = top.find((row) => row.you) ?? null;
    if (!own && you) {
      const entry = await this.opts.repository.get(day, you);
      if (entry) {
        const faster = await this.opts.repository.countFaster(day, entry.ms);
        own = toRow(entry, faster + 1, true);
      }
    }
    return { day, total, top, you: own };
  }
}

function key(item: GalleryItem) {
  return `${item.provider}:${item.id.padStart(8, "0")}`;
}

function toRow(entry: DailyEntry, rank: number, you: boolean): DailyLeaderRow {
  return {
    rank,
    id: entry.playerId,
    name: entry.name,
    color: entry.color,
    avatar: entry.avatar,
    ms: entry.ms,
    you,
  };
}
