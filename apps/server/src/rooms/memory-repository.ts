import type { ImageDTO } from "@puzzle/shared";
import {
  DEMO_IMAGE,
  RoomCodeTakenError,
  type NewImage,
  type NewRoom,
  type RoomRecord,
  type RoomRepository,
  type RoomStateUpdate,
} from "./repository";

/** In-memory storage for tests and for local development without PostgreSQL. */
export class MemoryRoomRepository implements RoomRepository {
  private readonly images = new Map<string, ImageDTO>([[DEMO_IMAGE.id, DEMO_IMAGE]]);
  private readonly rooms = new Map<string, RoomRecord>();

  addImage(image: ImageDTO) {
    this.images.set(image.id, image);
  }

  async createImage(image: NewImage): Promise<ImageDTO> {
    const dto: ImageDTO = { ...image, credit: image.credit ?? null };
    this.images.set(dto.id, dto);
    return dto;
  }

  async getImage(id: string) {
    return this.images.get(id) ?? null;
  }

  async createRoom(room: NewRoom): Promise<RoomRecord> {
    const image = this.images.get(room.imageId);
    if (!image) throw new Error(`Unknown image ${room.imageId}`);
    if (room.code) {
      for (const other of this.rooms.values()) {
        if (other.code !== room.code) continue;
        // An expired room gives its code up, like the Prisma repository does.
        if (other.expiresAt > new Date()) throw new RoomCodeTakenError(room.code);
        other.code = null;
      }
    }
    const { imageId: _imageId, ...rest } = room;
    const record: RoomRecord = {
      ...rest,
      image,
      status: "PLAYING",
      stats: {},
      createdAt: new Date(),
      startedAt: new Date(),
      completedAt: null,
      banned: [],
      hostPlayerId: null,
    };
    this.rooms.set(room.id, structuredClone(record));
    return record;
  }

  async loadRoom(id: string) {
    const room = this.rooms.get(id);
    return room ? structuredClone(room) : null;
  }

  async findRoomIdByCode(code: string, now: Date) {
    for (const room of this.rooms.values())
      if (room.code === code && room.expiresAt > now) return room.id;
    return null;
  }

  async saveRoomState(id: string, update: RoomStateUpdate) {
    const room = this.rooms.get(id);
    if (room) Object.assign(room, structuredClone(update));
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
