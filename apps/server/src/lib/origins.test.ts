import { describe, expect, it } from "vitest";
import { parseOrigins } from "./origins";

describe("parseOrigins", () => {
  it("keeps exact origins and turns wildcards into strict regexes", () => {
    const [exact, preview] = parseOrigins([
      "https://puzzle.javohir.ru",
      "https://davradosh-*-johnkhasan.vercel.app",
    ]);
    expect(exact).toBe("https://puzzle.javohir.ru");
    const regex = preview as RegExp;
    expect(regex.test("https://davradosh-abc123-johnkhasan.vercel.app")).toBe(true);
    expect(regex.test("https://davradosh-x.evil.com-johnkhasan.vercel.app")).toBe(false);
    expect(regex.test("https://evil.com/https://davradosh-a-johnkhasan.vercel.app")).toBe(false);
  });
});
