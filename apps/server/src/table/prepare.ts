import type { TableGameKind } from "@puzzle/shared/games";
import { RaceOptionsSchema, type RacePreparedOptions } from "@puzzle/shared/games/race";
import type { RoomRepository } from "../rooms/repository";

/**
 * Server-side work some games need before a room exists, after the engine's optionsSchema
 * accepted the options (for example looking up an image). Returns the options to store, or
 * null to refuse the room.
 */
export type PrepareOptions = (kind: TableGameKind, options: unknown) => Promise<unknown | null>;

export const keepOptions: PrepareOptions = async (_kind, options) => options;

/**
 * Puzzle race: the client names an uploaded or imported image; the room stores the image
 * itself (url and size), so every racer cuts the very same picture.
 */
export function createPrepareOptions(images: Pick<RoomRepository, "getImage">): PrepareOptions {
  return async (kind, options) => {
    if (kind !== "race") return options;
    const parsed = RaceOptionsSchema.safeParse(options);
    if (!parsed.success) return null;
    const image = await images.getImage(parsed.data.imageId);
    // Demo pictures are drawn on the client and have no URL to share.
    if (!image || image.source === "demo" || !image.url) return null;
    const prepared: RacePreparedOptions = {
      image: {
        id: image.id,
        url: image.url,
        thumbUrl: image.thumbUrl || undefined,
        width: image.width,
        height: image.height,
        credit: image.credit ?? null,
      },
      pieces: parsed.data.pieces,
    };
    return prepared;
  };
}
