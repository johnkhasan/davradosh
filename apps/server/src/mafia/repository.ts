import type { MafiaRoomStatus } from "@puzzle/shared/mafia";
import type { Db } from "../db";
import { Prisma } from "../generated/prisma/client";
import { RoomCodeTakenError } from "../rooms/repository";
import type { MafiaGameSnapshot } from "./game";

/** A room member as stored (no socket data). */
export interface MafiaMemberRecord {
  id: string;
  name: string;
  color: string;
  avatar: string;
  ready: boolean;
  spectator: boolean;
  joinedAt: number;
}

export interface MafiaRoomRecord {
  id: string;
  /** 4-digit join code (puzzle and mafia rooms share the codes); null when none was free. */
  code?: string | null;
  hostId: string;
  /** Players at the table, chosen at creation (6–12, 10 is official). */
  tableSize: number;
  status: MafiaRoomStatus;
  members: MafiaMemberRecord[];
  /** Contains the roles: server only. */
  game: MafiaGameSnapshot | null;
  banned: string[];
  createdAt: Date;
  expiresAt: Date;
}

export type NewMafiaRoom = {
  id: string;
  code?: string | null;
  hostId: string;
  tableSize: number;
  expiresAt: Date;
};

export type MafiaRoomUpdate = Pick<
  MafiaRoomRecord,
  "hostId" | "status" | "members" | "game" | "banned"
>;

export interface MafiaRepository {
  createRoom(room: NewMafiaRoom): Promise<MafiaRoomRecord>;
  loadRoom(id: string): Promise<MafiaRoomRecord | null>;
  /** Id of the unexpired room with this join code. */
  findRoomIdByCode(code: string, now: Date): Promise<string | null>;
  saveRoom(id: string, update: MafiaRoomUpdate): Promise<void>;
  deleteExpiredRooms(now: Date): Promise<number>;
}

/** For tests and local development without PostgreSQL. */
export class MemoryMafiaRepository implements MafiaRepository {
  private readonly rooms = new Map<string, MafiaRoomRecord>();

  async createRoom(room: NewMafiaRoom) {
    if (room.code) {
      for (const other of this.rooms.values()) {
        if (other.code !== room.code) continue;
        // An expired room gives its code up, like the Prisma repository does.
        if (other.expiresAt > new Date()) throw new RoomCodeTakenError(room.code);
        other.code = null;
      }
    }
    const record: MafiaRoomRecord = {
      ...room,
      status: "lobby",
      members: [],
      game: null,
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

  async findRoomIdByCode(code: string, now: Date) {
    for (const room of this.rooms.values())
      if (room.code === code && room.expiresAt > now) return room.id;
    return null;
  }

  async saveRoom(id: string, update: MafiaRoomUpdate) {
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

const STATUS_TO_DB = { lobby: "LOBBY", playing: "PLAYING" } as const;

export class PrismaMafiaRepository implements MafiaRepository {
  constructor(private readonly db: Db) {}

  async createRoom(room: NewMafiaRoom) {
    // Expired rooms waiting for the hourly cleanup give their code up.
    if (room.code)
      await this.db.mafiaRoom.updateMany({
        where: { code: room.code, expiresAt: { lte: new Date() } },
        data: { code: null },
      });
    try {
      const row = await this.db.mafiaRoom.create({ data: room });
      return this.toRecord(row);
    } catch (error) {
      if (
        room.code &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new RoomCodeTakenError(room.code);
      throw error;
    }
  }

  async findRoomIdByCode(code: string, now: Date) {
    const row = await this.db.mafiaRoom.findFirst({
      where: { code, expiresAt: { gt: now } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async loadRoom(id: string) {
    const row = await this.db.mafiaRoom.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async saveRoom(id: string, update: MafiaRoomUpdate) {
    await this.db.mafiaRoom.update({
      where: { id },
      data: {
        hostId: update.hostId,
        status: STATUS_TO_DB[update.status],
        members: update.members as unknown as Prisma.InputJsonValue,
        game:
          update.game === null ? Prisma.DbNull : (update.game as unknown as Prisma.InputJsonValue),
        banned: update.banned,
      },
    });
  }

  async deleteExpiredRooms(now: Date) {
    const { count } = await this.db.mafiaRoom.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }

  private toRecord(row: {
    id: string;
    code: string | null;
    hostId: string;
    tableSize: number;
    status: "LOBBY" | "PLAYING";
    members: unknown;
    game: unknown;
    banned: string[];
    createdAt: Date;
    expiresAt: Date;
  }): MafiaRoomRecord {
    return {
      id: row.id,
      code: row.code,
      hostId: row.hostId,
      tableSize: row.tableSize,
      status: row.status === "PLAYING" ? "playing" : "lobby",
      members: (row.members as MafiaMemberRecord[] | null) ?? [],
      game: (row.game as MafiaGameSnapshot | null) ?? null,
      banned: row.banned,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }
}
