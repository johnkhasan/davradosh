import "dotenv/config";
import { z } from "zod";
import { MAX_PLAYERS_PER_ROOM } from "@puzzle/shared";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  MAX_PLAYERS_PER_ROOM: z.coerce
    .number()
    .int()
    .min(2)
    .max(MAX_PLAYERS_PER_ROOM)
    .default(MAX_PLAYERS_PER_ROOM),
  UPLOAD_DIR: z.string().default("./uploads"),
  PUBLIC_UPLOAD_URL: z.string().url().default("http://localhost:4000/uploads"),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    console.error("Invalid environment variables:", z.treeifyError(parsed.error));
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
