import { describe, expect, it } from "vitest";
import { isPlayerColor, PLAYER_COLORS } from "./colors";
import { AVATAR_EMOJIS, randomAvatar, randomUsername } from "./names";

describe("randomUsername", () => {
  it("builds a two-word name", () => {
    expect(randomUsername(() => 0)).toBe("Chaqqon Tulki");
    expect(randomUsername(() => 0.999).split(" ")).toHaveLength(2);
  });
});

describe("randomAvatar", () => {
  it("returns one of the avatar emojis", () => {
    expect(AVATAR_EMOJIS).toContain(randomAvatar());
  });
});

describe("isPlayerColor", () => {
  it("accepts palette colors only", () => {
    expect(isPlayerColor(PLAYER_COLORS[0])).toBe(true);
    expect(isPlayerColor("#000000")).toBe(false);
  });
});
