import {
  flattenPath,
  generatePieceShapes,
  type GroupState,
  type PieceShape,
  type PuzzleState,
  type SnapResult,
} from "@puzzle/shared";
import { Application, ColorMatrixFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { OutlineFilter } from "pixi-filters";
import { Camera, type CameraState } from "./camera";
import {
  PIECE_PADDING,
  renderPieceCanvas,
  renderShadowCanvas,
  SHADOW_SCALE,
} from "./piece-textures";
import { haptic } from "./sounds";

export interface PuzzleViewOptions {
  host: HTMLElement;
  image: CanvasImageSource & { width: number; height: number };
  state: PuzzleState;
  seed: number;
  /** Asked before a drag starts; return false to refuse (e.g. locked by someone else). */
  onGrab?: (groupId: number) => boolean;
  onDrag?: (groupId: number, x: number, y: number) => void;
  onDrop?: (groupId: number, x: number, y: number) => void;
  /** Pointer position in world coordinates (for multiplayer cursors). */
  onPointerMove?: (x: number, y: number) => void;
  onCameraChange?: (camera: CameraState) => void;
  /** The user panned or zoomed (used to stop follow mode). */
  onUserCamera?: () => void;
}

interface PieceView {
  shape: PieceShape;
  sprite: Sprite;
  shadow: Sprite;
  /** Outline polygon in piece-canvas coordinates. */
  polygon: number[];
}

interface GroupView {
  container: Container;
  shadows: Container;
  pieces: Container;
  /** 0 = resting, 1 = lifted (being dragged). Animated towards `liftTarget`. */
  lift: number;
  liftTarget: number;
  tween?: { fromX: number; fromY: number; toX: number; toY: number; t: number; duration: number };
  flash?: { t: number; filter: ColorMatrixFilter };
  /** Outline in the colour of the remote player holding this group. */
  holder?: OutlineFilter;
}

interface DragState {
  pointerId: number;
  pointerType: string;
  groupId: number;
  offsetX: number;
  offsetY: number;
  /** Where the drag started and where the pointer is now, in screen pixels. */
  startX: number;
  startY: number;
  screenX: number;
  screenY: number;
}

interface PanState {
  pointerId: number;
  lastX: number;
  lastY: number;
  /** Set for a touch that may still turn out to be a tap (double-tap zoom). */
  tap?: { x: number; y: number; at: number };
}

const TWEEN_MS = 140;
const FLASH_MS = 320;

/** Touch input: fingers are imprecise, so a touch this close to a piece (screen px) still grabs it. */
const TOUCH_SLOP_PX = 24;
/** A drag this close to the screen edge (px) pans the camera, up to EDGE_PAN_SPEED px/s. */
const EDGE_PAN_PX = 56;
const EDGE_PAN_SPEED = 900;
/** Below this movement (px) a second finger cancels the grab instead of dropping the piece. */
const PINCH_CANCEL_PX = 12;
const TAP_MOVE_PX = 10;
const TAP_MS = 250;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 40;

/**
 * Renders a puzzle with PixiJS and turns pointer input into grab/drag/drop
 * callbacks. It never mutates the puzzle state itself: the owner applies
 * changes to `PuzzleState` and then calls `syncGroup` / `applySnap`.
 */
export class PuzzleView {
  readonly camera = new Camera();
  private readonly app: Application;
  private readonly opts: PuzzleViewOptions;
  private readonly world = new Container();
  private readonly board = new Graphics();
  private readonly ghost: Sprite;
  private readonly placedLayer = new Container();
  private readonly looseLayer = new Container();
  private readonly pieces: PieceView[] = [];
  private readonly groups = new Map<number, GroupView>();
  private readonly containerGroup = new WeakMap<Container, number>();
  private readonly textures: Texture[] = [];
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private readonly cleanup: Array<() => void> = [];
  private drag: DragState | null = null;
  private pan: PanState | null = null;
  private pinch: { distance: number; midX: number; midY: number } | null = null;
  private lastTap: { x: number; y: number; at: number } | null = null;
  private edgeFilter = false;
  private cameraTween: { from: CameraState; to: CameraState; t: number } | null = null;
  private spaceDown = false;
  private destroyed = false;

  private constructor(app: Application, opts: PuzzleViewOptions) {
    this.app = app;
    this.opts = opts;
    const ghostTexture = Texture.from(opts.image as HTMLCanvasElement);
    this.textures.push(ghostTexture);
    this.ghost = new Sprite(ghostTexture);
  }

  static async create(opts: PuzzleViewOptions): Promise<PuzzleView> {
    const app = new Application();
    await app.init({
      resizeTo: opts.host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      // Input is handled on the DOM element directly (see bindInput).
      eventMode: "none",
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
    });
    const view = new PuzzleView(app, opts);
    view.build();
    return view;
  }

  // ---------------------------------------------------------------- setup

  private build() {
    const { host, state } = this.opts;
    const { cols, rows, pieceWidth: pw, pieceHeight: ph } = state.config;
    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.style.display = "block";
    // No text selection or iOS long-press callout while holding a piece.
    canvas.style.userSelect = "none";
    canvas.style.setProperty("-webkit-user-select", "none");
    canvas.style.setProperty("-webkit-touch-callout", "none");
    host.appendChild(canvas);

    this.app.stage.addChild(this.world);
    this.world.addChild(this.board, this.ghost, this.placedLayer, this.looseLayer);

    const boardW = cols * pw;
    const boardH = rows * ph;
    this.board
      .roundRect(-6, -6, boardW + 12, boardH + 12, 10)
      .fill({ color: 0x000000, alpha: 0.14 })
      .roundRect(-6, -6, boardW + 12, boardH + 12, 10)
      .stroke({ color: 0xffffff, alpha: 0.35, width: 2 });
    this.ghost.width = boardW;
    this.ghost.height = boardH;
    this.ghost.alpha = 0.28;
    this.ghost.visible = false;

    const shapes = generatePieceShapes({
      cols,
      rows,
      pieceWidth: pw,
      pieceHeight: ph,
      seed: this.opts.seed,
    });
    for (const shape of shapes) {
      const pieceTexture = Texture.from(renderPieceCanvas(this.opts.image, shape, pw, ph));
      const shadowCanvas = renderShadowCanvas(shape, pw, ph);
      const shadowTexture = Texture.from(shadowCanvas.canvas);
      this.textures.push(pieceTexture, shadowTexture);

      const sprite = new Sprite(pieceTexture);
      sprite.position.set(
        shape.col * pw + shape.bounds.x - PIECE_PADDING,
        shape.row * ph + shape.bounds.y - PIECE_PADDING,
      );
      const shadow = new Sprite(shadowTexture);
      shadow.scale.set(1 / SHADOW_SCALE);
      shadow.position.set(sprite.x + shadowCanvas.offsetX, sprite.y + shadowCanvas.offsetY);

      const polygon = flattenPath(shape.path, 6);
      for (let i = 0; i < polygon.length; i += 2) {
        polygon[i]! -= shape.bounds.x - PIECE_PADDING;
        polygon[i + 1]! -= shape.bounds.y - PIECE_PADDING;
      }
      this.pieces.push({ shape, sprite, shadow, polygon });
    }

    for (const group of state.allGroups()) this.createGroupView(group);

    this.fitToContent();
    this.bindInput();
    this.app.ticker.add(this.tick);
  }

  private createGroupView(group: GroupState): GroupView {
    const container = new Container();
    const shadows = new Container();
    const pieces = new Container();
    container.addChild(shadows, pieces);
    const view: GroupView = { container, shadows, pieces, lift: 0, liftTarget: 0 };
    this.groups.set(group.id, view);
    this.containerGroup.set(container, group.id);
    this.attachPieces(view, group.pieceIds);
    container.position.set(group.x, group.y);
    (group.placed ? this.placedLayer : this.looseLayer).addChild(container);
    this.applyGroupStyle(group, view);
    return view;
  }

  private attachPieces(view: GroupView, pieceIds: number[]) {
    for (const pieceId of pieceIds) {
      const piece = this.pieces[pieceId]!;
      view.shadows.addChild(piece.shadow);
      view.pieces.addChild(piece.sprite);
    }
  }

  // ---------------------------------------------------------------- public API

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get fps(): number {
    return this.app.ticker.FPS;
  }

  setGhostVisible(visible: boolean) {
    this.ghost.visible = visible;
  }

  /** Dims and disables loose inner pieces so edge pieces stand out. */
  setEdgeFilter(enabled: boolean) {
    this.edgeFilter = enabled;
    for (const group of this.opts.state.allGroups()) {
      const view = this.groups.get(group.id);
      if (view) this.applyGroupStyle(group, view);
    }
  }

  /** Re-reads one group from the state (after a local or remote move). */
  syncGroup(groupId: number, opts: { animate?: boolean; duration?: number } = {}) {
    const group = this.opts.state.getGroup(groupId);
    const view = this.groups.get(groupId);
    if (!group || !view) return;
    if (opts.animate) this.tweenTo(view, group.x, group.y, opts.duration);
    else {
      view.tween = undefined;
      view.container.position.set(group.x, group.y);
    }
  }

  /** Rebuilds views after a merge reported by `PuzzleState.snap`. */
  applySnap(result: SnapResult) {
    const survivor = this.opts.state.getGroup(result.groupId);
    if (!survivor) return;
    let view = this.groups.get(result.groupId);
    if (!view) view = this.createGroupView(survivor);

    // Re-parent every piece sprite into the survivor first, then drop the empty containers.
    view.shadows.removeChildren();
    view.pieces.removeChildren();
    this.attachPieces(view, survivor.pieceIds);
    for (const absorbedId of result.absorbed) {
      const absorbed = this.groups.get(absorbedId);
      if (!absorbed) continue;
      this.destroyGroupView(absorbed);
      this.groups.delete(absorbedId);
    }

    if (survivor.placed && view.container.parent !== this.placedLayer) {
      this.placedLayer.addChild(view.container);
    }
    this.tweenTo(view, survivor.x, survivor.y);
    this.flash(view);
    this.applyGroupStyle(survivor, view);
  }

  /** Brings a group to the top and shows it lifted (e.g. grabbed by a remote player). */
  setLifted(groupId: number, lifted: boolean) {
    const view = this.groups.get(groupId);
    if (!view) return;
    view.liftTarget = lifted ? 1 : 0;
    if (lifted && view.container.parent === this.looseLayer) {
      this.looseLayer.addChild(view.container);
    }
  }

  /** Shows (or clears) the coloured outline of the remote player holding a group. */
  setHolder(groupId: number, color: string | null) {
    const view = this.groups.get(groupId);
    if (!view) return;
    if (color) {
      view.holder ??= new OutlineFilter({ thickness: 3, quality: 0.15 });
      view.holder.color = color;
    } else if (view.holder) {
      view.holder.destroy();
      view.holder = undefined;
    }
    this.updateFilters(view);
  }

  /** Aborts the local drag (e.g. the server refused the grab) and returns the group to its state position. */
  cancelDrag(groupId: number) {
    if (this.drag?.groupId !== groupId) {
      this.syncGroup(groupId, { animate: true });
      return;
    }
    this.drag = null;
    this.setLifted(groupId, false);
    this.syncGroup(groupId, { animate: true });
    this.app.canvas.style.cursor = "";
  }

  get draggingGroupId(): number | null {
    return this.drag?.groupId ?? null;
  }

  /** Recreates every group view from the state (after a full resync). */
  rebuild() {
    this.drag = null;
    for (const view of this.groups.values()) this.destroyGroupView(view);
    this.groups.clear();
    for (const group of this.opts.state.allGroups()) this.createGroupView(group);
    this.setEdgeFilter(this.edgeFilter);
  }

  fitToContent() {
    this.userCamera();
    const bounds = this.contentBounds();
    this.camera.fit(bounds, { width: this.app.screen.width, height: this.app.screen.height });
    this.applyCamera();
  }

  zoomBy(factor: number) {
    this.userCamera();
    this.camera.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, factor);
    this.applyCamera();
  }

  /** The world rectangle currently visible. */
  viewportRect() {
    const topLeft = this.camera.toWorld(0, 0);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: this.app.screen.width / this.camera.zoom,
      height: this.app.screen.height / this.camera.zoom,
    };
  }

  /** World rectangle containing the board and every piece. */
  worldBounds() {
    return this.contentBounds();
  }

  /** Smoothly shows the given world rectangle (follow mode). */
  lookAt(rect: { x: number; y: number; width: number; height: number }) {
    const target = new Camera();
    target.fit(rect, { width: this.app.screen.width, height: this.app.screen.height }, 0);
    this.cameraTween = { from: this.camera.state, to: target.state, t: 0 };
  }

  /** Centres the camera on a world point, keeping the zoom (minimap clicks). */
  centerOn(x: number, y: number, animate = true) {
    this.userCamera();
    const to = {
      zoom: this.camera.zoom,
      x: this.app.screen.width / 2 - x * this.camera.zoom,
      y: this.app.screen.height / 2 - y * this.camera.zoom,
    };
    if (animate) {
      this.cameraTween = { from: this.camera.state, to, t: 0 };
    } else {
      Object.assign(this.camera, to);
      this.applyCamera();
    }
  }

  private userCamera() {
    this.cameraTween = null;
    this.opts.onUserCamera?.();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const fn of this.cleanup) fn();
    this.app.ticker.remove(this.tick);
    this.app.destroy({ removeView: true }, { children: true });
    for (const texture of this.textures) texture.destroy(true);
  }

  // ---------------------------------------------------------------- rendering helpers

  private contentBounds() {
    let minX = 0;
    let minY = 0;
    const { cols, rows, pieceWidth: pw, pieceHeight: ph } = this.opts.state.config;
    let maxX = cols * pw;
    let maxY = rows * ph;
    for (const group of this.opts.state.allGroups()) {
      for (const pieceId of group.pieceIds) {
        const x = group.x + (pieceId % cols) * pw;
        const y = group.y + Math.floor(pieceId / cols) * ph;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + pw);
        maxY = Math.max(maxY, y + ph);
      }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private applyCamera() {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.zoom);
    this.opts.onCameraChange?.(this.camera.state);
  }

  private applyGroupStyle(group: GroupState, view: GroupView) {
    const dimmed =
      this.edgeFilter &&
      !group.placed &&
      group.pieceIds.length === 1 &&
      !this.opts.state.isEdgePiece(group.pieceIds[0]!);
    view.container.alpha = dimmed ? 0.18 : 1;
    view.shadows.visible = !group.placed;
  }

  private tweenTo(view: GroupView, x: number, y: number, duration = TWEEN_MS) {
    view.tween = {
      fromX: view.container.x,
      fromY: view.container.y,
      toX: x,
      toY: y,
      t: 0,
      duration,
    };
  }

  private flash(view: GroupView) {
    const filter = view.flash?.filter ?? new ColorMatrixFilter();
    view.flash = { t: 0, filter };
    this.updateFilters(view);
  }

  private updateFilters(view: GroupView) {
    const filters = [];
    if (view.holder) filters.push(view.holder);
    if (view.flash) filters.push(view.flash.filter);
    view.pieces.filters = filters;
  }

  private destroyGroupView(view: GroupView) {
    // Piece sprites are reused across groups, so detach them before destroying containers.
    view.shadows.removeChildren();
    view.pieces.removeChildren();
    view.pieces.filters = [];
    view.flash?.filter.destroy();
    view.holder?.destroy();
    view.container.destroy({ children: true });
  }

  private tick = () => {
    const dt = this.app.ticker.deltaMS;
    this.edgePan(dt);
    if (this.cameraTween) {
      const tween = this.cameraTween;
      tween.t = Math.min(1, tween.t + dt / 320);
      const e = 1 - Math.pow(1 - tween.t, 3);
      // Interpolate zoom geometrically so zooming feels even.
      this.camera.zoom = tween.from.zoom * Math.pow(tween.to.zoom / tween.from.zoom, e);
      this.camera.x = tween.from.x + (tween.to.x - tween.from.x) * e;
      this.camera.y = tween.from.y + (tween.to.y - tween.from.y) * e;
      if (tween.t >= 1) this.cameraTween = null;
      this.applyCamera();
    }
    for (const view of this.groups.values()) {
      if (view.tween) {
        const tween = view.tween;
        tween.t = Math.min(1, tween.t + dt / tween.duration);
        const e = 1 - Math.pow(1 - tween.t, 3);
        view.container.position.set(
          tween.fromX + (tween.toX - tween.fromX) * e,
          tween.fromY + (tween.toY - tween.fromY) * e,
        );
        if (tween.t >= 1) view.tween = undefined;
      }

      if (view.lift !== view.liftTarget) {
        const step = dt / 90;
        view.lift =
          view.liftTarget > view.lift
            ? Math.min(view.liftTarget, view.lift + step)
            : Math.max(view.liftTarget, view.lift - step);
        const size = Math.min(
          this.opts.state.config.pieceWidth,
          this.opts.state.config.pieceHeight,
        );
        view.pieces.position.set(-size * 0.03 * view.lift, -size * 0.05 * view.lift);
        view.shadows.position.set(size * 0.04 * view.lift, size * 0.06 * view.lift);
        view.shadows.alpha = 0.55 + 0.45 * view.lift;
      }

      if (view.flash) {
        view.flash.t = Math.min(1, view.flash.t + dt / FLASH_MS);
        view.flash.filter.brightness(1 + 0.35 * (1 - view.flash.t), false);
        if (view.flash.t >= 1) {
          view.flash.filter.destroy();
          view.flash = undefined;
          this.updateFilters(view);
        }
      }
    }
  };

  // ---------------------------------------------------------------- hit testing

  /** Topmost movable group under a world point. */
  private hitTest(worldX: number, worldY: number): number | null {
    const { state } = this.opts;
    const layer = this.looseLayer.children;
    for (let i = layer.length - 1; i >= 0; i--) {
      const container = layer[i]!;
      const groupId = this.groupIdOf(container);
      if (groupId === null) continue;
      const group = state.getGroup(groupId);
      if (!group || group.placed || container.alpha < 0.5) continue;
      const localX = worldX - container.x;
      const localY = worldY - container.y;
      for (const pieceId of group.pieceIds) {
        const piece = this.pieces[pieceId]!;
        const px = localX - piece.sprite.x;
        const py = localY - piece.sprite.y;
        if (px < 0 || py < 0 || px > piece.sprite.width || py > piece.sprite.height) continue;
        if (pointInPolygon(px, py, piece.polygon)) return groupId;
      }
    }
    return null;
  }

  /** Closest movable group within `radius` world units of a point (touch tolerance). */
  private nearestGroup(worldX: number, worldY: number, radius: number): number | null {
    const { state } = this.opts;
    let best: number | null = null;
    let bestDistance = radius;
    const layer = this.looseLayer.children;
    for (let i = layer.length - 1; i >= 0; i--) {
      const container = layer[i]!;
      const groupId = this.groupIdOf(container);
      if (groupId === null) continue;
      const group = state.getGroup(groupId);
      if (!group || group.placed || container.alpha < 0.5) continue;
      for (const pieceId of group.pieceIds) {
        const piece = this.pieces[pieceId]!;
        // Distance to the piece body (its sprite without the texture padding).
        const left = container.x + piece.sprite.x + PIECE_PADDING;
        const top = container.y + piece.sprite.y + PIECE_PADDING;
        const right = container.x + piece.sprite.x + piece.sprite.width - PIECE_PADDING;
        const bottom = container.y + piece.sprite.y + piece.sprite.height - PIECE_PADDING;
        const dx = Math.max(left - worldX, 0, worldX - right);
        const dy = Math.max(top - worldY, 0, worldY - bottom);
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = groupId;
        }
      }
    }
    return best;
  }

  private groupIdOf(container: Container): number | null {
    return this.containerGroup.get(container) ?? null;
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    const canvas = this.app.canvas;
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.cleanup.push(() => target.removeEventListener(type, handler as EventListener, options));
    };

    listen(canvas, "pointerdown", this.onPointerDown);
    listen(canvas, "pointermove", this.onPointerMove);
    listen(canvas, "pointerup", this.onPointerUp);
    listen(canvas, "pointercancel", this.onPointerUp);
    listen(canvas, "lostpointercapture", this.onPointerUp);
    listen(canvas, "wheel", this.onWheel, { passive: false });
    listen(canvas, "contextmenu", (e) => e.preventDefault());
    listen(window, "keydown", (e) => {
      if (e.code === "Space" && !isTyping(e)) {
        this.spaceDown = true;
        canvas.style.cursor = "grab";
        e.preventDefault();
      }
    });
    listen(window, "keyup", (e) => {
      if (e.code === "Space") {
        this.spaceDown = false;
        canvas.style.cursor = "";
      }
    });
  }

  private localPoint(event: PointerEvent | WheelEvent) {
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private onPointerDown = (event: PointerEvent) => {
    const point = this.localPoint(event);
    this.pointers.set(event.pointerId, point);
    try {
      this.app.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released (fast taps); dragging still works without capture.
    }

    // Second finger: switch to pinch-zoom. The first finger usually landed on a piece
    // by accident, so a piece that has barely moved goes back instead of being dropped.
    if (this.pointers.size === 2) {
      if (this.drag) {
        const { startX, startY, screenX, screenY, groupId } = this.drag;
        if (Math.hypot(screenX - startX, screenY - startY) < PINCH_CANCEL_PX) {
          const group = this.opts.state.getGroup(groupId);
          const view = this.groups.get(groupId);
          if (group && view) view.container.position.set(group.x, group.y);
        }
      }
      this.endDrag();
      this.pan = null;
      this.lastTap = null;
      this.pinch = this.pinchMetrics();
      return;
    }
    if (this.pointers.size > 2) return;

    const touch = event.pointerType !== "mouse";
    const wantsPan = this.spaceDown || event.button === 1 || event.button === 2;
    const world = this.camera.toWorld(point.x, point.y);
    const groupId = wantsPan
      ? null
      : (this.hitTest(world.x, world.y) ??
        (touch ? this.nearestGroup(world.x, world.y, TOUCH_SLOP_PX / this.camera.zoom) : null));

    if (groupId !== null && (this.opts.onGrab?.(groupId) ?? true)) {
      const group = this.opts.state.getGroup(groupId)!;
      this.drag = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        groupId,
        offsetX: world.x - group.x,
        offsetY: world.y - group.y,
        startX: point.x,
        startY: point.y,
        screenX: point.x,
        screenY: point.y,
      };
      this.setLifted(groupId, true);
      this.app.canvas.style.cursor = "grabbing";
      if (touch) haptic(8);
      return;
    }

    this.pan = {
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      tap: touch ? { x: point.x, y: point.y, at: performance.now() } : undefined,
    };
    this.app.canvas.style.cursor = "grabbing";
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.localPoint(event);
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point);
    const world = this.camera.toWorld(point.x, point.y);
    this.opts.onPointerMove?.(world.x, world.y);

    if (this.pinch && this.pointers.size === 2) {
      this.userCamera();
      const next = this.pinchMetrics();
      this.camera.pan(next.midX - this.pinch.midX, next.midY - this.pinch.midY);
      this.camera.zoomAt(next.midX, next.midY, next.distance / this.pinch.distance);
      this.pinch = next;
      this.applyCamera();
      return;
    }

    if (this.drag && this.drag.pointerId === event.pointerId) {
      this.drag.screenX = point.x;
      this.drag.screenY = point.y;
      this.moveDraggedTo(world.x, world.y);
      return;
    }

    if (this.pan && this.pan.pointerId === event.pointerId) {
      const tap = this.pan.tap;
      if (tap && Math.hypot(point.x - tap.x, point.y - tap.y) > TAP_MOVE_PX)
        this.pan.tap = undefined;
      this.userCamera();
      this.camera.pan(point.x - this.pan.lastX, point.y - this.pan.lastY);
      this.pan.lastX = point.x;
      this.pan.lastY = point.y;
      this.applyCamera();
      return;
    }

    if (event.pointerType === "mouse" && !this.spaceDown) {
      this.app.canvas.style.cursor = this.hitTest(world.x, world.y) !== null ? "grab" : "";
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pinch && this.pointers.size < 2) {
      this.pinch = null;
      // Lifting one finger of a pinch keeps panning with the other.
      const [remaining] = [...this.pointers.entries()];
      if (remaining) {
        const [pointerId, at] = remaining;
        this.pan = { pointerId, lastX: at.x, lastY: at.y };
      }
      return;
    }
    if (this.drag?.pointerId === event.pointerId) this.endDrag();
    if (this.pan?.pointerId === event.pointerId) {
      const tap = this.pan.tap;
      this.pan = null;
      if (tap && event.type === "pointerup" && performance.now() - tap.at < TAP_MS) this.onTap(tap);
    }
    if (!this.drag && !this.pan) this.app.canvas.style.cursor = this.spaceDown ? "grab" : "";
  };

  /** Double-tap on the table: zoom in there, or back out to everything when already close. */
  private onTap(tap: { x: number; y: number; at: number }) {
    const last = this.lastTap;
    if (
      !last ||
      tap.at - last.at > DOUBLE_TAP_MS ||
      Math.hypot(tap.x - last.x, tap.y - last.y) > DOUBLE_TAP_PX
    ) {
      this.lastTap = tap;
      return;
    }
    this.lastTap = null;
    const screen = { width: this.app.screen.width, height: this.app.screen.height };
    const overview = new Camera();
    overview.fit(this.contentBounds(), screen);
    const target = new Camera();
    if (this.camera.zoom > overview.zoom * 1.8) {
      Object.assign(target, overview.state);
    } else {
      Object.assign(target, this.camera.state);
      target.zoomAt(tap.x, tap.y, 2.5);
    }
    this.userCamera();
    this.cameraTween = { from: this.camera.state, to: target.state, t: 0 };
  }

  private moveDraggedTo(worldX: number, worldY: number) {
    if (!this.drag) return;
    const x = worldX - this.drag.offsetX;
    const y = worldY - this.drag.offsetY;
    const view = this.groups.get(this.drag.groupId);
    if (view) {
      view.tween = undefined;
      view.container.position.set(x, y);
    }
    this.opts.onDrag?.(this.drag.groupId, x, y);
  }

  /** Touch drags near the screen edge pan the camera, so pieces can travel on a small screen. */
  private edgePan(dt: number) {
    const drag = this.drag;
    if (!drag || drag.pointerType === "mouse" || this.pinch) return;
    const { width, height } = this.app.screen;
    const push = (p: number, size: number) =>
      p < EDGE_PAN_PX
        ? 1 - p / EDGE_PAN_PX
        : p > size - EDGE_PAN_PX
          ? -(1 - (size - p) / EDGE_PAN_PX)
          : 0;
    const vx = push(drag.screenX, width);
    const vy = push(drag.screenY, height);
    if (vx === 0 && vy === 0) return;
    const step = (EDGE_PAN_SPEED * Math.min(dt, 50)) / 1000;
    this.userCamera();
    this.camera.pan(vx * step, vy * step);
    this.applyCamera();
    const world = this.camera.toWorld(drag.screenX, drag.screenY);
    this.moveDraggedTo(world.x, world.y);
  }

  private endDrag() {
    if (!this.drag) return;
    const { groupId } = this.drag;
    this.drag = null;
    this.setLifted(groupId, false);
    const view = this.groups.get(groupId);
    if (view) this.opts.onDrop?.(groupId, view.container.x, view.container.y);
  }

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.userCamera();
    const point = this.localPoint(event);
    // Pinch on a trackpad arrives as ctrl+wheel; a mouse wheel zooms too.
    const isMouseWheel =
      event.deltaMode === 1 || (Math.abs(event.deltaY) >= 50 && event.deltaX === 0);
    if (event.ctrlKey || event.metaKey || isMouseWheel) {
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015));
      this.camera.zoomAt(point.x, point.y, factor);
    } else {
      this.camera.pan(-event.deltaX, -event.deltaY);
    }
    this.applyCamera();
  };

  private pinchMetrics() {
    const [a, b] = [...this.pointers.values()] as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }
}

function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi = polygon[i]!;
    const yi = polygon[i + 1]!;
    const xj = polygon[j]!;
    const yj = polygon[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    !!target &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
