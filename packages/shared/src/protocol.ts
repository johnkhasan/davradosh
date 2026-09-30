import { z } from "zod";
import { PLAYER_COLORS } from "./colors";
import {
  CHAT_MAX_LENGTH,
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

/** Chat text: no control or bidi-override characters, whitespace collapsed. */
export function sanitizeChat(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const ChatPayloadSchema = z.object({
  text: z
    .string()
    .max(CHAT_MAX_LENGTH * 2)
    .transform(sanitizeChat)
    .pipe(z.string().min(1).max(CHAT_MAX_LENGTH)),
});

export const UsernameSchema = z
  .string()
  .transform(sanitizeName)
  .pipe(z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH));

export const ColorSchema = z.enum(PLAYER_COLORS);
export const AvatarSchema = z.string().min(1).max(16);
export const ClientIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const RoomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,16}$/);
/** 4-digit code that joins a room without the link. */
export const RoomCodeSchema = z.string().regex(/^\d{4}$/);

const Coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const GroupId = z.number().int().min(0).max(100_000);

export const JoinPayloadSchema = z.object({
  roomId: RoomIdSchema,
  clientId: ClientIdSchema,
  name: UsernameSchema,
  color: ColorSchema,
  avatar: AvatarSchema,
  /** "viewer" to only watch; players are made viewers automatically when the room is full. */
  role: z.enum(["player", "viewer"]).default("player"),
});
export const CursorPayloadSchema = z.object({ x: Coordinate, y: Coordinate });

/** Quick reactions shown floating from the sender's cursor. */
export const REACTION_EMOJIS = ["👍", "🎉", "👏", "🔥", "😮", "😂", "❤️", "🧩"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export const ReactionPayloadSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
  x: Coordinate,
  y: Coordinate,
});

const Extent = z.number().finite().positive().max(10_000_000);
/** The world rectangle a player currently sees (minimap and follow mode). */
export const ViewportPayloadSchema = z.object({
  x: Coordinate,
  y: Coordinate,
  width: Extent,
  height: Extent,
});
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
/** What clients send (role is optional and defaults to "player"). */
export type JoinRequest = z.input<typeof JoinPayloadSchema>;
export type CursorPayload = z.infer<typeof CursorPayloadSchema>;
export type ReactionPayload = z.infer<typeof ReactionPayloadSchema>;
export type ViewportPayload = z.infer<typeof ViewportPayloadSchema>;
export type GrabPayload = z.infer<typeof GrabPayloadSchema>;
export type MovePayload = z.infer<typeof MovePayloadSchema>;
export type DropPayload = z.infer<typeof DropPayloadSchema>;
export type CreateRoomInput = z.input<typeof CreateRoomSchema>;

// ------------------------------------------------------------------ DTOs

/** Players take a seat and move pieces; viewers only watch (and listen). */
export type PlayerRole = "player" | "viewer";
export const PlayerRoleSchema = z.enum(["player", "viewer"]);

export const KickPayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  ban: z.boolean().default(false),
});
export const TransferHostPayloadSchema = z.object({ playerId: z.string().min(1).max(64) });
export const SetRolePayloadSchema = z.object({
  playerId: z.string().min(1).max(64),
  role: PlayerRoleSchema,
});

export interface PlayerDTO {
  id: string;
  name: string;
  color: string;
  avatar: string;
  connected: boolean;
  isHost: boolean;
  role: PlayerRole;
}

export interface ImageDTO {
  id: string;
  /** "demo" images are generated client-side from `seed`; others load from `url`. */
  source: "demo" | "upload" | "unsplash";
  url: string;
  /** Small preview (link previews, room lists). Empty for demo images. */
  thumbUrl?: string;
  width: number;
  height: number;
  credit?: string | null;
}

export interface RoomInfoDTO {
  id: string;
  /** 4-digit join code; null for rooms created before codes existed or when none was free. */
  code: string | null;
  cols: number;
  rows: number;
  seed: number;
  rotation: boolean;
  maxPlayers: number;
  image: ImageDTO;
  status: "PLAYING" | "COMPLETED";
  createdAt: number;
  /** When the current round started (reset by the host's restart). */
  startedAt: number;
  completedAt: number | null;
}

export interface PlayerStatsDTO {
  merges: number;
  /** Name, colour and avatar when last seen, so results still show players who left. */
  name?: string;
  color?: string;
  avatar?: string;
}

export interface ChatMessageDTO {
  id: string;
  playerId: string;
  /** Name and colour at the time of writing, so messages of people who left still render. */
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface RoomStateDTO {
  room: RoomInfoDTO;
  puzzle: PuzzleSnapshot;
  /** groupId → playerId currently holding it */
  locks: Record<number, string>;
  players: PlayerDTO[];
  stats: Record<string, PlayerStatsDTO>;
  /** Recent chat, oldest first. */
  chat: ChatMessageDTO[];
  you: string;
}

export type JoinError = "not_found" | "full" | "invalid" | "banned";

/** Result of host actions and seat requests. */
export type ActionAck =
  { ok: true } | { ok: false; error: "not_host" | "not_found" | "full" | "invalid" };

export type KickReason = "other-tab" | "host";

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
  reaction: (playerId: string, emoji: ReactionEmoji, x: number, y: number) => void;
  viewport: (playerId: string, rect: ViewportPayload) => void;
  "chat:message": (message: ChatMessageDTO) => void;
  "piece:grabbed": (groupId: number, playerId: string) => void;
  "piece:released": (groupId: number) => void;
  "piece:moved": (groupId: number, x: number, y: number) => void;
  "piece:dropped": (groupId: number, x: number, y: number, playerId: string) => void;
  "piece:snapped": (result: RemoteSnap) => void;
  "groups:moved": (moves: Array<{ id: number; x: number; y: number }>) => void;
  "puzzle:completed": (info: { durationMs: number; stats: Record<string, PlayerStatsDTO> }) => void;
  kicked: (reason: KickReason) => void;
  /** The host restarted the puzzle: clients reload the room state. */
  "puzzle:reset": () => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: JoinRequest, ack: (result: JoinAck) => void) => void;
  "room:sync": (ack: (state: RoomStateDTO | null) => void) => void;
  "cursor:move": (payload: CursorPayload) => void;
  reaction: (payload: ReactionPayload) => void;
  viewport: (payload: ViewportPayload) => void;
  "chat:send": (payload: { text: string }) => void;
  "piece:grab": (payload: GrabPayload, ack: (result: GrabAck) => void) => void;
  "piece:move": (payload: MovePayload) => void;
  "piece:drop": (payload: DropPayload) => void;
  "puzzle:arrange": () => void;
  /** A viewer asks for a free seat. */
  "seat:claim": (ack: (result: ActionAck) => void) => void;
  /** A player gives up their seat and keeps watching. */
  "seat:leave": (ack: (result: ActionAck) => void) => void;
  "host:kick": (
    payload: z.input<typeof KickPayloadSchema>,
    ack: (result: ActionAck) => void,
  ) => void;
  "host:set-role": (
    payload: z.input<typeof SetRolePayloadSchema>,
    ack: (result: ActionAck) => void,
  ) => void;
  "host:restart": (ack: (result: ActionAck) => void) => void;
  /** Hand the host role to another connected player. */
  "host:transfer": (
    payload: z.input<typeof TransferHostPayloadSchema>,
    ack: (result: ActionAck) => void,
  ) => void;
}
