import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

const env = { NODE_ENV: "test" as const, CORS_ORIGINS: ["http://localhost:3000"] };

describe("GET /health", () => {
  it("returns ok when the database responds", async () => {
    const app = await buildApp({ env, checkDb: async () => true });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", db: true });
    await app.close();
  });

  it("returns 503 when the database is unreachable", async () => {
    const app = await buildApp({
      env,
      checkDb: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: "degraded", db: false });
    await app.close();
  });
});
