import { AvatarSchema, ClientIdSchema, ColorSchema, UsernameSchema } from "@puzzle/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DAY_PATTERN } from "./day";
import type { DailyService } from "./service";

const Day = z.string().regex(DAY_PATTERN);
const StartBody = z.object({ clientId: ClientIdSchema, day: Day.optional() });
const ResultBody = z.object({
  clientId: ClientIdSchema,
  name: UsernameSchema,
  color: ColorSchema,
  avatar: AvatarSchema,
  ms: z.number().int().positive(),
  day: Day.optional(),
});
const LeaderboardQuery = z.object({ day: Day.optional(), clientId: ClientIdSchema.optional() });

/** The daily puzzle: one picture and cut for everyone each day, and a leaderboard of times. */
export async function dailyRoutes(app: FastifyInstance, opts: { daily: DailyService }) {
  const { daily } = opts;

  app.get(
    "/api/daily",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const puzzle = await daily.puzzle();
        reply.header("cache-control", "no-store");
        return puzzle;
      } catch (error) {
        request.log.warn({ err: error }, "daily puzzle unavailable");
        return reply.code(502).send({ error: "daily_unavailable" });
      }
    },
  );

  app.post(
    "/api/daily/start",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = StartBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid" });
      const started = daily.start(body.data.clientId, body.data.day);
      if (!started) return reply.code(400).send({ error: "wrong_day" });
      return started;
    },
  );

  app.post(
    "/api/daily/result",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = ResultBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid" });
      const result = await daily.submit(body.data);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return result;
    },
  );

  app.get(
    "/api/daily/leaderboard",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const query = LeaderboardQuery.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: "invalid" });
      reply.header("cache-control", "no-store");
      return daily.leaderboard(query.data.day, query.data.clientId);
    },
  );
}
