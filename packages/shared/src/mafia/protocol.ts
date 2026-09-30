import { z } from "zod";
import {
  AvatarSchema,
  ClientIdSchema,
  ColorSchema,
  RoomIdSchema,
  UsernameSchema,
} from "../protocol";
import {
  BEST_MOVE_SIZE,
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_PLAYERS,
  MAFIA_SAY_MAX,
} from "./rules";
import type { MafiaView } from "./view";

export const SeatSchema = z.number().int().min(1).max(MAFIA_MAX_PLAYERS);

export const TableSizeSchema = z.number().int().min(MAFIA_MIN_PLAYERS).max(MAFIA_MAX_PLAYERS);

/** Payloads of player actions; the server validates every one of them. */
export const NominatePayloadSchema = z.object({ seat: SeatSchema });
export const VotePayloadSchema = z.object({ seat: SeatSchema });
export const LiftAllPayloadSchema = z.object({ agree: z.boolean() });
export const ShootPayloadSchema = z.object({ seat: SeatSchema });
export const CheckPayloadSchema = z.object({ seat: SeatSchema });
export const BestMovePayloadSchema = z.object({
  seats: z
    .array(SeatSchema)
    .length(BEST_MOVE_SIZE)
    .refine((seats) => new Set(seats).size === seats.length, "seats must be distinct"),
});

/** Typed speech: whitespace collapsed, one line of up to MAFIA_SAY_MAX characters. */
export const SayPayloadSchema = z.object({
  text: z
    .string()
    .max(MAFIA_SAY_MAX * 4)
    .transform((t) => t.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(MAFIA_SAY_MAX)),
});
export const MafiaPlayerTargetSchema = z.object({ playerId: z.string().min(1).max(64) });
export const MafiaKickPayloadSchema = MafiaPlayerTargetSchema.extend({
  ban: z.boolean().default(false),
});
export const FoulPayloadSchema = z.object({ seat: SeatSchema });

export type MafiaActionError =
  | "wrong_phase"
  | "not_a_player"
  | "dead"
  | "not_your_turn"
  | "not_allowed"
  | "invalid_target"
  | "already_done";

export type MafiaActionResult = { ok: true } | { ok: false; error: MafiaActionError };

// ------------------------------------------------------------------ rooms

export const CreateMafiaRoomSchema = z.object({
  clientId: ClientIdSchema,
  /** Players at the table; 10 is the official game. */
  tableSize: TableSizeSchema.default(MAFIA_PLAYERS),
});

export const MafiaJoinPayloadSchema = z.object({
  roomId: RoomIdSchema,
  clientId: ClientIdSchema,
  name: UsernameSchema,
  color: ColorSchema,
  avatar: AvatarSchema,
});
export type MafiaJoinPayload = z.infer<typeof MafiaJoinPayloadSchema>;

export const MafiaReadyPayloadSchema = z.object({ ready: z.boolean() });

/** Somebody in the room: one of the (up to) ten players at the table, or a spectator. */
export interface MafiaMemberDTO {
  /** Public id (never the private client id). Same as `playerId` in the game view. */
  id: string;
  name: string;
  color: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  spectator: boolean;
}

/** "lobby": gathering players. "playing": a game is running or just finished (see `game.result`). */
export type MafiaRoomStatus = "lobby" | "playing";

export interface MafiaRoomStateDTO {
  id: string;
  status: MafiaRoomStatus;
  /** Players needed at this table (6–12, 10 is official). */
  tableSize: number;
  members: MafiaMemberDTO[];
  you: string;
  /** Server clock when this state was made: clients use it to show timers without clock skew. */
  serverNow: number;
  /** Present while playing; computed for the viewer only. */
  game: MafiaView | null;
}

export type MafiaJoinAck =
  { ok: true; state: MafiaRoomStateDTO } | { ok: false; error: "not_found" | "invalid" | "banned" };

export type MafiaRoomError = "not_host" | "not_ready" | "wrong_status" | "invalid";
export type MafiaRoomResult = { ok: true } | { ok: false; error: MafiaRoomError };

type Ack<T> = (result: T) => void;

export interface MafiaClientToServerEvents {
  "mafia:join": (payload: MafiaJoinPayload, ack: Ack<MafiaJoinAck>) => void;
  "mafia:ready": (
    payload: z.input<typeof MafiaReadyPayloadSchema>,
    ack: Ack<MafiaRoomResult>,
  ) => void;
  "mafia:start": (ack: Ack<MafiaRoomResult>) => void;
  "mafia:rematch": (ack: Ack<MafiaRoomResult>) => void;
  "mafia:pass": (ack: Ack<MafiaActionResult>) => void;
  "mafia:nominate": (
    payload: z.input<typeof NominatePayloadSchema>,
    ack: Ack<MafiaActionResult>,
  ) => void;
  "mafia:vote": (payload: z.input<typeof VotePayloadSchema>, ack: Ack<MafiaActionResult>) => void;
  "mafia:lift-all": (
    payload: z.input<typeof LiftAllPayloadSchema>,
    ack: Ack<MafiaActionResult>,
  ) => void;
  "mafia:shoot": (payload: z.input<typeof ShootPayloadSchema>, ack: Ack<MafiaActionResult>) => void;
  "mafia:check": (payload: z.input<typeof CheckPayloadSchema>, ack: Ack<MafiaActionResult>) => void;
  "mafia:best-move": (
    payload: z.input<typeof BestMovePayloadSchema>,
    ack: Ack<MafiaActionResult>,
  ) => void;
  "mafia:say": (payload: z.input<typeof SayPayloadSchema>, ack: Ack<MafiaActionResult>) => void;
  /** Host only: remove someone (and keep them out with `ban`). */
  "mafia:kick": (
    payload: z.input<typeof MafiaKickPayloadSchema>,
    ack: Ack<MafiaRoomResult>,
  ) => void;
  "mafia:transfer-host": (
    payload: z.input<typeof MafiaPlayerTargetSchema>,
    ack: Ack<MafiaRoomResult>,
  ) => void;
  /** Host only, during a game (6.3). */
  "mafia:foul": (payload: z.input<typeof FoulPayloadSchema>, ack: Ack<MafiaRoomResult>) => void;
}

export interface MafiaServerToClientEvents {
  /** Full state for this viewer, sent after every change that concerns them. */
  "mafia:state": (state: MafiaRoomStateDTO) => void;
  "mafia:kicked": (reason: "other-tab" | "host" | "banned") => void;
}
