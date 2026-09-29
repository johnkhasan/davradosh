import { createRandom } from "@puzzle/shared";

/** Longest side of the image used for pieces (world units = pixels of this image). */
export const MAX_IMAGE_SIDE = 2048;

export type PuzzleImage = HTMLCanvasElement;

/** Loads a user file and downsizes it to at most MAX_IMAGE_SIDE on its longest side. */
export async function loadImageFile(file: File): Promise<PuzzleImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/**
 * Colourful procedural landscape used by the playground, so the engine can be
 * tried without uploading anything. Varied enough to be solvable.
 */
export function createDemoImage(width = 1600, height = 1200, seed = 7): PuzzleImage {
  const random = createRandom(seed);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7);
  sky.addColorStop(0, "#2b1b67");
  sky.addColorStop(0.45, "#c2477a");
  sky.addColorStop(1, "#ffb86b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.6})`;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height * 0.4, random() * 2.4 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const sunX = width * 0.68;
  const sunY = height * 0.46;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, height * 0.4);
  glow.addColorStop(0, "rgba(255,236,170,0.95)");
  glow.addColorStop(0.25, "rgba(255,196,120,0.55)");
  glow.addColorStop(1, "rgba(255,160,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff1c7";
  ctx.beginPath();
  ctx.arc(sunX, sunY, height * 0.09, 0, Math.PI * 2);
  ctx.fill();

  const layers = ["#7a3b78", "#5a2d6e", "#3d235e", "#261847", "#170f30"];
  layers.forEach((color, index) => {
    const base = height * (0.5 + index * 0.1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    let x = 0;
    ctx.lineTo(0, base);
    while (x < width) {
      const step = 60 + random() * 160;
      const peak = base - (40 + random() * 170) * (1 - index * 0.12);
      ctx.lineTo(x + step / 2, peak);
      x += step;
      ctx.lineTo(x, base - random() * 30);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  });

  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = height * (0.82 + random() * 0.16);
    const h = 40 + random() * 90;
    ctx.fillStyle = "#0d0920";
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - h * 0.28, y);
    ctx.lineTo(x + h * 0.28, y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `700 ${Math.round(height * 0.085)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Birga yig'amiz", width * 0.3, height * 0.2);
  return canvas;
}

/**
 * Loads a room image at exactly the size the server uses for piece geometry,
 * so every client renders identical pieces.
 */
export async function loadRoomImage(
  image: { source: string; url: string; width: number; height: number },
  seed: number,
): Promise<PuzzleImage> {
  if (image.source === "demo") return createDemoImage(image.width, image.height, seed);
  const element = new Image();
  element.crossOrigin = "anonymous";
  element.decoding = "async";
  element.src = image.url;
  await element.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(element, 0, 0, image.width, image.height);
  return canvas;
}
