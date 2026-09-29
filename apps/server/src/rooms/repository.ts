import type { ImageDTO, PlayerStatsDTO, PuzzleSnapshot } from "@puzzle/shared";

export interface RoomRecord {
  id: string;
  /** 4-digit code for joining without the link; null when none was free. */
  code: string | null;
  hostId: string;
  /** Public id of the current host, when it is no longer the creator. */
  hostPlayerId: string | null;
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
  startedAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
  /** Public player ids kicked with a ban. */
  banned: string[];
}

export type NewRoom = Omit<
  RoomRecord,
  | "image"
  | "state"
  | "stats"
  | "status"
  | "createdAt"
  | "startedAt"
  | "completedAt"
  | "banned"
  | "hostPlayerId"
> & {
  imageId: string;
  state: PuzzleSnapshot;
};

export interface RoomStateUpdate {
  state: PuzzleSnapshot;
  stats: Record<string, PlayerStatsDTO>;
  status: "PLAYING" | "COMPLETED";
  startedAt: Date;
  completedAt: Date | null;
  banned: string[];
  hostPlayerId: string | null;
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
  /** Id of the unexpired room with this join code. */
  findRoomIdByCode(code: string, now: Date): Promise<string | null>;
  saveRoomState(id: string, update: RoomStateUpdate): Promise<void>;
  deleteExpiredRooms(now: Date): Promise<number>;
}

/** Thrown by createRoom when the join code already belongs to another room. */
export class RoomCodeTakenError extends Error {
  constructor(readonly code: string) {
    super(`Room code ${code} is taken`);
  }
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
