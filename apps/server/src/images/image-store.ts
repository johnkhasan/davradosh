import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2048;
const THUMB_WIDTH = 480;
/** Refuse decompression bombs: 50 megapixels is far above any real photo we need. */
const MAX_INPUT_PIXELS = 50_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

export interface StoredImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export class InvalidImageError extends Error {}

/**
 * Re-encodes untrusted images: applies EXIF orientation, strips all metadata
 * (GPS etc.), limits the size and writes WebP files named by our own id.
 */
export class ImageStore {
  constructor(
    private readonly dir: string,
    private readonly publicUrl: string,
  ) {}

  async save(id: string, input: Buffer): Promise<StoredImage> {
    let metadata: Metadata;
    try {
      metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch {
      throw new InvalidImageError("Unsupported or corrupted image");
    }
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      throw new InvalidImageError(`Unsupported format: ${metadata.format ?? "unknown"}`);
    }

    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false }).rotate();
    const { data, info } = await base
      .clone()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (info.width < 200 || info.height < 200) throw new InvalidImageError("Image is too small");
    // JPEG thumbnails: also used by link-preview renderers that cannot decode WebP.
    const thumb = await base
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    await mkdir(this.dir, { recursive: true });
    await Promise.all([
      writeFile(path.join(this.dir, `${id}.webp`), data),
      writeFile(path.join(this.dir, `${id}_thumb.jpg`), thumb),
    ]);

    return {
      id,
      url: `${this.publicUrl}/${id}.webp`,
      thumbUrl: `${this.publicUrl}/${id}_thumb.jpg`,
      width: info.width,
      height: info.height,
    };
  }
}
