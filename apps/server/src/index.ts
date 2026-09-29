import { buildApp } from "./app";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { createSocketServer } from "./socket";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const app = await buildApp({
  env,
  checkDb: async () => {
    await db.$queryRaw`SELECT 1`;
    return true;
  },
});

const io = createSocketServer(app.server, { corsOrigins: env.CORS_ORIGINS, logger: app.log });

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  io.close();
  await app.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: env.PORT, host: "0.0.0.0" });
