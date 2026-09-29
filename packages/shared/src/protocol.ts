import { z } from "zod";
import { PLAYER_COLORS } from "./colors";
import {
  MAX_PLAYERS_PER_ROOM,
  PIECE_COUNT_OPTIONS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "./constants";
import type { PuzzleSnapshot, SnapResult } from "./puzzle/state";

/**
 * Wire protocol between the browser and the game server.
 * Client → server payloads are validated with Zod on the server;
 * server → client payloads are trusted and only typed.
 */

// ------------------------------------------------------------------ shared schemas

/** Removes control characters and collapses whitespace. */
export function sanitizeName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const UsernameSchema = z
  .string()
  .transform(sanitizeName)
  .pipe(z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH));

export const ColorSchema = z.enum(PLAYER_COLORS);
export const AvatarSchema = z.string().min(1).max(16);
export const ClientIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const RoomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,16}$/);

const Coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const GroupId = z.number().int().min(0).max(100_000);

export const JoinPayloadSchema = z.object({
  roomId: RoomIdSchema,
  clientId: ClientIdSchema,
  name: UsernameSchema,
  color: ColorSchema,
  avatar: AvatarSchema,
});
export const CursorPayloadSchema = z.object({ x: Coordinate, y: Coordinate });
export const GrabPayloadSchema = z.object({ groupId: GroupId });
export const MovePayloadSchema = z.object({ groupId: GroupId, x: Coordinate, y: Coordinate });
export const DropPayloadSchema = MovePayloadSchema;

export const CreateRoomSchema = z.object({
  clientId: ClientIdSchema,
  imageId: z.string().min(1).max(64),
  pieces: z
    .number()
    .int()
    .refine((n) => (PIECE_COUNT_OPTIONS as readonly number[]).includes(n)),
  maxPlayers: z.number().int().min(2).max(MAX_PLAYERS_PER_ROOM).default(MAX_PLAYERS_PER_ROOM),
  rotation: z.boolean().default(false),
});

export type JoinPayload = z.infer<typeof JoinPayloadSchema>;
export type CursorPayload = z.infer<typeof CursorPayloadSchema>;
export type GrabPayload = z.infer<typeof GrabPayloadSchema>;
export type MovePayload = z.infer<typeof MovePayloadSchema>;
export type DropPayload = z.infer<typeof DropPayloadSchema>;
export type CreateRoomInput = z.input<typeof CreateRoomSchema>;

// ------------------------------------------------------------------ DTOs

export interface PlayerDTO {
  id: string;
  name: string;
  color: string;
  avatar: string;
  connected: boolean;
  isHost: boolean;
}

export interface ImageDTO {
  id: string;
  /** "demo" images are generated client-side from `seed`; others load from `url`. */
  source: "demo" | "upload" | "unsplash";
  url: string;
  width: number;
  height: number;
  credit?: string | null;
}

export interface RoomInfoDTO {
  id: string;
  cols: number;
  rows: number;
  seed: number;
  rotation: boolean;
  maxPlayers: number;
  image: ImageDTO;
  status: "PLAYING" | "COMPLETED";
  createdAt: number;
  completedAt: number | null;
}

export interface PlayerStatsDTO {
  merges: number;
}

export interface RoomStateDTO {
  room: RoomInfoDTO;
  puzzle: PuzzleSnapshot;
  /** groupId → playerId currently holding it */
  locks: Record<number, string>;
  players: PlayerDTO[];
  stats: Record<string, PlayerStatsDTO>;
  you: string;
}

export type JoinError = "not_found" | "full" | "invalid";

export type JoinAck = { ok: true; state: RoomStateDTO } | { ok: false; error: JoinError };

export type GrabAck = { ok: true } | { ok: false; heldBy?: string };

export interface RemoteSnap extends SnapResult {
  playerId: string;
}

// ------------------------------------------------------------------ events

export interface ServerToClientEvents {
  "player:joined": (player: PlayerDTO) => void;
  "player:updated": (player: PlayerDTO) => void;
  "player:left": (playerId: string) => void;
  cursor: (playerId: string, x: number, y: number) => void;
  "piece:grabbed": (groupId: number, playerId: string) => void;
  "piece:released": (groupId: number) => void;
  "piece:moved": (groupId: number, x: number, y: number) => void;
  "piece:dropped": (groupId: number, x: number, y: number, playerId: string) => void;
  "piece:snapped": (result: RemoteSnap) => void;
  "groups:moved": (moves: Array<{ id: number; x: number; y: number }>) => void;
  "puzzle:completed": (info: { durationMs: number; stats: Record<string, PlayerStatsDTO> }) => void;
  kicked: () => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: JoinPayload, ack: (result: JoinAck) => void) => void;
  "room:sync": (ack: (state: RoomStateDTO | null) => void) => void;
  "cursor:move": (payload: CursorPayload) => void;
  "piece:grab": (payload: GrabPayload, ack: (result: GrabAck) => void) => void;
  "piece:move": (payload: MovePayload) => void;
  "piece:drop": (payload: DropPayload) => void;
  "puzzle:arrange": () => void;
}
