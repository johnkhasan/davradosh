import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("treats empty values as unset and enables voice only with all LiveKit keys", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: "",
      LIVEKIT_URL: "",
      UNSPLASH_ACCESS_KEY: "",
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.LIVEKIT_URL).toBeUndefined();
    expect(env.MAX_PLAYERS_PER_ROOM).toBe(5);
  });

  it("caps players per room at 5 and requires a database in production", () => {
    expect(() => loadEnv({ NODE_ENV: "test", MAX_PLAYERS_PER_ROOM: "6" })).toThrow();
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });
});
