import type { GameResult, TableGameKind, TableRoomStatus } from "@puzzle/shared/games";
import type { Db } from "../db";
import { Prisma } from "../generated/prisma/client";

/** A room member as stored (no socket data). */
export interface TableMemberRecord {
  id: string;
  name: string;
  color: string;
  avatar: string;
  ready: boolean;
  spectator: boolean;
  joinedAt: number;
  wins: number;
}

/** The game in progress (or just finished). `state` is the engine's own JSON. */
export interface TableGameRecord {
  /** Player ids by seat. */
  seats: string[];
  /** Names by seat, kept so a seat stays readable after its player leaves the room. */
  names: string[];
  left: number[];
  state: unknown;
  startedAt: number;
  result: GameResult | null;
}

export interface TableRoomRecord {
  id: string;
  kind: TableGameKind;
  hostId: string;
  options: unknown;
  status: TableRoomStatus;
  members: TableMemberRecord[];
  game: TableGameRecord | null;
  /** Games started in this room: rotates seats (colours, first move) between rematches. */
  round: number;
  banned: string[];
  createdAt: Date;
  expiresAt: Date;
}

export type NewTableRoom = Pick<
  TableRoomRecord,
  "id" | "kind" | "hostId" | "options" | "expiresAt"
>;

export type TableRoomUpdate = Pick<
  TableRoomRecord,
  "hostId" | "status" | "members" | "game" | "round" | "banned"
>;

export interface TableRepository {
  createRoom(room: NewTableRoom): Promise<TableRoomRecord>;
  loadRoom(id: string): Promise<TableRoomRecord | null>;
  saveRoom(id: string, update: TableRoomUpdate): Promise<void>;
  deleteExpiredRooms(now: Date): Promise<number>;
}

/** For tests and local development without PostgreSQL. */
export class MemoryTableRepository implements TableRepository {
  private readonly rooms = new Map<string, TableRoomRecord>();

  async createRoom(room: NewTableRoom) {
    const record: TableRoomRecord = {
      ...room,
      status: "lobby",
      members: [],
      game: null,
      round: 0,
      banned: [],
      createdAt: new Date(),
    };
    this.rooms.set(room.id, record);
    return structuredClone(record);
  }

  async loadRoom(id: string) {
    const record = this.rooms.get(id);
    return record ? structuredClone(record) : null;
  }

  async saveRoom(id: string, update: TableRoomUpdate) {
    const record = this.rooms.get(id);
    if (record) Object.assign(record, structuredClone(update));
  }

  async deleteExpiredRooms(now: Date) {
    let count = 0;
    for (const [id, room] of this.rooms) {
      if (room.expiresAt <= now) {
        this.rooms.delete(id);
        count++;
      }
    }
    return count;
  }
}

const json = (value: unknown) =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

export class PrismaTableRepository implements TableRepository {
  constructor(private readonly db: Db) {}

  async createRoom(room: NewTableRoom) {
    const row = await this.db.tableRoom.create({
      data: { ...room, options: json(room.options) },
    });
    return this.toRecord(row);
  }

  async loadRoom(id: string) {
    const row = await this.db.tableRoom.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async saveRoom(id: string, update: TableRoomUpdate) {
    await this.db.tableRoom.update({
      where: { id },
      data: {
        hostId: update.hostId,
        status: update.status === "playing" ? "PLAYING" : "LOBBY",
        members: update.members as unknown as Prisma.InputJsonValue,
        game: json(update.game),
        round: update.round,
        banned: update.banned,
      },
    });
  }

  async deleteExpiredRooms(now: Date) {
    const { count } = await this.db.tableRoom.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }

  private toRecord(row: {
    id: string;
    kind: string;
    hostId: string;
    options: unknown;
    status: "LOBBY" | "PLAYING";
    members: unknown;
    game: unknown;
    round: number;
    banned: string[];
    createdAt: Date;
    expiresAt: Date;
  }): TableRoomRecord {
    return {
      id: row.id,
      kind: row.kind as TableGameKind,
      hostId: row.hostId,
      options: row.options ?? null,
      status: row.status === "PLAYING" ? "playing" : "lobby",
      members: (row.members as TableMemberRecord[] | null) ?? [],
      game: (row.game as TableGameRecord | null) ?? null,
      round: row.round,
      banned: row.banned,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }
}
