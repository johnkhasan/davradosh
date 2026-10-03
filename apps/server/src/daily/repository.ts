import type { Db } from "../db";

/** One player's best time for one day. `playerId` is the public id, never the client id. */
export interface DailyEntry {
  day: string;
  playerId: string;
  name: string;
  color: string;
  avatar: string;
  ms: number;
}

export interface DailyRepository {
  get(day: string, playerId: string): Promise<DailyEntry | null>;
  /** Stores the time if it beats the player's best (the name is always refreshed). */
  saveBest(entry: DailyEntry): Promise<DailyEntry>;
  /** Fastest first; equal times in the order they were first sent. */
  top(day: string, limit: number): Promise<DailyEntry[]>;
  /** How many players were strictly faster than `ms`. */
  countFaster(day: string, ms: number): Promise<number>;
  count(day: string): Promise<number>;
}

/** For tests and local development without PostgreSQL. */
export class MemoryDailyRepository implements DailyRepository {
  private readonly rows = new Map<string, DailyEntry & { order: number }>();
  private order = 0;

  private key(day: string, playerId: string) {
    return `${day}:${playerId}`;
  }

  async get(day: string, playerId: string) {
    const row = this.rows.get(this.key(day, playerId));
    return row ? strip(row) : null;
  }

  async saveBest(entry: DailyEntry) {
    const key = this.key(entry.day, entry.playerId);
    const existing = this.rows.get(key);
    const row = existing
      ? { ...existing, ...entry, ms: Math.min(existing.ms, entry.ms) }
      : { ...entry, order: this.order++ };
    this.rows.set(key, row);
    return strip(row);
  }

  async top(day: string, limit: number) {
    return [...this.rows.values()]
      .filter((row) => row.day === day)
      .sort((a, b) => a.ms - b.ms || a.order - b.order)
      .slice(0, limit)
      .map(strip);
  }

  async countFaster(day: string, ms: number) {
    let count = 0;
    for (const row of this.rows.values()) if (row.day === day && row.ms < ms) count++;
    return count;
  }

  async count(day: string) {
    let count = 0;
    for (const row of this.rows.values()) if (row.day === day) count++;
    return count;
  }
}

function strip({ day, playerId, name, color, avatar, ms }: DailyEntry): DailyEntry {
  return { day, playerId, name, color, avatar, ms };
}

export class PrismaDailyRepository implements DailyRepository {
  constructor(private readonly db: Db) {}

  async get(day: string, playerId: string) {
    const row = await this.db.dailyResult.findUnique({
      where: { day_playerId: { day, playerId } },
    });
    return row ? strip(row) : null;
  }

  async saveBest(entry: DailyEntry) {
    const where = { day_playerId: { day: entry.day, playerId: entry.playerId } };
    const existing = await this.db.dailyResult.findUnique({ where });
    const ms = existing ? Math.min(existing.ms, entry.ms) : entry.ms;
    const row = await this.db.dailyResult.upsert({
      where,
      create: entry,
      update: { name: entry.name, color: entry.color, avatar: entry.avatar, ms },
    });
    return strip(row);
  }

  async top(day: string, limit: number) {
    const rows = await this.db.dailyResult.findMany({
      where: { day },
      orderBy: [{ ms: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
    return rows.map(strip);
  }

  async countFaster(day: string, ms: number) {
    return this.db.dailyResult.count({ where: { day, ms: { lt: ms } } });
  }

  async count(day: string) {
    return this.db.dailyResult.count({ where: { day } });
  }
}
