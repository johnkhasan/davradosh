export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ASPECTS = {
  original: { label: "Asl", ratio: null },
  "4:3": { label: "4:3", ratio: 4 / 3 },
  "3:4": { label: "3:4", ratio: 3 / 4 },
  "16:9": { label: "16:9", ratio: 16 / 9 },
  "1:1": { label: "1:1", ratio: 1 },
} as const;
export type AspectKey = keyof typeof ASPECTS;

/** Largest centred rectangle of the given aspect ratio inside the image, shrunk by `zoom`. */
export function fitCrop(imageW: number, imageH: number, ratio: number | null, zoom = 1): CropRect {
  const r = ratio ?? imageW / imageH;
  let width = imageW;
  let height = width / r;
  if (height > imageH) {
    height = imageH;
    width = height * r;
  }
  width /= zoom;
  height /= zoom;
  return { x: (imageW - width) / 2, y: (imageH - height) / 2, width, height };
}

export function clampCrop(rect: CropRect, imageW: number, imageH: number): CropRect {
  return {
    ...rect,
    x: Math.min(Math.max(0, rect.x), imageW - rect.width),
    y: Math.min(Math.max(0, rect.y), imageH - rect.height),
  };
}

/** Renders the crop at most `maxSide` px and encodes it (WebP when supported, else JPEG). */
export async function exportCrop(
  source: CanvasImageSource,
  rect: CropRect,
  maxSide = 2048,
): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(rect.width, rect.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode("image/webp", 0.9);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.9);
  if (!jpeg) throw new Error("Could not encode image");
  return jpeg;
}
