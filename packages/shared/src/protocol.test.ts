import { describe, expect, it } from "vitest";
import { ChatPayloadSchema, JoinPayloadSchema, sanitizeName, UsernameSchema } from "./protocol";

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

describe("ChatPayloadSchema", () => {
  it("cleans and limits chat text", () => {
    expect(ChatPayloadSchema.parse({ text: "  Salom\u0000‮   hammaga \n " }).text).toBe(
      "Salom hammaga",
    );
    expect(ChatPayloadSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(ChatPayloadSchema.safeParse({ text: "x".repeat(301) }).success).toBe(false);
    // Markup is kept as plain text (React escapes it when rendering).
    expect(ChatPayloadSchema.parse({ text: "<b>hi</b>" }).text).toBe("<b>hi</b>");
  });
});
