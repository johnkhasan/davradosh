import { RoomIdSchema } from "@puzzle/shared";
import { CreateTableRoomSchema } from "@puzzle/shared/games";
import type { FastifyInstance } from "fastify";
import { keepOptions, type PrepareOptions } from "./prepare";
import { ENGINES } from "./registry";
import type { TableRoomManager } from "./table-manager";

export async function tableRoutes(
  app: FastifyInstance,
  opts: { manager: TableRoomManager; prepareOptions?: PrepareOptions },
) {
  const prepare = opts.prepareOptions ?? keepOptions;

  app.post(
    "/api/table/rooms",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = CreateTableRoomSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid" });
      const { kind, clientId } = parsed.data;
      const options = ENGINES[kind].optionsSchema.safeParse(parsed.data.options ?? {});
      if (!options.success) return reply.code(400).send({ error: "invalid_options" });
      const prepared = await prepare(kind, options.data);
      if (prepared === null) return reply.code(400).send({ error: "invalid_options" });
      const id = await opts.manager.create(clientId, kind, prepared);
      return reply.code(201).send({ id, kind });
    },
  );

  /** Public numbers for link previews and the join page. Never anything hidden. */
  app.get<{ Params: { id: string } }>("/api/table/rooms/:id", async (request, reply) => {
    const id = RoomIdSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(404).send({ error: "not_found" });
    const room = await opts.manager.peek(id.data);
    if (!room) return reply.code(404).send({ error: "not_found" });
    return room;
  });
}
