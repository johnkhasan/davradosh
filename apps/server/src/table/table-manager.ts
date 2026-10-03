import { TABLE_GAMES, type TableGameKind } from "@puzzle/shared/games";
import type { FastifyBaseLogger } from "fastify";
import { publicPlayerId, randomId } from "../lib/ids";
import { ENGINES } from "./registry";
import type { TableRepository } from "./repository";
import { TableRoom, type TableRoomEmitter, type TableRoomOptions } from "./table-room";

/** Table rooms are short-lived: one evening of games. */
export const TABLE_ROOM_TTL_MS = 24 * 60 * 60_000;

export interface TableManagerOptions {
  repository: TableRepository;
  createEmitter: (roomId: string) => TableRoomEmitter;
  logger: FastifyBaseLogger;
  room?: Omit<TableRoomOptions, "now">;
  now?: () => number;
  tickMs?: number;
  saveIntervalMs?: number;
  idleUnloadMs?: number;
}

/** Keeps live table rooms in memory, drives their timers, persists them and unloads idle ones. */
export class TableRoomManager {
  private readonly rooms = new Map<string, TableRoom>();
  private readonly loading = new Map<string, Promise<TableRoom | null>>();
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly saveIntervalMs: number;
  private readonly idleUnloadMs: number;
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly opts: TableManagerOptions) {
    this.now = opts.now ?? Date.now;
    this.tickMs = opts.tickMs ?? 500;
    this.saveIntervalMs = opts.saveIntervalMs ?? 5_000;
    this.idleUnloadMs = opts.idleUnloadMs ?? 10 * 60_000;
  }

  start() {
    this.timers = [
      setInterval(() => this.tick(), this.tickMs),
      setInterval(() => void this.saveDirty(), this.saveIntervalMs),
      setInterval(() => void this.deleteExpired(), 60 * 60_000),
    ];
    void this.deleteExpired();
  }

  async stop() {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    await this.saveDirty();
  }

  /** `options` must already be validated by the engine's optionsSchema. */
  async create(clientId: string, kind: TableGameKind, options: unknown): Promise<string> {
    const room = await this.opts.repository.createRoom({
      id: randomId(8),
      kind,
      hostId: publicPlayerId(clientId),
      options,
      expiresAt: new Date(this.now() + TABLE_ROOM_TTL_MS),
    });
    return room.id;
  }

  /** The live room, loading it from storage on first access. */
  async get(roomId: string): Promise<TableRoom | null> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    let pending = this.loading.get(roomId);
    if (!pending) {
      pending = this.load(roomId).finally(() => this.loading.delete(roomId));
      this.loading.set(roomId, pending);
    }
    return pending;
  }

  /** Public numbers for link previews, without loading the room. */
  async peek(roomId: string) {
    const live = this.rooms.get(roomId);
    if (live) return live.summary;
    const record = await this.opts.repository.loadRoom(roomId);
    if (!record || record.expiresAt.getTime() <= this.now()) return null;
    return {
      id: record.id,
      kind: record.kind,
      status: record.status,
      players: record.members.filter((m) => !m.spectator).length,
      maxPlayers: TABLE_GAMES[record.kind]?.maxPlayers ?? 0,
    };
  }

  async save(room: TableRoom) {
    room.dirty = false;
    try {
      await this.opts.repository.saveRoom(room.id, room.persistable());
    } catch (error) {
      room.dirty = true;
      this.opts.logger.error({ err: error, roomId: room.id }, "failed to save table room");
    }
  }

  get activeRooms(): number {
    return this.rooms.size;
  }

  private async load(roomId: string): Promise<TableRoom | null> {
    const record = await this.opts.repository.loadRoom(roomId);
    if (!record || record.expiresAt.getTime() <= this.now()) return null;
    const engine = ENGINES[record.kind];
    if (!engine) return null;
    const room = new TableRoom(record, engine, this.opts.createEmitter(roomId), {
      ...this.opts.room,
      now: this.now,
    });
    this.rooms.set(roomId, room);
    this.opts.logger.info({ roomId, kind: record.kind }, "table room loaded");
    return room;
  }

  private tick() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      try {
        room.tick();
      } catch (error) {
        this.opts.logger.error({ err: error, roomId: room.id }, "table room tick failed");
      }
      if (room.connectedCount === 0 && now - room.lastActiveAt > this.idleUnloadMs) {
        this.rooms.delete(room.id);
        void this.save(room);
        this.opts.logger.info({ roomId: room.id }, "table room unloaded");
      }
    }
  }

  private async saveDirty() {
    await Promise.all([...this.rooms.values()].filter((r) => r.dirty).map((r) => this.save(r)));
  }

  private async deleteExpired() {
    try {
      const count = await this.opts.repository.deleteExpiredRooms(new Date(this.now()));
      if (count > 0) this.opts.logger.info({ count }, "expired table rooms deleted");
    } catch (error) {
      this.opts.logger.error({ err: error }, "failed to delete expired table rooms");
    }
  }
}
