import type { ImageDTO } from "@puzzle/shared";
import {
  DEMO_IMAGE,
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

  async getImage(id: string) {
    return this.images.get(id) ?? null;
  }

  async createRoom(room: NewRoom): Promise<RoomRecord> {
    const image = this.images.get(room.imageId);
    if (!image) throw new Error(`Unknown image ${room.imageId}`);
    const { imageId: _imageId, ...rest } = room;
    const record: RoomRecord = {
      ...rest,
      image,
      status: "PLAYING",
      stats: {},
      createdAt: new Date(),
      completedAt: null,
    };
    this.rooms.set(room.id, structuredClone(record));
    return record;
  }

  async loadRoom(id: string) {
    const room = this.rooms.get(id);
    return room ? structuredClone(room) : null;
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
