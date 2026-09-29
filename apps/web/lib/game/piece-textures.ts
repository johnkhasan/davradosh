import type { PathCommand, PieceShape } from "@puzzle/shared";

/** Extra canvas margin around the piece outline for the bevel stroke. */
export const PIECE_PADDING = 3;
/** Shadow textures are rendered at reduced resolution and scaled up (they are blurry anyway). */
export const SHADOW_SCALE = 0.5;

export function tracePath(ctx: CanvasRenderingContext2D, path: PathCommand[], dx = 0, dy = 0) {
  ctx.beginPath();
  for (const cmd of path) {
    if (cmd.type === "M") ctx.moveTo(cmd.x + dx, cmd.y + dy);
    else if (cmd.type === "L") ctx.lineTo(cmd.x + dx, cmd.y + dy);
    else
      ctx.bezierCurveTo(cmd.x1 + dx, cmd.y1 + dy, cmd.x2 + dx, cmd.y2 + dy, cmd.x + dx, cmd.y + dy);
  }
  ctx.closePath();
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

/**
 * Renders one piece: the image clipped to the outline, an embossed bevel
 * (light top-left, dark bottom-right) and a hairline outline.
 */
export function renderPieceCanvas(
  image: CanvasImageSource,
  piece: PieceShape,
  pieceWidth: number,
  pieceHeight: number,
): HTMLCanvasElement {
  const { bounds } = piece;
  const canvas = createCanvas(bounds.width + PIECE_PADDING * 2, bounds.height + PIECE_PADDING * 2);
  const ctx = canvas.getContext("2d")!;
  // Local piece coordinates → canvas coordinates.
  const dx = PIECE_PADDING - bounds.x;
  const dy = PIECE_PADDING - bounds.y;
  const size = Math.min(pieceWidth, pieceHeight);
  const bevel = Math.max(1.5, size * 0.035);

  ctx.save();
  tracePath(ctx, piece.path, dx, dy);
  ctx.clip();
  // Source rectangle in image space that corresponds to the canvas area.
  const sx = piece.col * pieceWidth + bounds.x - PIECE_PADDING;
  const sy = piece.row * pieceHeight + bounds.y - PIECE_PADDING;
  ctx.drawImage(image, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

  ctx.lineJoin = "round";
  ctx.lineWidth = bevel * 2;
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  tracePath(ctx, piece.path, dx + bevel * 0.6, dy + bevel * 0.6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  tracePath(ctx, piece.path, dx - bevel * 0.6, dy - bevel * 0.6);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  tracePath(ctx, piece.path, dx, dy);
  ctx.stroke();
  return canvas;
}

export interface ShadowCanvas {
  canvas: HTMLCanvasElement;
  /** Offset of the canvas top-left from the piece canvas top-left, in world units. */
  offsetX: number;
  offsetY: number;
}

/** Soft drop shadow silhouette for one piece. */
export function renderShadowCanvas(
  piece: PieceShape,
  pieceWidth: number,
  pieceHeight: number,
): ShadowCanvas {
  const { bounds } = piece;
  const blur = Math.min(pieceWidth, pieceHeight) * 0.08;
  const margin = blur * 2;
  const s = SHADOW_SCALE;
  const canvas = createCanvas((bounds.width + margin * 2) * s, (bounds.height + margin * 2) * s);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(s, s);

  // Draw the shape far off-canvas and let only its shadow land on the canvas;
  // this works in every browser (unlike ctx.filter).
  const far = 10_000;
  ctx.shadowColor = "rgba(20,14,40,0.55)";
  ctx.shadowBlur = blur * s;
  ctx.shadowOffsetX = far * s;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "#000";
  tracePath(ctx, piece.path, margin - bounds.x - far, margin - bounds.y);
  ctx.fill();

  return { canvas, offsetX: PIECE_PADDING - margin, offsetY: PIECE_PADDING - margin };
}
