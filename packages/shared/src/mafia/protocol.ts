import { z } from "zod";
import { BEST_MOVE_SIZE, MAFIA_PLAYERS } from "./rules";

export const SeatSchema = z.number().int().min(1).max(MAFIA_PLAYERS);

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

export type MafiaActionError =
  | "wrong_phase"
  | "not_a_player"
  | "dead"
  | "not_your_turn"
  | "not_allowed"
  | "invalid_target"
  | "already_done";

export type MafiaActionResult = { ok: true } | { ok: false; error: MafiaActionError };
