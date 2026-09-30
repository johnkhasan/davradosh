import {
  MAFIA_PLAYERS,
  teamOf,
  type MafiaActionResult,
  type MafiaJoinPayload,
  type MafiaMemberDTO,
  type MafiaRoomResult,
  type MafiaRoomStateDTO,
  type MafiaRoomStatus,
} from "@puzzle/shared/mafia";
import { publicPlayerId } from "../lib/ids";
import { MafiaGame, type MafiaGameOptions } from "./game";
import type { MafiaMemberRecord, MafiaRoomRecord, MafiaRoomUpdate } from "./repository";

/** How the room talks to sockets. Each person only ever gets their own state. */
export interface MafiaRoomEmitter {
  state(socketId: string, state: MafiaRoomStateDTO): void;
}

/** A player who dropped out mid-game keeps the seat this long (mafia-plan.md §9). */
export const MAFIA_RECONNECT_MS = 90_000;
/** A member who dropped out of the lobby is removed after this long. */
export const MAFIA_LOBBY_GRACE_MS = 30_000;

export interface MafiaRoomOptions {
  now?: () => number;
  game?: MafiaGameOptions;
  reconnectMs?: number;
  lobbyGraceMs?: number;
}

interface Member extends MafiaMemberRecord {
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
}

export type MafiaJoinResult =
  | { ok: true; state: MafiaRoomStateDTO; replacedSocketId: string | null }
  | { ok: false; error: "banned" };

/**
 * One mafia room: the lobby (ten seats plus spectators), the game in progress and
 * the connections. The rules live in MafiaGame; this class only routes people to it.
 */
export class MafiaRoom {
  readonly id: string;
  private hostId: string;
  private status: MafiaRoomStatus;
  private readonly members = new Map<string, Member>();
  private readonly banned: Set<string>;
  private game: MafiaGame | null;
  private readonly now: () => number;
  private readonly gameOptions: MafiaGameOptions;
  private readonly reconnectMs: number;
  private readonly lobbyGraceMs: number;
  dirty = false;
  lastActiveAt: number;

  constructor(
    record: MafiaRoomRecord,
    private readonly emitter: MafiaRoomEmitter,
    options: MafiaRoomOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.gameOptions = options.game ?? {};
    this.reconnectMs = options.reconnectMs ?? MAFIA_RECONNECT_MS;
    this.lobbyGraceMs = options.lobbyGraceMs ?? MAFIA_LOBBY_GRACE_MS;
    const now = this.now();
    this.id = record.id;
    this.hostId = record.hostId;
    this.status = record.status;
    this.banned = new Set(record.banned);
    // After a restart nobody is connected yet: everyone gets the usual grace period to come back.
    for (const member of record.members) {
      this.members.set(member.id, {
        ...member,
        socketId: null,
        connected: false,
        disconnectedAt: now,
      });
    }
    this.game = record.game ? MafiaGame.restore(record.game, now, this.gameOptions) : null;
    for (const member of this.members.values()) this.game?.setConnected(member.id, false);
    if (this.status === "playing" && !this.game) this.status = "lobby";
    this.lastActiveAt = now;
  }

  // ---------------------------------------------------------------- people

  get connectedCount(): number {
    let count = 0;
    for (const member of this.members.values()) if (member.connected) count++;
    return count;
  }

  /** Members with a seat at the (next) table, in join order. */
  private seated(): Member[] {
    return [...this.members.values()].filter((m) => !m.spectator);
  }

  isCurrentSocket(playerId: string, socketId: string): boolean {
    return this.members.get(playerId)?.socketId === socketId;
  }

  join(payload: MafiaJoinPayload, socketId: string): MafiaJoinResult {
    const id = publicPlayerId(payload.clientId);
    if (this.banned.has(id)) return { ok: false, error: "banned" };
    const now = this.now();
    let member = this.members.get(id);
    let replacedSocketId: string | null = null;

    if (member) {
      replacedSocketId = member.socketId;
      // Names are locked while a game runs, so the table stays readable.
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
        // Late comers watch: during a game, or when all ten seats are taken.
        spectator: this.status === "playing" || this.seated().length >= MAFIA_PLAYERS,
        joinedAt: now,
        socketId: null,
        connected: false,
        disconnectedAt: null,
      };
      this.members.set(id, member);
    }
    member.socketId = socketId;
    member.connected = true;
    member.disconnectedAt = null;
    this.game?.setConnected(id, true);
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
    this.game?.setConnected(playerId, false);
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

  setReady(playerId: string, ready: boolean): MafiaRoomResult {
    const member = this.members.get(playerId);
    if (!member || member.spectator) return { ok: false, error: "invalid" };
    if (this.status !== "lobby") return { ok: false, error: "wrong_status" };
    member.ready = ready;
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  /** Host only, with exactly ten connected players who are all ready (the host counts as ready). */
  start(playerId: string): MafiaRoomResult {
    if (playerId !== this.hostId) return { ok: false, error: "not_host" };
    if (this.status !== "lobby") return { ok: false, error: "wrong_status" };
    const seated = this.seated();
    const ready = seated.every((m) => m.connected && (m.ready || m.id === this.hostId));
    if (seated.length !== MAFIA_PLAYERS || !ready) return { ok: false, error: "not_ready" };
    this.game = new MafiaGame(
      seated.map((m) => ({ id: m.id, name: m.name })),
      this.now(),
      this.gameOptions,
    );
    this.status = "playing";
    this.touch();
    this.broadcast();
    return { ok: true };
  }

  /** After a finished game: back to the lobby with the same people. */
  rematch(playerId: string): MafiaRoomResult {
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
      if (this.seated().length >= MAFIA_PLAYERS) break;
      member.spectator = false;
      member.ready = false;
    }
  }

  // ---------------------------------------------------------------- game actions

  /** Runs a game action for `playerId` and shares the result if it changed anything. */
  act(
    playerId: string,
    action: (game: MafiaGame, now: number) => MafiaActionResult,
  ): MafiaActionResult {
    const game = this.game;
    if (!game || this.status !== "playing") return { ok: false, error: "wrong_phase" };
    const result = action(game, this.now());
    if (result.ok) {
      this.touch();
      this.broadcast();
    }
    return result;
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

  private tickGame(game: MafiaGame, now: number) {
    const before = this.gameKey(game);
    game.advance(now);
    // A player who did not come back leaves the table (mafia-plan.md §9).
    for (const seat of game.aliveSeats()) {
      const member = this.members.get(game.playerAt(seat)!);
      const away = member?.disconnectedAt ?? null;
      if (member && away !== null && now - away > this.reconnectMs)
        game.removePlayer(member.id, now);
    }
    if (this.gameKey(game) !== before) {
      this.touch(now);
      this.broadcast();
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

  private gameKey(game: MafiaGame) {
    return `${game.phase}|${game.endsAt}|${game.log.length}|${game.aliveSeats().length}`;
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

  stateFor(playerId: string): MafiaRoomStateDTO {
    const members = [...this.members.values()].sort(
      (a, b) => Number(a.spectator) - Number(b.spectator) || a.joinedAt - b.joinedAt,
    );
    return {
      id: this.id,
      status: this.status,
      members: members.map((m): MafiaMemberDTO => ({
        id: m.id,
        name: m.name,
        color: m.color,
        avatar: m.avatar,
        connected: m.connected,
        ready: m.ready,
        isHost: m.id === this.hostId,
        spectator: m.spectator,
      })),
      you: playerId,
      serverNow: this.now(),
      game: this.game ? this.game.viewFor(playerId) : null,
    };
  }

  // ---------------------------------------------------------------- voice

  /**
   * Who may talk right now (mafia-plan.md §5). The server enforces it on LiveKit:
   * lobby and game over — everyone; speeches and last words — only the speaker;
   * votes and nights — nobody at the table; zero night — the living black team, in a
   * separate night room.
   */
  voicePolicy(): { everyone: boolean; speakers: string[]; night: string[] } {
    const game = this.game;
    if (this.status !== "playing" || !game || game.phase === "gameOver") {
      return { everyone: true, speakers: [], night: [] };
    }
    const speaker = game.speaker;
    const night =
      game.phase === "zeroNight"
        ? game
            .aliveSeats()
            .filter((seat) => teamOf(game.roleAt(seat)!) === "black")
            .map((seat) => game.playerAt(seat)!)
        : [];
    return { everyone: false, speakers: speaker === null ? [] : [game.playerAt(speaker)!], night };
  }

  /** Voice is only for people currently connected to the room. */
  voiceMember(playerId: string) {
    const member = this.members.get(playerId);
    return member?.connected
      ? { id: member.id, name: member.name, color: member.color, avatar: member.avatar }
      : null;
  }

  /** Numbers for link previews: never anything secret. */
  get summary() {
    return {
      id: this.id,
      status: this.status,
      players: this.seated().length,
      spectators: this.members.size - this.seated().length,
    };
  }

  persistable(): MafiaRoomUpdate {
    return {
      hostId: this.hostId,
      status: this.status,
      members: [...this.members.values()].map(
        ({ socketId: _socket, connected: _connected, disconnectedAt: _at, ...record }) => record,
      ),
      game: this.game ? this.game.snapshot(this.now()) : null,
      banned: [...this.banned],
    };
  }
}
