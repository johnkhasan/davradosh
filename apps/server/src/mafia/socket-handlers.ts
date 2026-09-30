import {
  BestMovePayloadSchema,
  CheckPayloadSchema,
  FoulPayloadSchema,
  MafiaKickPayloadSchema,
  MafiaPlayerTargetSchema,
  SayPayloadSchema,
  LiftAllPayloadSchema,
  MafiaJoinPayloadSchema,
  MafiaReadyPayloadSchema,
  NominatePayloadSchema,
  ShootPayloadSchema,
  VotePayloadSchema,
  type MafiaActionResult,
  type MafiaClientToServerEvents,
  type MafiaServerToClientEvents,
} from "@puzzle/shared/mafia";
import type { FastifyBaseLogger } from "fastify";
import type { Namespace, Socket } from "socket.io";
import type { z } from "zod";
import { TokenBucket } from "../lib/rate-limit";
import type { MafiaGame } from "./game";
import type { MafiaRoomManager } from "./mafia-manager";
import type { MafiaRoomEmitter } from "./mafia-room";

interface SocketData {
  roomId?: string;
  playerId?: string;
}

export type MafiaNamespace = Namespace<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type MafiaSocket = Socket<
  MafiaClientToServerEvents,
  MafiaServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** States always go to one socket at a time: views differ per person, so nothing is broadcast. */
export function createMafiaEmitter(nsp: MafiaNamespace): MafiaRoomEmitter {
  return { state: (socketId, state) => nsp.to(socketId).emit("mafia:state", state) };
}

const invalidAction: MafiaActionResult = { ok: false, error: "not_a_player" };

/** Wires the validated, rate-limited "/mafia" namespace to mafia rooms. */
export function registerMafiaHandlers(
  nsp: MafiaNamespace,
  manager: MafiaRoomManager,
  logger: FastifyBaseLogger,
) {
  nsp.on("connection", (socket: MafiaSocket) => {
    // Mafia is turn based: a few actions a second is plenty.
    const bucket = new TokenBucket(20, 5);

    const parse = <T extends z.ZodType>(schema: T, payload: unknown): z.output<T> | null => {
      if (!bucket.take()) return null;
      const result = schema.safeParse(payload);
      return result.success ? result.data : null;
    };

    const current = async () => {
      const { roomId, playerId } = socket.data;
      if (!roomId || !playerId) return null;
      const room = await manager.get(roomId);
      if (!room || !room.isCurrentSocket(playerId, socket.id)) return null;
      return { room, playerId };
    };

    socket.on("mafia:join", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(MafiaJoinPayloadSchema, payload);
      if (!data) return ack({ ok: false, error: "invalid" });
      const room = await manager.get(data.roomId);
      if (!room) return ack({ ok: false, error: "not_found" });
      const result = room.join(data, socket.id);
      if (!result.ok) return ack(result);
      if (result.replacedSocketId && result.replacedSocketId !== socket.id) {
        // The same person opened the room in another tab: the new tab wins.
        const old = nsp.sockets.get(result.replacedSocketId);
        old?.emit("mafia:kicked", "other-tab");
        old?.disconnect(true);
      }
      socket.data.roomId = data.roomId;
      socket.data.playerId = result.state.you;
      ack({ ok: true, state: result.state });
      logger.info({ roomId: data.roomId, playerId: result.state.you }, "mafia member joined");
    });

    socket.on("mafia:ready", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(MafiaReadyPayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.setReady(ctx.playerId, data.ready) : { ok: false, error: "invalid" });
    });

    socket.on("mafia:start", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      if (!ctx) return ack({ ok: false, error: "invalid" });
      const result = ctx.room.start(ctx.playerId);
      if (result.ok) {
        logger.info({ roomId: ctx.room.id }, "mafia game started");
        void manager.save(ctx.room);
      }
      ack(result);
    });

    socket.on("mafia:rematch", async (ack) => {
      if (typeof ack !== "function") return;
      const ctx = bucket.take() && (await current());
      ack(ctx ? ctx.room.rematch(ctx.playerId) : { ok: false, error: "invalid" });
    });

    /** One handler per game action: validate, find the room, run it. */
    const action = <T extends z.ZodType>(
      schema: T | null,
      run: (game: MafiaGame, playerId: string, data: z.output<T>, now: number) => MafiaActionResult,
    ) => {
      return async (...args: unknown[]) => {
        const ack = args.at(-1);
        if (typeof ack !== "function") return;
        const data = schema ? parse(schema, args[0]) : bucket.take() ? ({} as z.output<T>) : null;
        const ctx = data !== null && (await current());
        if (!ctx) return ack(invalidAction);
        ack(ctx.room.act(ctx.playerId, (game, now) => run(game, ctx.playerId, data, now)));
      };
    };

    socket.on(
      "mafia:pass",
      action(null, (game, id, _data, now) => game.pass(id, now)),
    );
    socket.on(
      "mafia:nominate",
      action(NominatePayloadSchema, (game, id, data) => game.nominate(id, data.seat)),
    );
    socket.on(
      "mafia:vote",
      action(VotePayloadSchema, (game, id, data) => game.vote(id, data.seat)),
    );
    socket.on(
      "mafia:lift-all",
      action(LiftAllPayloadSchema, (game, id, data) => game.liftAll(id, data.agree)),
    );
    socket.on(
      "mafia:shoot",
      action(ShootPayloadSchema, (game, id, data) => game.shoot(id, data.seat)),
    );
    socket.on(
      "mafia:check",
      action(CheckPayloadSchema, (game, id, data) => game.check(id, data.seat)),
    );
    socket.on(
      "mafia:best-move",
      action(BestMovePayloadSchema, (game, id, data) => game.bestMove(id, data.seats)),
    );

    // Typed speech gets its own budget: a burst of 5, then one message a second.
    const talk = new TokenBucket(5, 1);
    socket.on("mafia:say", async (payload, ack) => {
      if (typeof ack !== "function") return;
      if (!talk.take()) return ack({ ok: false, error: "not_allowed" });
      const data = parse(SayPayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack(invalidAction);
      ack(ctx.room.act(ctx.playerId, (game) => game.say(ctx.playerId, data.text)));
    });

    // ------------------------------------------------------------ host tools

    socket.on("mafia:kick", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(MafiaKickPayloadSchema, payload);
      const ctx = data && (await current());
      if (!ctx) return ack({ ok: false, error: "invalid" });
      const result = ctx.room.kick(ctx.playerId, data.playerId, data.ban);
      if (!result.ok) return ack(result);
      if (result.socketId) {
        const target = nsp.sockets.get(result.socketId);
        target?.emit("mafia:kicked", data.ban ? "banned" : "host");
        target?.disconnect(true);
      }
      logger.info(
        { roomId: ctx.room.id, target: data.playerId, ban: data.ban },
        "mafia member kicked",
      );
      void manager.save(ctx.room);
      ack({ ok: true });
    });

    socket.on("mafia:transfer-host", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(MafiaPlayerTargetSchema, payload);
      const ctx = data && (await current());
      ack(
        ctx ? ctx.room.transferHost(ctx.playerId, data.playerId) : { ok: false, error: "invalid" },
      );
    });

    socket.on("mafia:foul", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const data = parse(FoulPayloadSchema, payload);
      const ctx = data && (await current());
      ack(ctx ? ctx.room.foul(ctx.playerId, data.seat) : { ok: false, error: "invalid" });
    });

    socket.on("disconnect", async () => {
      const ctx = await current();
      ctx?.room.disconnect(ctx.playerId, socket.id);
    });
  });
}
