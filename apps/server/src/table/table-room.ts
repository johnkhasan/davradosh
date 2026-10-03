import {
  TABLE_CHAT_KEEP,
  TABLE_GAMES,
  type AnyGameEngine,
  type EngineContext,
  type TableChatMessage,
  type TableGameKind,
  type TableJoinPayload,
  type TableMemberDTO,
  type TableResult,
  type TableRoomStateDTO,
  type TableRoomStatus,
} from "@puzzle/shared/games";
import { publicPlayerId } from "../lib/ids";
import type {
  TableGameRecord,
  TableMemberRecord,
  TableRoomRecord,
  TableRoomUpdate,
} from "./repository";

/** How the room talks to sockets. Each person only ever gets their own state. */
export interface TableRoomEmitter {
  state(socketId: string, state: TableRoomStateDTO): void;
}

/** A player who dropped out mid-game keeps the seat this long, then leaves the game. */
export const TABLE_RECONNECT_MS = 120_000;
/** A member who dropped out of the lobby is removed after this long. */
export const TABLE_LOBBY_GRACE_MS = 30_000;

export interface TableRoomOptions {
  now?: () => number;
  random?: () => number;
  reconnectMs?: number;
  lobbyGraceMs?: number;
}

interface Member extends TableMemberRecord {
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
}

export type TableJoinResult =
  | { ok: true; state: TableRoomStateDTO; replacedSocketId: string | null }
  | { ok: false; error: "banned" };

/**
 * One room of a table game: the lobby (seats plus spectators), the game in progress, the chat
 * and the connections. The rules live in the engine; this class only routes people to it.
 */
export class TableRoom {
  readonly id: string;
  readonly kind: TableGameKind;
  readonly options: unknown;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  private hostId: string;
  private status: TableRoomStatus;
  private round: number;
  private readonly members = new Map<string, Member>();
  private readonly banned: Set<string>;
  private game: TableGameRecord | null;
  private readonly chat: TableChatMessage[] = [];
  private chatId = 0;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly reconnectMs: number;
  private readonly lobbyGraceMs: number;
  dirty = false;
  lastActiveAt: number;

  constructor(
    record: TableRoomRecord,
    private readonly engine: AnyGameEngine,
    private readonly emitter: TableRoomEmitter,
    options: TableRoomOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.reconnectMs = options.reconnectMs ?? TABLE_RECONNECT_MS;
    this.lobbyGraceMs = options.lobbyGraceMs ?? TABLE_LOBBY_GRACE_MS;
    const now = this.now();
    const info = TABLE_GAMES[record.kind];
    this.id = record.id;
    this.kind = record.kind;
    this.options = record.options;
    this.minPlayers = info.minPlayers;
    this.maxPlayers = info.maxPlayers;
    this.hostId = record.hostId;
    this.status = record.status;
    this.round = record.round;
    this.banned = new Set(record.banned);
    this.game = record.game;
    // After a restart nobody is connected yet: everyone gets the usual grace period to come back.
    for (const member of record.members) {
      this.members.set(member.id, {
        ...member,
        socketId: null,
        connected: false,
        disconnectedAt: now,
      });
    }
    if (this.status === "playing" && !this.game) this.status = "lobby";
    this.lastActiveAt = now;
  }

  private ctx(): EngineContext {
    return { now: this.now(), random: this.random };
  }

  // ---------------------------------------------------------------- people

  get connectedCount(): number {
    let count = 0;
    for (const member of this.members.values()) if (member.connected) count++;
    return count;
  }

  /** Members with a seat at the (next) table, in join order. */
  private seated(): Member[] {
    return [...this.members.values()]
      .filter((m) => !m.spectator)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }

  isCurrentSocket(playerId: string, socketId: string): boolean {
    return this.members.get(playerId)?.socketId === socketId;
  }

  join(payload: TableJoinPayload, socketId: string): TableJoinResult {
    const id = publicPlayerId(payload.clientId);
    if (this.banned.has(id)) return { ok: false, error: "banned" };
    const now = this.now();
    let member = this.members.get(id);
    let replacedSocketId: string | null = null;

    if (member) {
      replacedSocketId = member.socketId;
      if (this.status === "lobby") {
        member.name = this.uniqueName(payload.name, id);
        member.color = payload.color;
        member.avatar = payload.avatar;
      }
    } else {
      member = {
        id,
        name: this.uniqueName(payload.name, id),
        color: payload.color,
        avatar: payload.avatar,
        ready: false,
        // Late comers watch: during a game, or when every seat is taken.
        spectator: this.status === "playing" || this.seated().length >= this.maxPlayers,
        joinedAt: now,
        wins: 0,
        socketId: null,
        connected: false,
        disconnectedAt: null,
      };
      this.members.set(id, member);
    }
    member.socketId = socketId;
    member.connected = true;
    member.disconnectedAt = null;
    if (!this.members.has(this.hostId)) this.hostId = id;
    this.touch(now);
    this.broadcast();
    return { ok: true, state: this.stateFor(id), replacedSocketId };
  }

  disconnect(playerId: string, socketId: string) {
    const member = this.members.get(playerId);
    if (!member || member.socketId !== socketId) return;
    member.socketId = null;
    member.connected = false;
    member.disconnectedAt = this.now();
    this.broadcast();
  }

  /** Suffixes a number when someone else in the room already uses the name. */
  private uniqueName(name: string, id: string): string {
    const taken = new Set(
      [...this.members.values()].filter((m) => m.id !== id).map((m) => m.name.toLowerCase()),
    );
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; ; n++) {
      const candidate = `${name} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  // ---------------------------------------------------------------- lobby

  setReady(playerId: string, ready: boolean): TableResult {
    const member = this.members.get(playerId);
    if (!member || member.spectator) return { ok: false, error: "invalid" };
    if (this.status !== "lobby") return { ok: false, error: "wrong_status" };
    member.ready = ready;
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  /** Host only, with enough connected players who are all ready (the host counts as ready). */
  start(playerId: string): TableResult {
    if (playerId !== this.hostId) return { ok: false, error: "not_host" };
    if (this.status !== "lobby") return { ok: false, error: "wrong_status" };
    const seated = this.seated();
    const ready = seated.every((m) => m.connected && (m.ready || m.id === this.hostId));
    if (seated.length < this.minPlayers || !ready) return { ok: false, error: "not_ready" };
    // Rematches rotate the seats: the other player gets white / the first move.
    const shift = this.round % seated.length;
    const order = [...seated.slice(shift), ...seated.slice(0, shift)];
    const ctx = this.ctx();
    this.game = {
      seats: order.map((m) => m.id),
      names: order.map((m) => m.name),
      left: [],
      state: this.engine.setup(order.length, this.options, ctx),
      startedAt: ctx.now,
      result: null,
    };
    this.round++;
    this.status = "playing";
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  /** After a finished game: back to the lobby with the same people. */
  rematch(playerId: string): TableResult {
    if (playerId !== this.hostId) return { ok: false, error: "not_host" };
    if (this.status !== "playing" || !this.game?.result)
      return { ok: false, error: "wrong_status" };
    this.game = null;
    this.status = "lobby";
    for (const member of this.members.values()) member.ready = false;
    this.fillSeats();
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  /** Spectators move up to free seats, connected ones first. */
  private fillSeats() {
    if (this.status !== "lobby") return;
    const waiting = [...this.members.values()]
      .filter((m) => m.spectator)
      .sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt - b.joinedAt);
    for (const member of waiting) {
      if (this.seated().length >= this.maxPlayers) break;
      member.spectator = false;
      member.ready = false;
    }
  }

  // ---------------------------------------------------------------- host tools

  /** Host only: removes someone (for good with `ban`). A player in a game leaves it. */
  kick(
    hostId: string,
    targetId: string,
    ban: boolean,
  ): { ok: true; socketId: string | null } | { ok: false; error: "not_host" | "invalid" } {
    if (hostId !== this.hostId) return { ok: false, error: "not_host" };
    const target = this.members.get(targetId);
    if (!target || targetId === hostId) return { ok: false, error: "invalid" };
    this.leaveGame(targetId);
    if (ban) this.banned.add(targetId);
    this.members.delete(targetId);
    this.fillSeats();
    this.touch();
    this.broadcast();
    return { ok: true, socketId: target.socketId };
  }

  /** Host only: hands the room to another connected member. */
  transferHost(hostId: string, targetId: string): TableResult {
    if (hostId !== this.hostId) return { ok: false, error: "not_host" };
    const target = this.members.get(targetId);
    if (!target?.connected || targetId === hostId) return { ok: false, error: "invalid" };
    this.hostId = targetId;
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  memberIds(): string[] {
    return [...this.members.keys()];
  }

  // ---------------------------------------------------------------- game

  private seatOf(playerId: string): number | null {
    const seat = this.game?.seats.indexOf(playerId) ?? -1;
    return seat >= 0 ? seat : null;
  }

  move(playerId: string, move: unknown): TableResult {
    const game = this.game;
    if (!game || this.status !== "playing") return { ok: false, error: "wrong_status" };
    if (game.result) return { ok: false, error: "game_over" };
    const seat = this.seatOf(playerId);
    if (seat === null || game.left.includes(seat)) return { ok: false, error: "not_a_player" };
    const parsed = this.engine.moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const result = this.engine.move(structuredClone(game.state), seat, parsed.data, this.ctx());
    if (!result.ok) return { ok: false, error: result.error };
    this.setState(result.state);
    return { ok: true };
  }

  resign(playerId: string): TableResult {
    if (!this.game || this.game.result || this.status !== "playing")
      return { ok: false, error: "wrong_status" };
    const seat = this.seatOf(playerId);
    if (seat === null || this.game.left.includes(seat)) return { ok: false, error: "not_a_player" };
    this.leaveGame(playerId);
    return { ok: true };
  }

  /** The player gives up their seat in a running game (resign, kick, gone for good). */
  private leaveGame(playerId: string) {
    const game = this.game;
    const seat = this.seatOf(playerId);
    if (!game || game.result || seat === null || game.left.includes(seat)) return;
    game.left.push(seat);
    this.setState(this.engine.leave(structuredClone(game.state), seat, this.ctx()));
  }

  /** Stores a new engine state, records the result once and shares the change. */
  private setState(state: unknown) {
    const game = this.game!;
    game.state = state;
    if (!game.result) {
      const result = this.engine.result(state);
      if (result) {
        game.result = result;
        for (const seat of result.winners) {
          const member = this.members.get(game.seats[seat]!);
          if (member) member.wins++;
        }
      }
    }
    this.touch();
    this.broadcast();
  }

  // ---------------------------------------------------------------- chat

  say(playerId: string, text: string): TableResult {
    const member = this.members.get(playerId);
    if (!member) return { ok: false, error: "invalid" };
    this.chat.push({
      id: ++this.chatId,
      playerId,
      name: member.name,
      color: member.color,
      text,
      at: this.now(),
    });
    if (this.chat.length > TABLE_CHAT_KEEP) this.chat.splice(0, this.chat.length - TABLE_CHAT_KEEP);
    this.lastActiveAt = this.now();
    this.broadcast();
    return { ok: true };
  }

  // ---------------------------------------------------------------- time

  /** Called several times a second by the manager. */
  tick() {
    const now = this.now();
    if (this.status === "playing" && this.game) this.tickGame(this.game, now);
    else this.tickLobby(now);
    // A host who is gone for good hands the room over, so rematches stay possible.
    const host = this.members.get(this.hostId);
    if (!host || (host.disconnectedAt !== null && now - host.disconnectedAt > this.reconnectMs)) {
      const next = [...this.members.values()].find((m) => m.connected);
      if (next && next.id !== this.hostId) {
        this.hostId = next.id;
        this.touch(now);
        this.broadcast();
      }
    }
  }

  private tickGame(game: TableGameRecord, now: number) {
    if (game.result) return;
    const next = this.engine.tick?.(game.state, this.ctx()) ?? null;
    if (next !== null) this.setState(next);
    // A player who did not come back leaves the game.
    for (const playerId of game.seats) {
      const member = this.members.get(playerId);
      const away = member?.disconnectedAt ?? null;
      if (member && away !== null && now - away > this.reconnectMs) this.leaveGame(playerId);
    }
  }

  private tickLobby(now: number) {
    let changed = false;
    for (const member of [...this.members.values()]) {
      if (member.disconnectedAt !== null && now - member.disconnectedAt > this.lobbyGraceMs) {
        this.members.delete(member.id);
        changed = true;
      }
    }
    if (changed) {
      if (!this.members.has(this.hostId)) {
        const next = [...this.members.values()].find((m) => m.connected);
        if (next) this.hostId = next.id;
      }
      this.fillSeats();
      this.touch(now);
      this.broadcast();
    }
  }

  private touch(now = this.now()) {
    this.dirty = true;
    this.lastActiveAt = now;
  }

  // ---------------------------------------------------------------- views

  /** Sends every connected person their own state. */
  broadcast() {
    for (const member of this.members.values()) {
      if (member.connected && member.socketId)
        this.emitter.state(member.socketId, this.stateFor(member.id));
    }
  }

  stateFor(playerId: string): TableRoomStateDTO {
    const members = [...this.members.values()].sort(
      (a, b) => Number(a.spectator) - Number(b.spectator) || a.joinedAt - b.joinedAt,
    );
    const game = this.game;
    const now = this.now();
    const seat = game ? this.seatOf(playerId) : null;
    return {
      id: this.id,
      kind: this.kind,
      status: this.status,
      options: this.options,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      members: members.map((m): TableMemberDTO => ({
        id: m.id,
        name: m.name,
        color: m.color,
        avatar: m.avatar,
        connected: m.connected,
        ready: m.ready,
        isHost: m.id === this.hostId,
        spectator: m.spectator,
        wins: m.wins,
      })),
      you: playerId,
      serverNow: now,
      game: game
        ? {
            seats: game.seats.map((id, i) => {
              const member = this.members.get(id);
              return {
                playerId: id,
                name: member?.name ?? game.names[i] ?? "?",
                color: member?.color ?? "#9CA3AF",
                avatar: member?.avatar ?? "👤",
                connected: member?.connected ?? false,
                left: game.left.includes(i),
              };
            }),
            yourSeat: seat,
            active: game.result ? [] : this.engine.active(game.state),
            result: game.result,
            startedAt: game.startedAt,
            view: this.engine.view(game.state, seat, now),
          }
        : null,
      chat: this.chat,
    };
  }

  /** Numbers for link previews: never anything secret. */
  get summary() {
    return {
      id: this.id,
      kind: this.kind,
      status: this.status,
      players: this.seated().length,
      maxPlayers: this.maxPlayers,
    };
  }

  persistable(): TableRoomUpdate {
    return {
      hostId: this.hostId,
      status: this.status,
      members: [...this.members.values()].map(
        ({ socketId: _socket, connected: _connected, disconnectedAt: _at, ...record }) => record,
      ),
      game: this.game,
      round: this.round,
      banned: [...this.banned],
    };
  }
}
