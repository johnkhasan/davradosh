import { describe, expect, it } from "vitest";
import { JoinPayloadSchema, sanitizeName, UsernameSchema } from "./protocol";

describe("sanitizeName", () => {
  it("strips control characters, angle brackets and extra whitespace", () => {
    expect(sanitizeName("  Aziz\u0000  <b>Karimov</b>​ ")).toBe("Aziz bKarimov/b");
  });
});

describe("UsernameSchema", () => {
  it("accepts normal names and rejects too short or too long ones", () => {
    expect(UsernameSchema.parse("  Malika ")).toBe("Malika");
    expect(UsernameSchema.safeParse("A").success).toBe(false);
    expect(UsernameSchema.safeParse("x".repeat(21)).success).toBe(false);
  });
});

describe("JoinPayloadSchema", () => {
  it("validates a join request", () => {
    const ok = JoinPayloadSchema.safeParse({
      roomId: "k7xP2a9Q",
      clientId: "client_123456",
      name: "Jasur",
      color: "#6C5CE7",
      avatar: "🦊",
    });
    expect(ok.success).toBe(true);
    const bad = JoinPayloadSchema.safeParse({
      roomId: "../etc",
      clientId: "x",
      name: "Jasur",
      color: "red",
      avatar: "",
    });
    expect(bad.success).toBe(false);
  });
});
