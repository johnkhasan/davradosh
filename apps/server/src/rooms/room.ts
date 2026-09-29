import {
  CHAT_HISTORY_SIZE,
  LOCK_TIMEOUT_MS,
  MAX_VIEWERS_PER_ROOM,
  PuzzleState,
  SEAT_RESERVATION_MS,
  type ActionAck,
  type ChatMessageDTO,
  type DropPayload,
  type GrabAck,
  type JoinError,
  type JoinPayload,
  type MovePayload,
  type PlayerDTO,
  type PlayerRole,
  type PlayerStatsDTO,
  type ReactionPayload,
  type RoomInfoDTO,
  type RoomStateDTO,
  type ServerToClientEvents,
  type ViewportPayload,
} from "@puzzle/shared";
import { publicPlayerId } from "../lib/ids";
import type { RoomRecord, RoomStateUpdate } from "./repository";

type EventName = keyof ServerToClientEvents;
type EventArgs<E extends EventName> = Parameters<ServerToClientEvents[E]>;

/** How a Room talks to its sockets. Implemented with Socket.IO in production, a spy in tests. */
export interface RoomEmitter {
  /** Everyone in the room. */
  all<E extends EventName>(event: E, ...args: EventArgs<E>): void;
  /** Everyone except the given socket. */
  others<E extends EventName>(socketId: string, event: E, ...args: EventArgs<E>): void;
  /** One socket. */
  one<E extends EventName>(socketId: string, event: E, ...args: EventArgs<E>): void;
}

interface PlayerRecord {
  dto: PlayerDTO;
  socketId: string | null;
  disconnectedAt: number | null;
  /** When they entered the room (the longest-present player inherits the host role). */
  joinedAt: number;
}

interface Lock {
  playerId: string;
  at: number;
}

export type JoinResult =
  | { ok: true; state: RoomStateDTO; replacedSocketId: string | null }
  | { ok: false; error: JoinError };

export type KickResult = ActionAck & { socketId?: string | null };

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
  private stats: Record<string, PlayerStatsDTO>;
  private readonly banned: Set<string>;
  /** Recent chat, kept in memory only (a chat is about the current session). */
  private readonly chatLog: ChatMessageDTO[] = [];
  private chatSeq = 0;
  /** Public id of the current host (starts as the creator; moves only when the host hands it over). */
  private hostPlayerId: string;
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
      code: record.code,
      cols: record.cols,
      rows: record.rows,
      seed: record.seed,
      rotation: record.rotation,
      maxPlayers: record.maxPlayers,
      image: record.image,
      status: record.status,
      createdAt: record.createdAt.getTime(),
      startedAt: record.startedAt.getTime(),
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
    this.banned = new Set(record.banned);
    this.hostPlayerId = record.hostPlayerId ?? publicPlayerId(record.hostId);
    this.lastActiveAt = this.now();
  }

  // ---------------------------------------------------------------- players

  get connectedCount(): number {
    let count = 0;
    for (const player of this.players.values()) if (player.dto.connected) count++;
    return count;
  }

  /** Seated players (connected or with a reserved seat). Viewers take no seat. */
  get occupiedSeats(): number {
    const now = this.now();
    let count = 0;
    for (const player of this.players.values()) {
      if (player.dto.role !== "player") continue;
      if (
        player.dto.connected ||
        (player.disconnectedAt !== null && now - player.disconnectedAt < SEAT_RESERVATION_MS)
      ) {
        count++;
      }
    }
    return count;
  }

  get viewerCount(): number {
    let count = 0;
    for (const player of this.players.values()) if (player.dto.role === "viewer") count++;
    return count;
  }

  private get hasFreeSeat(): boolean {
    return this.occupiedSeats < this.info.maxPlayers;
  }

  join(payload: JoinPayload, socketId: string): JoinResult {
    const playerId = publicPlayerId(payload.clientId);
    if (this.banned.has(playerId)) return { ok: false, error: "banned" };
    const existing = this.players.get(playerId);
    if (existing) {
      // A returning player keeps their seat; asking to watch gives it up.
      if (payload.role === "viewer" && existing.dto.role === "player") {
        this.releaseLocksOf(playerId);
        existing.dto = { ...existing.dto, role: "viewer" };
      }
      const replacedSocketId = existing.dto.connected ? existing.socketId : null;
      existing.socketId = socketId;
      existing.disconnectedAt = null;
      existing.dto = {
        ...existing.dto,
        name: this.uniqueName(payload.name, playerId),
        color: payload.color,
        avatar: payload.avatar,
        connected: true,
      };
      this.lastActiveAt = this.now();
      this.emit.others(socketId, "player:updated", existing.dto);
      return { ok: true, state: this.stateFor(playerId), replacedSocketId };
    }

    // A full room still lets people in, as viewers.
    const role: PlayerRole = payload.role === "player" && this.hasFreeSeat ? "player" : "viewer";
    if (role === "viewer" && this.viewerCount >= MAX_VIEWERS_PER_ROOM)
      return { ok: false, error: "full" };

    const player: PlayerRecord = {
      socketId,
      disconnectedAt: null,
      joinedAt: this.now(),
      dto: {
        id: playerId,
        name: this.uniqueName(payload.name, playerId),
        color: payload.color,
        avatar: payload.avatar,
        connected: true,
        isHost: playerId === this.hostPlayerId,
        role,
      },
    };
    this.players.set(playerId, player);
    if (role === "player") this.stats[playerId] ??= { merges: 0 };
    this.lastActiveAt = this.now();
    this.emit.others(socketId, "player:joined", player.dto);
    return { ok: true, state: this.stateFor(playerId), replacedSocketId: null };
  }

  /** Socket closed. A player's seat stays reserved for SEAT_RESERVATION_MS; viewers just leave. */
  disconnect(playerId: string, socketId: string) {
    const player = this.players.get(playerId);
    if (!player || player.socketId !== socketId) return;
    if (player.dto.role === "viewer" && !player.dto.isHost) {
      this.players.delete(playerId);
      this.lastActiveAt = this.now();
      this.emit.all("player:left", playerId);
      return;
    }
    player.socketId = null;
    player.disconnectedAt = this.now();
    player.dto = { ...player.dto, connected: false };
    this.releaseLocksOf(playerId);
    this.lastActiveAt = this.now();
    this.emit.all("player:updated", player.dto);
  }

  player(playerId: string): PlayerDTO | undefined {
    return this.players.get(playerId)?.dto;
  }

  isCurrentSocket(playerId: string, socketId: string): boolean {
    return this.players.get(playerId)?.socketId === socketId;
  }

  private isPlaying(playerId: string): boolean {
    return this.players.get(playerId)?.dto.role === "player";
  }

  // ---------------------------------------------------------------- seats

  /** A viewer takes a free seat. */
  claimSeat(playerId: string): ActionAck {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: "not_found" };
    if (player.dto.role === "player") return { ok: true };
    if (!this.hasFreeSeat) return { ok: false, error: "full" };
    this.setRoleOf(player, "player");
    return { ok: true };
  }

  /** A player gives their seat away and keeps watching. */
  leaveSeat(playerId: string): ActionAck {
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: "not_found" };
    if (player.dto.role === "player") this.setRoleOf(player, "viewer");
    return { ok: true };
  }

  private setRoleOf(player: PlayerRecord, role: PlayerRole) {
    if (role === "viewer") this.releaseLocksOf(player.dto.id);
    else this.stats[player.dto.id] ??= { merges: 0 };
    player.dto = { ...player.dto, role };
    this.emit.all("player:updated", player.dto);
  }

  // ---------------------------------------------------------------- host actions

  private isHostPlayer(playerId: string): boolean {
    return this.players.get(playerId)?.dto.isHost === true;
  }

  /**
   * Removes a player (or viewer). With `ban` they cannot come back to this room.
   * Returns the kicked socket so the transport can disconnect it.
   */
  kick(hostId: string, targetId: string, ban: boolean): KickResult {
    if (!this.isHostPlayer(hostId)) return { ok: false, error: "not_host" };
    if (targetId === hostId) return { ok: false, error: "invalid" };
    const target = this.players.get(targetId);
    if (!target) return { ok: false, error: "not_found" };
    this.releaseLocksOf(targetId);
    this.players.delete(targetId);
    if (ban) {
      this.banned.add(targetId);
      this.dirty = true;
    }
    if (target.socketId) this.emit.one(target.socketId, "kicked", "host");
    this.emit.all("player:left", targetId);
    return { ok: true, socketId: target.socketId };
  }

  /** Moves someone between players and viewers (e.g. to free a seat for a friend). */
  setRole(hostId: string, targetId: string, role: PlayerRole): ActionAck {
    if (!this.isHostPlayer(hostId)) return { ok: false, error: "not_host" };
    const target = this.players.get(targetId);
    if (!target) return { ok: false, error: "not_found" };
    if (target.dto.role === role) return { ok: true };
    if (role === "player" && !this.hasFreeSeat) return { ok: false, error: "full" };
    this.setRoleOf(target, role);
    return { ok: true };
  }

  /** The host hands their role to another connected player. */
  transferHost(hostId: string, targetId: string): ActionAck {
    if (!this.isHostPlayer(hostId)) return { ok: false, error: "not_host" };
    if (targetId === hostId) return { ok: false, error: "invalid" };
    const target = this.players.get(targetId);
    if (!target?.dto.connected) return { ok: false, error: "not_found" };
    this.setHost(targetId);
    return { ok: true };
  }

  private setHost(playerId: string) {
    const previous = this.players.get(this.hostPlayerId);
    if (previous) {
      previous.dto = { ...previous.dto, isHost: false };
      this.emit.all("player:updated", previous.dto);
    }
    this.hostPlayerId = playerId;
    const next = this.players.get(playerId);
    if (next) {
      next.dto = { ...next.dto, isHost: true };
      this.emit.all("player:updated", next.dto);
    }
    this.dirty = true;
  }

  /** Scrambles the puzzle again (same picture and piece shapes), clears the timer and stats. */
  restart(hostId: string, scatterSeed = Math.floor(Math.random() * 2 ** 31)): ActionAck {
    if (!this.isHostPlayer(hostId)) return { ok: false, error: "not_host" };
    const fresh = PuzzleState.create(this.puzzle.config, this.info.seed, scatterSeed);
    this.puzzle.replaceWith(fresh.snapshot());
    this.locks.clear();
    this.stats = {};
    for (const player of this.players.values()) {
      if (player.dto.role === "player") this.stats[player.dto.id] = { merges: 0 };
    }
    this.info.status = "PLAYING";
    this.info.completedAt = null;
    this.info.startedAt = this.now();
    this.dirty = true;
    this.emit.all("puzzle:reset");
    return { ok: true };
  }

  private uniqueName(requested: string, playerId: string): string {
    const taken = new Set(
      [...this.players.values()]
        .filter((p) => p.dto.id !== playerId)
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
    // Viewers watch quietly: their cursors are not shown to anyone.
    if (!this.isPlaying(playerId)) return;
    this.emit.others(socketId, "cursor", playerId, x, y);
  }

  /** Adds a (already validated) chat message; players and viewers may both write. */
  chat(playerId: string, text: string): ChatMessageDTO | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    const message: ChatMessageDTO = {
      id: `${this.now().toString(36)}-${(this.chatSeq++).toString(36)}`,
      playerId,
      name: player.dto.name,
      color: player.dto.color,
      text,
      at: this.now(),
    };
    this.chatLog.push(message);
    if (this.chatLog.length > CHAT_HISTORY_SIZE)
      this.chatLog.splice(0, this.chatLog.length - CHAT_HISTORY_SIZE);
    this.emit.all("chat:message", message);
    return message;
  }

  reaction(playerId: string, socketId: string, { emoji, x, y }: ReactionPayload) {
    this.emit.others(socketId, "reaction", playerId, emoji, x, y);
  }

  viewport(playerId: string, socketId: string, rect: ViewportPayload) {
    this.emit.others(socketId, "viewport", playerId, rect);
  }

  grab(playerId: string, socketId: string, groupId: number): GrabAck {
    if (!this.isPlaying(playerId)) return { ok: false };
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
    if (lock?.playerId !== playerId) this.emit.others(socketId, "piece:grabbed", groupId, playerId);
    return { ok: true };
  }

  move(playerId: string, socketId: string, { groupId, x, y }: MovePayload) {
    const lock = this.locks.get(groupId);
    if (!lock || lock.playerId !== playerId) return;
    if (!this.puzzle.moveGroup(groupId, x, y)) return;
    lock.at = this.now();
    this.dirty = true;
    this.emit.others(socketId, "piece:moved", groupId, x, y);
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
        durationMs: this.info.completedAt - this.info.startedAt,
        stats: this.stats,
      });
    }
  }

  /** Host only: it moves everyone's loose pieces, so one player must not undo others' sorting. */
  arrange(playerId: string) {
    if (this.info.status === "COMPLETED" || !this.isHostPlayer(playerId)) return;
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
      chat: [...this.chatLog],
      you: playerId,
    };
  }

  persistable(): RoomStateUpdate {
    return {
      state: this.puzzle.snapshot(),
      stats: structuredClone(this.stats),
      status: this.info.status,
      startedAt: new Date(this.info.startedAt),
      completedAt: this.info.completedAt ? new Date(this.info.completedAt) : null,
      banned: [...this.banned],
      hostPlayerId: this.hostPlayerId,
    };
  }
}
