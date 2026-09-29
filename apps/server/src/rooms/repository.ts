import type { ImageDTO, PlayerStatsDTO, PuzzleSnapshot } from "@puzzle/shared";

export interface RoomRecord {
  id: string;
  hostId: string;
  image: ImageDTO;
  cols: number;
  rows: number;
  seed: number;
  rotation: boolean;
  maxPlayers: number;
  status: "PLAYING" | "COMPLETED";
  state: PuzzleSnapshot | null;
  stats: Record<string, PlayerStatsDTO> | null;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
}

export type NewRoom = Omit<
  RoomRecord,
  "image" | "state" | "stats" | "status" | "createdAt" | "completedAt"
> & {
  imageId: string;
  state: PuzzleSnapshot;
};

export interface RoomStateUpdate {
  state: PuzzleSnapshot;
  stats: Record<string, PlayerStatsDTO>;
  status: "PLAYING" | "COMPLETED";
  completedAt: Date | null;
}

export type NewImage = Required<Pick<ImageDTO, "id" | "url" | "thumbUrl" | "width" | "height">> & {
  source: "upload" | "unsplash";
  credit?: string | null;
};

export interface RoomRepository {
  getImage(id: string): Promise<ImageDTO | null>;
  createImage(image: NewImage): Promise<ImageDTO>;
  createRoom(room: NewRoom): Promise<RoomRecord>;
  loadRoom(id: string): Promise<RoomRecord | null>;
  saveRoomState(id: string, update: RoomStateUpdate): Promise<void>;
  deleteExpiredRooms(now: Date): Promise<number>;
}

/** Built-in image generated in the browser; lets rooms work before uploads exist. */
export const DEMO_IMAGE: ImageDTO = {
  id: "demo",
  source: "demo",
  url: "",
  width: 1600,
  height: 1200,
  credit: null,
};
