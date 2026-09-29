export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 4;

/** 2D camera: screen = world * zoom + (x, y). */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  toWorld(screenX: number, screenY: number) {
    return { x: (screenX - this.x) / this.zoom, y: (screenY - this.y) / this.zoom };
  }

  toScreen(worldX: number, worldY: number) {
    return { x: worldX * this.zoom + this.x, y: worldY * this.zoom + this.y };
  }

  pan(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  /** Zooms by `factor` keeping the world point under (screenX, screenY) fixed. */
  zoomAt(screenX: number, screenY: number, factor: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const applied = next / this.zoom;
    this.x = screenX - (screenX - this.x) * applied;
    this.y = screenY - (screenY - this.y) * applied;
    this.zoom = next;
  }

  /** Fits a world rectangle into the viewport with some padding. */
  fit(
    rect: { x: number; y: number; width: number; height: number },
    viewport: { width: number; height: number },
    padding = 48,
  ) {
    const zoom = Math.min(
      (viewport.width - padding * 2) / rect.width,
      (viewport.height - padding * 2) / rect.height,
    );
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.x = viewport.width / 2 - (rect.x + rect.width / 2) * this.zoom;
    this.y = viewport.height / 2 - (rect.y + rect.height / 2) * this.zoom;
  }

  get state(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }
}
