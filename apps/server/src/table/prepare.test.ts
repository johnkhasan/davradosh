import type { ImageDTO } from "@puzzle/shared";
import { describe, expect, it } from "vitest";
import { createPrepareOptions } from "./prepare";

const images: Record<string, ImageDTO> = {
  "picsum-10": {
    id: "picsum-10",
    source: "unsplash",
    url: "http://localhost/uploads/picsum-10.webp",
    thumbUrl: "http://localhost/uploads/picsum-10-thumb.jpg",
    width: 2048,
    height: 1365,
    credit: "Someone / Unsplash",
  },
  demo: { id: "demo", source: "demo", url: "", width: 1600, height: 1200 },
};

const prepare = createPrepareOptions({ getImage: async (id) => images[id] ?? null });

describe("createPrepareOptions", () => {
  it("stores the race image itself", async () => {
    expect(await prepare("race", { imageId: "picsum-10", pieces: 100 })).toEqual({
      image: {
        id: "picsum-10",
        url: "http://localhost/uploads/picsum-10.webp",
        thumbUrl: "http://localhost/uploads/picsum-10-thumb.jpg",
        width: 2048,
        height: 1365,
        credit: "Someone / Unsplash",
      },
      pieces: 100,
    });
  });

  it("refuses unknown and demo images", async () => {
    expect(await prepare("race", { imageId: "missing", pieces: 48 })).toBeNull();
    expect(await prepare("race", { imageId: "demo", pieces: 48 })).toBeNull();
    expect(await prepare("race", { pieces: 48 })).toBeNull();
  });

  it("keeps other games' options as they are", async () => {
    expect(await prepare("chess", { clock: 300 })).toEqual({ clock: 300 });
  });
});
