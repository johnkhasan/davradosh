import { CreateRoomSchema, RoomCodeSchema, RoomIdSchema } from "@puzzle/shared";
import type { FastifyInstance } from "fastify";
import type { RoomManager } from "../rooms/room-manager";

export async function roomRoutes(app: FastifyInstance, opts: { manager: RoomManager }) {
  app.post("/api/rooms", async (request, reply) => {
    const parsed = CreateRoomSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid", issues: parsed.error.issues });
    const room = await opts.manager.create(parsed.data);
    if (!room) return reply.code(404).send({ error: "image_not_found" });
    const { fromRoomId, clientId } = parsed.data;
    if (fromRoomId) opts.manager.moveOn(fromRoomId, clientId, room.id);
    return reply.code(201).send({ id: room.id, code: room.code });
  });

  // Rate limited: with only 10 000 codes, guessing must stay slow.
  app.get<{ Params: { code: string } }>(
    "/api/rooms/code/:code",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const code = RoomCodeSchema.safeParse(request.params.code);
      if (!code.success) return reply.code(404).send({ error: "not_found" });
      const id = await opts.manager.findByCode(code.data);
      if (!id) return reply.code(404).send({ error: "not_found" });
      return { id };
    },
  );

  app.get<{ Params: { id: string } }>("/api/rooms/:id", async (request, reply) => {
    const id = RoomIdSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(404).send({ error: "not_found" });
    const room = await opts.manager.peek(id.data);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return {
      id: room.info.id,
      code: room.info.code,
      pieces: room.info.cols * room.info.rows,
      image: room.info.image,
      status: room.info.status,
      players: room.players,
      maxPlayers: room.info.maxPlayers,
      full: room.players >= room.info.maxPlayers,
    };
  });
}
