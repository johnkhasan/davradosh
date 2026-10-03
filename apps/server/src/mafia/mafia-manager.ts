import { MAFIA_PLAYERS } from "@puzzle/shared/mafia";
import type { FastifyBaseLogger } from "fastify";
import { publicPlayerId, randomCode, randomId } from "../lib/ids";
import { RoomCodeTakenError } from "../rooms/repository";
import type { MafiaGameOptions } from "./game";
import { MafiaRoom, type MafiaRoomEmitter, type MafiaRoomOptions } from "./mafia-room";
import type { MafiaRepository } from "./repository";
import type { MafiaVoiceSync } from "./voice-sync";

/** Mafia rooms are short-lived: one evening of games. */
export const MAFIA_ROOM_TTL_MS = 24 * 60 * 60_000;

export interface MafiaManagerOptions {
  repository: MafiaRepository;
  createEmitter: (roomId: string) => MafiaRoomEmitter;
  logger: FastifyBaseLogger;
  /** Shorter phase lengths in tests. */
  game?: MafiaGameOptions;
  room?: Omit<MafiaRoomOptions, "game" | "now">;
  /** Applies the voice policy to LiveKit; absent when voice is not configured. */
  voice?: MafiaVoiceSync | null;
  /** Whether a join code is in use elsewhere (puzzle rooms share the codes). */
  codeTaken?: (code: string) => Promise<boolean>;
  now?: () => number;
  /** How often phase timers are checked. */
  tickMs?: number;
  saveIntervalMs?: number;
  idleUnloadMs?: number;
}

/**
 * Keeps live mafia rooms in memory, drives their timers, persists them and unloads
 * idle ones. Same shape as the puzzle RoomManager, but mafia phases need a faster tick.
 */
export class MafiaRoomManager {
  private readonly rooms = new Map<string, MafiaRoom>();
  private readonly loading = new Map<string, Promise<MafiaRoom | null>>();
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly saveIntervalMs: number;
  private readonly idleUnloadMs: number;
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly opts: MafiaManagerOptions) {
    this.now = opts.now ?? Date.now;
    this.tickMs = opts.tickMs ?? 250;
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

  async create(
    clientId: string,
    tableSize: number = MAFIA_PLAYERS,
  ): Promise<{ id: string; code: string | null }> {
    const room = {
      id: randomId(8),
      hostId: publicPlayerId(clientId),
      tableSize,
      expiresAt: new Date(this.now() + MAFIA_ROOM_TTL_MS),
    };
    // Only 10 000 codes exist: after a few collisions the room goes without one (link only).
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = randomCode();
      if (await this.opts.codeTaken?.(code)) continue;
      try {
        await this.opts.repository.createRoom({ ...room, code });
        return { id: room.id, code };
      } catch (error) {
        if (!(error instanceof RoomCodeTakenError)) throw error;
      }
    }
    this.opts.logger.warn("no free room code, creating a mafia room without one");
    await this.opts.repository.createRoom({ ...room, code: null });
    return { id: room.id, code: null };
  }

  /** Room id for a 4-digit join code. */
  findByCode(code: string): Promise<string | null> {
    return this.opts.repository.findRoomIdByCode(code, new Date(this.now()));
  }

  /** The live room, loading it from storage on first access. */
  async get(roomId: string): Promise<MafiaRoom | null> {
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
    const players = record.members.filter((m) => !m.spectator).length;
    return {
      id: record.id,
      code: record.code ?? null,
      status: record.status,
      tableSize: record.tableSize,
      players,
      spectators: record.members.length - players,
    };
  }

  async save(room: MafiaRoom) {
    room.dirty = false;
    try {
      await this.opts.repository.saveRoom(room.id, room.persistable());
    } catch (error) {
      room.dirty = true;
      this.opts.logger.error({ err: error, roomId: room.id }, "failed to save mafia room");
    }
  }

  get activeRooms(): number {
    return this.rooms.size;
  }

  private async load(roomId: string): Promise<MafiaRoom | null> {
    const record = await this.opts.repository.loadRoom(roomId);
    if (!record || record.expiresAt.getTime() <= this.now()) return null;
    const room = new MafiaRoom(record, this.opts.createEmitter(roomId), {
      ...this.opts.room,
      game: this.opts.game,
      now: this.now,
    });
    this.rooms.set(roomId, room);
    this.opts.logger.info({ roomId }, "mafia room loaded");
    return room;
  }

  private tick() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      try {
        room.tick();
      } catch (error) {
        this.opts.logger.error({ err: error, roomId: room.id }, "mafia room tick failed");
      }
      this.opts.voice?.sync(room);
      if (room.connectedCount === 0 && now - room.lastActiveAt > this.idleUnloadMs) {
        this.rooms.delete(room.id);
        this.opts.voice?.forget(room.id);
        void this.save(room);
        this.opts.logger.info({ roomId: room.id }, "mafia room unloaded");
      }
    }
  }

  private async saveDirty() {
    await Promise.all([...this.rooms.values()].filter((r) => r.dirty).map((r) => this.save(r)));
  }

  private async deleteExpired() {
    try {
      const count = await this.opts.repository.deleteExpiredRooms(new Date(this.now()));
      if (count > 0) this.opts.logger.info({ count }, "expired mafia rooms deleted");
    } catch (error) {
      this.opts.logger.error({ err: error }, "failed to delete expired mafia rooms");
    }
  }
}
