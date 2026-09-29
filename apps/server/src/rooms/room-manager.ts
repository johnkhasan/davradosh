import { randomInt } from "node:crypto";
import { gridForPieceCount, PuzzleState, ROOM_TTL_MS, type CreateRoomSchema } from "@puzzle/shared";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";
import { randomId } from "../lib/ids";
import type { RoomRepository } from "./repository";
import { Room, type RoomEmitter } from "./room";

export interface RoomManagerOptions {
  repository: RoomRepository;
  createEmitter: (roomId: string) => RoomEmitter;
  logger: FastifyBaseLogger;
  maxPlayersPerRoom: number;
  /** Periodic persistence of changed rooms. */
  saveIntervalMs?: number;
  /** Rooms without connected players are unloaded after this long. */
  idleUnloadMs?: number;
}

/**
 * Keeps active rooms in memory, loads them lazily from the repository,
 * persists changes periodically and unloads idle rooms.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly loading = new Map<string, Promise<Room | null>>();
  private readonly opts: Required<RoomManagerOptions>;
  private sweepTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: RoomManagerOptions) {
    this.opts = { saveIntervalMs: 10_000, idleUnloadMs: 10 * 60_000, ...options };
  }

  start() {
    this.sweepTimer = setInterval(() => this.sweep(), 1_000);
    this.saveTimer = setInterval(() => void this.saveDirty(), this.opts.saveIntervalMs);
    this.cleanupTimer = setInterval(() => void this.deleteExpired(), 60 * 60_000);
    void this.deleteExpired();
  }

  /** Rooms live for ROOM_TTL_MS (7 days). */
  async deleteExpired() {
    try {
      const count = await this.opts.repository.deleteExpiredRooms(new Date());
      if (count > 0) this.opts.logger.info({ count }, "expired rooms deleted");
    } catch (error) {
      this.opts.logger.error({ err: error }, "failed to delete expired rooms");
    }
  }

  async stop() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    if (this.saveTimer) clearInterval(this.saveTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.saveDirty();
  }

  async create(input: z.output<typeof CreateRoomSchema>) {
    const image = await this.opts.repository.getImage(input.imageId);
    if (!image) return null;
    const { cols, rows } = gridForPieceCount(input.pieces, image.width / image.height);
    // Postgres INTEGER is signed 32-bit.
    const seed = randomInt(0, 2 ** 31 - 1);
    const puzzle = PuzzleState.create(
      { cols, rows, pieceWidth: image.width / cols, pieceHeight: image.height / rows },
      seed,
    );
    const record = await this.opts.repository.createRoom({
      id: randomId(8),
      hostId: input.clientId,
      imageId: image.id,
      cols,
      rows,
      seed,
      rotation: input.rotation,
      maxPlayers: Math.min(input.maxPlayers, this.opts.maxPlayersPerRoom),
      state: puzzle.snapshot(),
      expiresAt: new Date(Date.now() + ROOM_TTL_MS),
    });
    return record;
  }

  /** Returns the in-memory room, loading it from storage on first access. */
  async get(roomId: string): Promise<Room | null> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    let pending = this.loading.get(roomId);
    if (!pending) {
      pending = this.load(roomId).finally(() => this.loading.delete(roomId));
      this.loading.set(roomId, pending);
    }
    return pending;
  }

  /** The room if it is currently live in memory (players connected recently). */
  getLoaded(roomId: string): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  /** Room info for link previews, without loading the room into memory. */
  async peek(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) return { info: room.info, players: room.occupiedSeats };
    const record = await this.opts.repository.loadRoom(roomId);
    if (!record || record.expiresAt.getTime() <= Date.now()) return null;
    const loaded = new Room(record, this.opts.createEmitter(roomId));
    return { info: loaded.info, players: 0 };
  }

  /** Saves a room soon (used after merges so progress survives a crash). */
  async save(room: Room) {
    room.dirty = false;
    try {
      await this.opts.repository.saveRoomState(room.id, room.persistable());
    } catch (error) {
      room.dirty = true;
      this.opts.logger.error({ err: error, roomId: room.id }, "failed to save room");
    }
  }

  get activeRooms(): number {
    return this.rooms.size;
  }

  private async load(roomId: string): Promise<Room | null> {
    const record = await this.opts.repository.loadRoom(roomId);
    if (!record || record.expiresAt.getTime() <= Date.now()) return null;
    const room = new Room(record, this.opts.createEmitter(roomId));
    this.rooms.set(roomId, room);
    this.opts.logger.info({ roomId }, "room loaded");
    return room;
  }

  private sweep() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      room.sweep();
      if (room.connectedCount === 0 && now - room.lastActiveAt > this.opts.idleUnloadMs) {
        this.rooms.delete(room.id);
        void this.save(room);
        this.opts.logger.info({ roomId: room.id }, "room unloaded");
      }
    }
  }

  private async saveDirty() {
    await Promise.all([...this.rooms.values()].filter((r) => r.dirty).map((r) => this.save(r)));
  }
}
