import { describe, expect, it } from "vitest";
import { parseOrigins } from "./origins";

describe("parseOrigins", () => {
  it("keeps exact origins and turns wildcards into strict regexes", () => {
    const [exact, preview] = parseOrigins([
      "https://puzzle.javohir.ru",
      "https://puzzle-game-*-johnkhasan.vercel.app",
    ]);
    expect(exact).toBe("https://puzzle.javohir.ru");
    const regex = preview as RegExp;
    expect(regex.test("https://puzzle-game-abc123-johnkhasan.vercel.app")).toBe(true);
    expect(regex.test("https://puzzle-game-x.evil.com-johnkhasan.vercel.app")).toBe(false);
    expect(regex.test("https://evil.com/https://puzzle-game-a-johnkhasan.vercel.app")).toBe(false);
  });
});
