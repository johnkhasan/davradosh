import { ClientIdSchema, RoomIdSchema } from "@puzzle/shared";
import { CreateMafiaRoomSchema } from "@puzzle/shared/mafia";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { publicPlayerId } from "../lib/ids";
import type { MafiaRoomManager } from "./mafia-manager";
import type { MafiaVoiceSync } from "./voice-sync";

const TokenBody = z.object({ clientId: ClientIdSchema });

export async function mafiaRoutes(
  app: FastifyInstance,
  opts: { manager: MafiaRoomManager; voice: MafiaVoiceSync | null },
) {
  /**
   * LiveKit tokens for a member who is connected to the room right now. Publishing rights
   * follow the phase; the night-room token only exists for the black team at the zero night.
   */
  app.post<{ Params: { id: string } }>(
    "/api/mafia/rooms/:id/rtc-token",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!opts.voice) return reply.code(503).send({ error: "voice_disabled" });
      const id = RoomIdSchema.safeParse(request.params.id);
      const body = TokenBody.safeParse(request.body);
      if (!id.success || !body.success) return reply.code(400).send({ error: "invalid" });
      const room = await opts.manager.get(id.data);
      if (!room) return reply.code(404).send({ error: "not_found" });
      const tokens = await opts.voice.tokens(room, publicPlayerId(body.data.clientId));
      if (!tokens) return reply.code(403).send({ error: "forbidden" });
      return tokens;
    },
  );

  app.post(
    "/api/mafia/rooms",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = CreateMafiaRoomSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid" });
      const id = await opts.manager.create(parsed.data.clientId, parsed.data.tableSize);
      return reply.code(201).send({ id });
    },
  );

  /** Public numbers for link previews and the join page. Never anything about roles. */
  app.get<{ Params: { id: string } }>("/api/mafia/rooms/:id", async (request, reply) => {
    const id = RoomIdSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(404).send({ error: "not_found" });
    const room = await opts.manager.peek(id.data);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
}
