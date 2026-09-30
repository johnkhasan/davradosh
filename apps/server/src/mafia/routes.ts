import { RoomIdSchema } from "@puzzle/shared";
import { CreateMafiaRoomSchema } from "@puzzle/shared/mafia";
import type { FastifyInstance } from "fastify";
import type { MafiaRoomManager } from "./mafia-manager";

export async function mafiaRoutes(app: FastifyInstance, opts: { manager: MafiaRoomManager }) {
  app.post(
    "/api/mafia/rooms",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = CreateMafiaRoomSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid" });
      const id = await opts.manager.create(parsed.data.clientId);
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
