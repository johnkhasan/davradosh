import type { ImageDTO, PlayerStatsDTO, PuzzleSnapshot } from "@puzzle/shared";
import type { Db } from "../db";
import type { Prisma } from "../generated/prisma/client";
import {
  DEMO_IMAGE,
  type NewImage,
  type NewRoom,
  type RoomRecord,
  type RoomRepository,
  type RoomStateUpdate,
} from "./repository";

type ImageRow = {
  id: string;
  source: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  credit: string | null;
};

function toImage(row: ImageRow): ImageDTO {
  return {
    id: row.id,
    source: row.source as ImageDTO["source"],
    url: row.url,
    thumbUrl: row.thumbUrl,
    width: row.width,
    height: row.height,
    credit: row.credit,
  };
}

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly db: Db) {}

  async createImage(image: NewImage) {
    const row = await this.db.image.upsert({
      where: { id: image.id },
      create: { ...image, credit: image.credit ?? null },
      update: {},
    });
    return toImage(row);
  }

  async getImage(id: string) {
    const row = await this.db.image.findUnique({ where: { id } });
    if (row) return toImage(row);
    if (id === DEMO_IMAGE.id) {
      // Seed the built-in demo image on first use.
      const created = await this.db.image.upsert({
        where: { id },
        create: { ...DEMO_IMAGE, thumbUrl: "", credit: null },
        update: {},
      });
      return toImage(created);
    }
    return null;
  }

  async createRoom(room: NewRoom): Promise<RoomRecord> {
    const row = await this.db.room.create({
      data: {
        id: room.id,
        hostId: room.hostId,
        imageId: room.imageId,
        cols: room.cols,
        rows: room.rows,
        seed: room.seed,
        rotation: room.rotation,
        maxPlayers: room.maxPlayers,
        state: room.state as unknown as Prisma.InputJsonValue,
        stats: {},
        expiresAt: room.expiresAt,
      },
      include: { image: true },
    });
    return this.toRecord(row);
  }

  async loadRoom(id: string) {
    const row = await this.db.room.findUnique({ where: { id }, include: { image: true } });
    return row ? this.toRecord(row) : null;
  }

  async saveRoomState(id: string, update: RoomStateUpdate) {
    await this.db.room.update({
      where: { id },
      data: {
        state: update.state as unknown as Prisma.InputJsonValue,
        stats: update.stats as unknown as Prisma.InputJsonValue,
        status: update.status,
        startedAt: update.startedAt,
        completedAt: update.completedAt,
        banned: update.banned,
        hostPlayerId: update.hostPlayerId,
      },
    });
  }

  async deleteExpiredRooms(now: Date) {
    const { count } = await this.db.room.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }

  private toRecord(row: {
    id: string;
    hostId: string;
    image: ImageRow;
    cols: number;
    rows: number;
    seed: number;
    rotation: boolean;
    maxPlayers: number;
    status: "PLAYING" | "COMPLETED";
    state: unknown;
    stats: unknown;
    createdAt: Date;
    startedAt: Date;
    completedAt: Date | null;
    expiresAt: Date;
    banned: string[];
    hostPlayerId: string | null;
  }): RoomRecord {
    return {
      ...row,
      image: toImage(row.image),
      state: (row.state as PuzzleSnapshot | null) ?? null,
      stats: (row.stats as Record<string, PlayerStatsDTO> | null) ?? null,
    };
  }
}
