import { z } from "zod";
import { CHAT_MAX_LENGTH } from "../constants";
import {
  AvatarSchema,
  ChatPayloadSchema,
  ClientIdSchema,
  ColorSchema,
  RoomIdSchema,
  UsernameSchema,
} from "../protocol";
import { TABLE_GAME_KINDS, type TableGameKind } from "./catalog";
import type { GameResult } from "./engine";

export const CreateTableRoomSchema = z.object({
  clientId: ClientIdSchema,
  kind: z.enum(TABLE_GAME_KINDS),
  /** Game specific; checked with the engine's optionsSchema on the server. */
  options: z.unknown().optional(),
});

export const TableJoinPayloadSchema = z.object({
  roomId: RoomIdSchema,
  clientId: ClientIdSchema,
  name: UsernameSchema,
  color: ColorSchema,
  avatar: AvatarSchema,
});
export type TableJoinPayload = z.infer<typeof TableJoinPayloadSchema>;

export const TableReadyPayloadSchema = z.object({ ready: z.boolean() });
/** The move itself is checked by the game engine. */
export const TableMovePayloadSchema = z.object({ move: z.unknown() });
export const TableChatPayloadSchema = ChatPayloadSchema;
export const TablePlayerTargetSchema = z.object({ playerId: z.string().min(1).max(64) });
export const TableKickPayloadSchema = TablePlayerTargetSchema.extend({
  ban: z.boolean().default(false),
});

export interface TableMemberDTO {
  /** Public id (never the private client id). */
  id: string;
  name: string;
  color: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  spectator: boolean;
  /** Games won in this room (across rematches). */
  wins: number;
}

export interface TableSeatDTO {
  playerId: string;
  name: string;
  color: string;
  avatar: string;
  connected: boolean;
  /** Resigned, kicked or gone for good. */
  left: boolean;
}

export interface TableGameDTO {
  seats: TableSeatDTO[];
  /** The viewer's seat, null for spectators. */
  yourSeat: number | null;
  /** Seats that may act now. */
  active: number[];
  result: GameResult | null;
  startedAt: number;
  /** The engine's view for this viewer (each game has its own type). */
  view: unknown;
}

export interface TableChatMessage {
  id: number;
  playerId: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export type TableRoomStatus = "lobby" | "playing";

export interface TableRoomStateDTO {
  id: string;
  kind: TableGameKind;
  status: TableRoomStatus;
  /** Options chosen when the room was created (game specific). */
  options: unknown;
  minPlayers: number;
  maxPlayers: number;
  members: TableMemberDTO[];
  you: string;
  /** Server clock when this state was made: turns endsAt fields into local times. */
  serverNow: number;
  game: TableGameDTO | null;
  chat: TableChatMessage[];
}

export const TABLE_CHAT_KEEP = 50;
export { CHAT_MAX_LENGTH as TABLE_CHAT_MAX };

export type TableJoinAck =
  { ok: true; state: TableRoomStateDTO } | { ok: false; error: "not_found" | "invalid" | "banned" };

export type TableRoomError =
  "not_host" | "not_ready" | "wrong_status" | "invalid" | "not_a_player" | "rate_limited";
/** Engine errors come through as their own codes (for example "not_your_turn"). */
export type TableResult = { ok: true } | { ok: false; error: TableRoomError | (string & {}) };

type Ack<T> = (result: T) => void;

export interface TableClientToServerEvents {
  "table:join": (payload: TableJoinPayload, ack: Ack<TableJoinAck>) => void;
  "table:ready": (payload: z.input<typeof TableReadyPayloadSchema>, ack: Ack<TableResult>) => void;
  "table:start": (ack: Ack<TableResult>) => void;
  "table:rematch": (ack: Ack<TableResult>) => void;
  "table:move": (payload: z.input<typeof TableMovePayloadSchema>, ack: Ack<TableResult>) => void;
  "table:resign": (ack: Ack<TableResult>) => void;
  "table:chat": (payload: z.input<typeof TableChatPayloadSchema>, ack: Ack<TableResult>) => void;
  "table:kick": (payload: z.input<typeof TableKickPayloadSchema>, ack: Ack<TableResult>) => void;
  "table:transfer-host": (
    payload: z.input<typeof TablePlayerTargetSchema>,
    ack: Ack<TableResult>,
  ) => void;
}

export interface TableServerToClientEvents {
  "table:state": (state: TableRoomStateDTO) => void;
  "table:kicked": (reason: "other-tab" | "host" | "banned") => void;
}
