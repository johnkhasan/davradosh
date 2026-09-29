import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Env } from "./env";
import { healthRoutes, type HealthCheck } from "./routes/health";

export interface AppDeps {
  env: Pick<Env, "NODE_ENV" | "CORS_ORIGINS">;
  checkDb: HealthCheck;
}

export async function buildApp({ env, checkDb }: AppDeps) {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test" ? false : { level: env.NODE_ENV === "production" ? "info" : "debug" },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true });
  await app.register(healthRoutes, { checkDb });

  return app;
}
