import type { FastifyInstance } from "fastify";

export type HealthCheck = () => Promise<boolean>;

export async function healthRoutes(app: FastifyInstance, opts: { checkDb: HealthCheck }) {
  app.get("/health", async (_request, reply) => {
    const db = await opts.checkDb().catch(() => false);
    return reply.code(db ? 200 : 503).send({
      status: db ? "ok" : "degraded",
      db,
      uptime: Math.round(process.uptime()),
    });
  });
}
