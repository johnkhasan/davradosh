import {
  LOCK_TIMEOUT_MS,
  PuzzleState,
  SEAT_RESERVATION_MS,
  type DropPayload,
  type GrabAck,
  type JoinError,
  type JoinPayload,
  type MovePayload,
  type PlayerDTO,
  type PlayerStatsDTO,
  type RoomInfoDTO,
  type RoomStateDTO,
  type ServerToClientEvents,
} from "@puzzle/shared";
import type { RoomRecord, RoomStateUpdate } from "./repository";

type EventName = keyof ServerToClientEvents;
type EventArgs<E extends EventName> = Parameters<ServerToClientEvents[E]>;

/** How a Room talks to its sockets. Implemented with Socket.IO in production, a spy in tests. */
export interface RoomEmitter {
  /** Everyone in the room. */
  all<E extends EventName>(event: E, ...args: EventArgs<E>): void;
  /** Everyone except the given socket. `volatile` messages may be dropped under load. */
  others<E extends EventName>(
    socketId: string,
    volatile: boolean,
    event: E,
    ...args: EventArgs<E>
  ): void;
  /** One socket. */
  one<E extends EventName>(socketId: string, event: E, ...args: EventArgs<E>): void;
}

interface PlayerRecord {
  dto: PlayerDTO;
  socketId: string | null;
  disconnectedAt: number | null;
}

interface Lock {
  playerId: string;
  at: number;
}

export type JoinResult =
  | { ok: true; state: RoomStateDTO; replacedSocketId: string | null }
  | { ok: false; error: JoinError };

/**
 * One puzzle room: players, seats, group locks and the authoritative puzzle state.
 * Pure game logic: no sockets, no database, no timers (the manager drives `sweep`).
 */
export class Room {
  readonly id: string;
  readonly hostId: string;
  readonly info: RoomInfoDTO;
  readonly puzzle: PuzzleState;
  private readonly players = new Map<string, PlayerRecord>();
  private readonly locks = new Map<number, Lock>();
  private readonly stats: Record<string, PlayerStatsDTO>;
  private readonly now: () => number;
  /** Set whenever the puzzle changes; cleared by the manager after saving. */
  dirty = false;
  /** Last time a player was connected; used to unload idle rooms. */
  lastActiveAt: number;

  constructor(
    record: RoomRecord,
    private readonly emit: RoomEmitter,
    options: { now?: () => number } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.id = record.id;
    this.hostId = record.hostId;
    this.info = {
      id: record.id,
      cols: record.cols,
      rows: record.rows,
      seed: record.seed,
      rotation: record.rotation,
      maxPlayers: record.maxPlayers,
      image: record.image,
      status: record.status,
      createdAt: record.createdAt.getTime(),
      completedAt: record.completedAt?.getTime() ?? null,
    };
    const config = {
      cols: record.cols,
      rows: record.rows,
      pieceWidth: record.image.width / record.cols,
      pieceHeight: record.image.height / record.rows,
    };
    this.puzzle = record.state
      ? new PuzzleState(config, record.state)
      : PuzzleState.create(config, record.seed);
    this.stats = record.stats ?? {};
    this.lastActiveAt = this.now();
  }

  // ---------------------------------------------------------------- players

  get connectedCount(): number {
    let count = 0;
    for (const player of this.players.values()) if (player.dto.connected) count++;
    return count;
  }

  /** Connected players plus seats reserved for recently disconnected ones. */
  get occupiedSeats(): number {
    const now = this.now();
    let count = 0;
    for (const player of this.players.values()) {
      if (
        player.dto.connected ||
        (player.disconnectedAt !== null && now - player.disconnectedAt < SEAT_RESERVATION_MS)
      ) {
        count++;
      }
    }
    return count;
  }

  join(payload: JoinPayload, socketId: string): JoinResult {
    const existing = this.players.get(payload.clientId);
    if (existing) {
      const replacedSocketId = existing.dto.connected ? existing.socketId : null;
      existing.socketId = socketId;
      existing.disconnectedAt = null;
      existing.dto = {
        ...existing.dto,
        name: this.uniqueName(payload.name, payload.clientId),
        color: payload.color,
        avatar: payload.avatar,
        connected: true,
      };
      this.lastActiveAt = this.now();
      this.emit.others(socketId, false, "player:updated", existing.dto);
      return { ok: true, state: this.stateFor(payload.clientId), replacedSocketId };
    }

    if (this.occupiedSeats >= this.info.maxPlayers) return { ok: false, error: "full" };

    const player: PlayerRecord = {
      socketId,
      disconnectedAt: null,
      dto: {
        id: payload.clientId,
        name: this.uniqueName(payload.name, payload.clientId),
        color: payload.color,
        avatar: payload.avatar,
        connected: true,
        isHost: payload.clientId === this.hostId,
      },
    };
    this.players.set(payload.clientId, player);
    this.stats[payload.clientId] ??= { merges: 0 };
    this.lastActiveAt = this.now();
    this.emit.others(socketId, false, "player:joined", player.dto);
    return { ok: true, state: this.stateFor(payload.clientId), replacedSocketId: null };
  }

  /** Socket closed. The seat stays reserved for SEAT_RESERVATION_MS. */
  disconnect(playerId: string, socketId: string) {
    const player = this.players.get(playerId);
    if (!player || player.socketId !== socketId) return;
    player.socketId = null;
    player.disconnectedAt = this.now();
    player.dto = { ...player.dto, connected: false };
    this.releaseLocksOf(playerId);
    this.lastActiveAt = this.now();
    this.emit.all("player:updated", player.dto);
  }

  isCurrentSocket(playerId: string, socketId: string): boolean {
    return this.players.get(playerId)?.socketId === socketId;
  }

  private uniqueName(requested: string, clientId: string): string {
    const taken = new Set(
      [...this.players.values()]
        .filter((p) => p.dto.id !== clientId)
        .map((p) => p.dto.name.toLowerCase()),
    );
    if (!taken.has(requested.toLowerCase())) return requested;
    for (let n = 2; ; n++) {
      const candidate = `${requested.slice(0, 17)} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  // ---------------------------------------------------------------- cursors & pieces

  cursor(playerId: string, socketId: string, x: number, y: number) {
    this.emit.others(socketId, true, "cursor", playerId, x, y);
  }

  grab(playerId: string, socketId: string, groupId: number): GrabAck {
    const group = this.puzzle.getGroup(groupId);
    if (!group || group.placed || this.info.status === "COMPLETED") return { ok: false };
    const lock = this.locks.get(groupId);
    const now = this.now();
    if (lock && lock.playerId !== playerId && now - lock.at < LOCK_TIMEOUT_MS) {
      return { ok: false, heldBy: lock.playerId };
    }
    // A player drags one group at a time.
    this.releaseLocksOf(playerId, groupId);
    this.locks.set(groupId, { playerId, at: now });
    if (lock?.playerId !== playerId)
      this.emit.others(socketId, false, "piece:grabbed", groupId, playerId);
    return { ok: true };
  }

  move(playerId: string, socketId: string, { groupId, x, y }: MovePayload) {
    const lock = this.locks.get(groupId);
    if (!lock || lock.playerId !== playerId) return;
    if (!this.puzzle.moveGroup(groupId, x, y)) return;
    lock.at = this.now();
    this.dirty = true;
    this.emit.others(socketId, true, "piece:moved", groupId, x, y);
  }

  drop(playerId: string, socketId: string, { groupId, x, y }: DropPayload) {
    const lock = this.locks.get(groupId);
    const group = this.puzzle.getGroup(groupId);

    if (!lock || lock.playerId !== playerId || !group) {
      // Stale drop (lock expired or group merged meanwhile): tell the sender where things really are.
      if (group) this.emit.one(socketId, "piece:dropped", groupId, group.x, group.y, playerId);
      return;
    }

    this.locks.delete(groupId);
    this.puzzle.moveGroup(groupId, x, y);
    const result = this.puzzle.snap(groupId, (id) => {
      const other = this.locks.get(id);
      return !other || other.playerId === playerId;
    });
    this.dirty = true;

    if (!result) {
      this.emit.all("piece:dropped", groupId, x, y, playerId);
      return;
    }

    for (const absorbed of result.absorbed) this.locks.delete(absorbed);
    this.locks.delete(result.groupId);
    if (result.absorbed.length > 0) {
      const stats = (this.stats[playerId] ??= { merges: 0 });
      stats.merges += result.absorbed.length;
    }
    this.emit.all("piece:snapped", { ...result, playerId });

    if (this.puzzle.isComplete() && this.info.status !== "COMPLETED") {
      this.info.status = "COMPLETED";
      this.info.completedAt = this.now();
      this.emit.all("puzzle:completed", {
        durationMs: this.info.completedAt - this.info.createdAt,
        stats: this.stats,
      });
    }
  }

  arrange() {
    if (this.info.status === "COMPLETED") return;
    const moved = this.puzzle.arrange({
      edgesFirst: true,
      seed: this.info.seed,
      exclude: new Set(this.locks.keys()),
    });
    if (moved.length === 0) return;
    this.dirty = true;
    this.emit.all(
      "groups:moved",
      moved.map((id) => {
        const group = this.puzzle.getGroup(id)!;
        return { id, x: group.x, y: group.y };
      }),
    );
  }

  // ---------------------------------------------------------------- housekeeping

  /** Expires stale locks and frees seats of players who did not come back. */
  sweep() {
    const now = this.now();
    for (const [groupId, lock] of this.locks) {
      if (now - lock.at >= LOCK_TIMEOUT_MS) {
        this.locks.delete(groupId);
        this.emit.all("piece:released", groupId);
      }
    }
    for (const [playerId, player] of this.players) {
      if (
        !player.dto.connected &&
        player.disconnectedAt !== null &&
        now - player.disconnectedAt >= SEAT_RESERVATION_MS
      ) {
        this.players.delete(playerId);
        this.emit.all("player:left", playerId);
      }
    }
    if (this.connectedCount > 0) this.lastActiveAt = now;
  }

  private releaseLocksOf(playerId: string, except?: number) {
    for (const [groupId, lock] of this.locks) {
      if (lock.playerId === playerId && groupId !== except) {
        this.locks.delete(groupId);
        this.emit.all("piece:released", groupId);
      }
    }
  }

  stateFor(playerId: string): RoomStateDTO {
    const locks: Record<number, string> = {};
    for (const [groupId, lock] of this.locks) locks[groupId] = lock.playerId;
    return {
      room: { ...this.info },
      puzzle: this.puzzle.snapshot(),
      locks,
      players: [...this.players.values()].map((p) => p.dto),
      stats: structuredClone(this.stats),
      you: playerId,
    };
  }

  persistable(): RoomStateUpdate {
    return {
      state: this.puzzle.snapshot(),
      stats: structuredClone(this.stats),
      status: this.info.status,
      completedAt: this.info.completedAt ? new Date(this.info.completedAt) : null,
    };
  }
}
