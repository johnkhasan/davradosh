import {
  CURSOR_SEND_INTERVAL_MS,
  PuzzleState,
  type ClientToServerEvents,
  type JoinError,
  type ActionAck,
  type PlayerDTO,
  type PlayerRole,
  type PlayerStatsDTO,
  type ReactionEmoji,
  type RemoteSnap,
  type RoomInfoDTO,
  type RoomStateDTO,
  type ServerToClientEvents,
  type SnapResult,
  type ViewportPayload,
} from "@puzzle/shared";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "../env";
import type { PuzzleView } from "../game/puzzle-view";
import { loadRoomImage } from "../game/images";
import { haptic, sounds } from "../game/sounds";
import type { Identity } from "../identity";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RoomStatus = "connecting" | "loading" | "ready" | "reconnecting" | "error";
export type RoomError = JoinError | "kicked" | "removed" | "connection" | "image";

export interface RoomSnapshot {
  status: RoomStatus;
  error: RoomError | null;
  room: RoomInfoDTO | null;
  players: PlayerDTO[];
  me: string;
  /** playerId → groupId they are holding */
  holding: Record<string, number>;
  progress: { connected: number; total: number };
  completed: { durationMs: number; stats: Record<string, PlayerStatsDTO> } | null;
  /** Transient message, e.g. "Malika ushlab turibdi". */
  notice: { id: number; text: string } | null;
  /** Player whose view we are following (Figma-style), if any. */
  following: string | null;
}

export interface Reaction {
  id: number;
  playerId: string;
  emoji: ReactionEmoji;
  x: number;
  y: number;
}

export interface RemoteCursor {
  playerId: string;
  /** Rendered position (interpolated towards the target). */
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastMoveAt: number;
}

/**
 * Multiplayer glue between Socket.IO, the local PuzzleState and PuzzleView.
 *
 * Local drops are predicted immediately with the shared engine and then
 * reconciled with the server's authoritative answer (drops from one socket
 * are processed in order, so a FIFO queue is enough). Any mismatch or
 * unknown group triggers a full resync.
 */
export class RoomController {
  readonly cursors = new Map<string, RemoteCursor>();
  /** Last known visible world rectangle of every other player. */
  readonly viewports = new Map<string, ViewportPayload>();
  private readonly reactionListeners = new Set<(reaction: Reaction) => void>();
  private reactionId = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private viewportTimer: number | null = null;
  private lastViewportSent = 0;
  private snapshot: RoomSnapshot;
  private readonly listeners = new Set<() => void>();
  private socket: GameSocket | null = null;
  private state: PuzzleState | null = null;
  private view: PuzzleView | null = null;
  private host: HTMLElement | null = null;
  private image: HTMLCanvasElement | null = null;
  private locks = new Map<number, string>();
  private pendingDrops: Array<SnapResult | null> = [];
  private resyncing = false;
  private destroyed = false;
  /** Bumped on every connect/destroy so stale async work can bail out (React Strict Mode remounts). */
  private generation = 0;
  private creatingView: Promise<void> | null = null;
  private lastCursorSent = 0;
  private lastMoveSent = 0;
  private moveTimer: number | null = null;
  /** Keeps our lock alive while a piece is held still (server expires locks after 10 s). */
  private holdTimer: number | null = null;
  private lastDrag: { groupId: number; x: number; y: number } | null = null;
  private noticeId = 0;
  private tools = { ghost: false, edgesOnly: false };

  constructor(
    private readonly roomId: string,
    private readonly identity: Identity,
    /** Join as a viewer on purpose ("just watch"). */
    private readonly watchOnly = false,
  ) {
    this.snapshot = {
      status: "connecting",
      error: null,
      room: null,
      players: [],
      me: identity.clientId,
      holding: {},
      progress: { connected: 0, total: 0 },
      completed: null,
      notice: null,
      following: null,
    };
  }

  // ---------------------------------------------------------------- store (useSyncExternalStore)

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  // ---------------------------------------------------------------- lifecycle

  connect() {
    this.destroyed = false;
    this.generation++;
    this.update({ status: "connecting", error: null });
    const socket: GameSocket = io(WS_URL, {
      transports: ["websocket"],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    this.socket = socket;

    socket.on("connect", () => void this.join());
    socket.on("disconnect", (reason) => {
      if (this.destroyed || this.snapshot.status === "error") return;
      this.locks.clear();
      this.pendingDrops = [];
      this.update({ status: reason === "io server disconnect" ? "error" : "reconnecting" });
    });
    socket.on("connect_error", () => {
      if (this.snapshot.status === "connecting") this.update({ status: "reconnecting" });
    });
    socket.on("kicked", (reason) => {
      this.update({ status: "error", error: reason === "host" ? "removed" : "kicked" });
      socket.disconnect();
    });
    socket.on("puzzle:reset", () => {
      this.update({ completed: null });
      this.notify("Host puzzle'ni qaytadan boshladi");
      void this.resync();
    });

    socket.on("player:joined", (player) => {
      this.upsertPlayer(player);
      // Newcomers learn where we are looking right away (minimap / follow).
      this.sendViewport(true);
    });
    socket.on("player:updated", (player) => {
      const before = this.playerById(player.id)?.role;
      if (player.id === this.snapshot.me && before && before !== player.role) {
        if (player.role === "viewer") {
          const dragging = this.view?.draggingGroupId;
          if (dragging !== null && dragging !== undefined) this.view?.cancelDrag(dragging);
          this.stopHoldHeartbeat();
          this.notify("Endi siz tomoshabinsiz");
        } else {
          this.notify("Endi siz o'yinchisiz, bo'laklarni ushlashingiz mumkin 🧩");
        }
      }
      this.upsertPlayer(player);
      if (!player.connected) {
        this.cursors.delete(player.id);
        if (this.snapshot.following === player.id) this.update({ following: null });
      }
    });
    socket.on("player:left", (playerId) => {
      this.cursors.delete(playerId);
      this.viewports.delete(playerId);
      if (this.snapshot.following === playerId) this.update({ following: null });
      this.update({ players: this.snapshot.players.filter((p) => p.id !== playerId) });
    });
    socket.on("cursor", (playerId, x, y) => this.onCursor(playerId, x, y));
    socket.on("reaction", (playerId, emoji, x, y) => this.showReaction(playerId, emoji, x, y));
    socket.on("viewport", (playerId, rect) => {
      this.viewports.set(playerId, rect);
      if (this.snapshot.following === playerId) this.view?.lookAt(rect);
    });
    socket.on("piece:grabbed", (groupId, playerId) =>
      this.guard(() => this.onGrabbed(groupId, playerId)),
    );
    socket.on("piece:released", (groupId) => this.guard(() => this.onReleased(groupId)));
    socket.on("piece:moved", (groupId, x, y) => this.guard(() => this.onMoved(groupId, x, y)));
    socket.on("piece:dropped", (groupId, x, y, playerId) =>
      this.guard(() => this.onDropped(groupId, x, y, playerId)),
    );
    socket.on("piece:snapped", (result) => this.guard(() => this.onSnapped(result)));
    socket.on("groups:moved", (moves) => this.guard(() => this.onGroupsMoved(moves)));
    socket.on("puzzle:completed", (info) => {
      this.update({
        completed: info,
        room: this.snapshot.room && { ...this.snapshot.room, status: "COMPLETED" },
      });
      sounds.complete();
    });
  }

  /** The element the canvas goes into. The view is created once state and image are ready. */
  mount(host: HTMLElement) {
    this.host = host;
    void this.ensureView();
  }

  destroy() {
    this.destroyed = true;
    this.generation++;
    if (this.moveTimer) window.clearTimeout(this.moveTimer);
    this.stopHoldHeartbeat();
    if (this.viewportTimer) window.clearTimeout(this.viewportTimer);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.view?.destroy();
    this.view = null;
    this.creatingView = null;
    this.locks.clear();
    this.pendingDrops = [];
    this.cursors.clear();
  }

  // ---------------------------------------------------------------- UI commands

  get puzzleView(): PuzzleView | null {
    return this.view;
  }

  get puzzleState(): PuzzleState | null {
    return this.state;
  }

  /** Our pointer in world coordinates (spatial audio, reactions). */
  get pointer(): { x: number; y: number } | null {
    return this.lastPointer;
  }

  setTools(tools: { ghost: boolean; edgesOnly: boolean }) {
    this.tools = tools;
    this.view?.setGhostVisible(tools.ghost);
    this.view?.setEdgeFilter(tools.edgesOnly);
  }

  /** Host only (the server enforces it too). */
  arrange() {
    if (!this.isHost) return;
    this.socket?.emit("puzzle:arrange");
  }

  get myRole(): PlayerRole | null {
    return this.playerById(this.snapshot.me)?.role ?? null;
  }

  get isHost(): boolean {
    return this.playerById(this.snapshot.me)?.isHost ?? false;
  }

  get hasFreeSeat(): boolean {
    const seated = this.snapshot.players.filter((p) => p.role === "player").length;
    return seated < (this.snapshot.room?.maxPlayers ?? 0);
  }

  private async action(
    send: () => Promise<ActionAck> | undefined,
    failure: string,
  ): Promise<boolean> {
    const result = await send()?.catch(() => null);
    if (result?.ok) return true;
    const reason =
      result && !result.ok
        ? {
            not_host: "Buni faqat host qila oladi",
            full: "Bo'sh joy yo'q",
            not_found: "O'yinchi topilmadi",
            invalid: failure,
          }[result.error]
        : failure;
    this.notify(reason);
    return false;
  }

  /** Viewer → player when a seat is free. */
  claimSeat() {
    return this.action(() => this.socket?.emitWithAck("seat:claim"), "Joy olib bo'lmadi");
  }

  /** Player → viewer, freeing the seat. */
  leaveSeat() {
    return this.action(() => this.socket?.emitWithAck("seat:leave"), "Bajarib bo'lmadi");
  }

  kick(playerId: string, ban: boolean) {
    return this.action(
      () => this.socket?.emitWithAck("host:kick", { playerId, ban }),
      "Chiqarib bo'lmadi",
    );
  }

  setRole(playerId: string, role: PlayerRole) {
    return this.action(
      () => this.socket?.emitWithAck("host:set-role", { playerId, role }),
      "Bajarib bo'lmadi",
    );
  }

  restart() {
    return this.action(() => this.socket?.emitWithAck("host:restart"), "Qaytadan boshlab bo'lmadi");
  }

  /** Sends a floating emoji from our cursor (or the middle of our view). */
  react(emoji: ReactionEmoji) {
    const view = this.view;
    if (!view) return;
    const rect = view.viewportRect();
    const at = this.lastPointer ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    this.socket?.emit("reaction", { emoji, x: at.x, y: at.y });
    this.showReaction(this.snapshot.me, emoji, at.x, at.y);
  }

  onReaction(listener: (reaction: Reaction) => void) {
    this.reactionListeners.add(listener);
    return () => {
      this.reactionListeners.delete(listener);
    };
  }

  /** Follow another player's view; pass null (or pan/zoom yourself) to stop. */
  follow(playerId: string | null) {
    if (playerId === this.snapshot.me) playerId = null;
    this.update({ following: playerId });
    const rect = playerId ? this.viewports.get(playerId) : undefined;
    if (rect) this.view?.lookAt(rect);
    else if (playerId) this.notify("Bu o'yinchi hali ekranini siljitmadi");
  }

  private showReaction(playerId: string, emoji: ReactionEmoji, x: number, y: number) {
    const reaction = { id: ++this.reactionId, playerId, emoji, x, y };
    for (const listener of this.reactionListeners) listener(reaction);
  }

  private sendViewport(immediate = false) {
    const send = () => {
      this.viewportTimer = null;
      const rect = this.view?.viewportRect();
      if (!rect || !this.socket) return;
      this.lastViewportSent = performance.now();
      this.socket.emit("viewport", rect);
    };
    if (this.viewportTimer) window.clearTimeout(this.viewportTimer);
    const wait = immediate ? 0 : 200 - (performance.now() - this.lastViewportSent);
    if (wait <= 0) send();
    else this.viewportTimer = window.setTimeout(send, wait);
  }

  playerById(id: string): PlayerDTO | undefined {
    return this.snapshot.players.find((p) => p.id === id);
  }

  // ---------------------------------------------------------------- joining & syncing

  private async join() {
    const socket = this.socket;
    if (!socket) return;
    const ack = await socket.emitWithAck("room:join", {
      roomId: this.roomId,
      clientId: this.identity.clientId,
      name: this.identity.name,
      color: this.identity.color,
      avatar: this.identity.avatar,
      role: this.watchOnly ? "viewer" : "player",
    });
    if (this.destroyed || socket !== this.socket) return;
    if (!ack.ok) {
      this.update({ status: "error", error: ack.error });
      socket.disconnect();
      return;
    }
    await this.applyFullState(ack.state);
  }

  private async resync() {
    if (this.resyncing || !this.socket) return;
    this.resyncing = true;
    try {
      const state = await this.socket.emitWithAck("room:sync");
      if (state) await this.applyFullState(state);
    } finally {
      this.resyncing = false;
    }
  }

  /** Runs a remote event handler; any inconsistency triggers a resync. */
  private guard(handler: () => boolean | void) {
    if (this.resyncing || !this.state) return;
    if (handler() === false) void this.resync();
  }

  private async applyFullState(dto: RoomStateDTO) {
    this.locks = new Map(
      Object.entries(dto.locks).map(([groupId, playerId]) => [Number(groupId), playerId]),
    );
    this.pendingDrops = [];

    if (!this.state) {
      const { room } = dto;
      this.state = new PuzzleState(
        {
          cols: room.cols,
          rows: room.rows,
          pieceWidth: room.image.width / room.cols,
          pieceHeight: room.image.height / room.rows,
        },
        dto.puzzle,
      );
    } else {
      this.state.replaceWith(dto.puzzle);
    }

    this.update({
      room: dto.room,
      players: dto.players,
      me: dto.you,
      status: this.view ? "ready" : "loading",
      completed:
        dto.room.status === "COMPLETED" && dto.room.completedAt
          ? { durationMs: dto.room.completedAt - dto.room.startedAt, stats: dto.stats }
          : null,
    });

    if (this.view) {
      this.view.rebuild();
      this.applyHolders();
      this.reportProgress();
    } else {
      await this.ensureView();
    }
  }

  private ensureView(): Promise<void> {
    this.creatingView ??= this.createView().finally(() => {
      this.creatingView = null;
    });
    return this.creatingView;
  }

  private async createView() {
    const room = this.snapshot.room;
    if (this.view || !this.state || !this.host || !room) return;
    const generation = this.generation;
    const host = this.host;
    const state = this.state;
    try {
      this.image ??= await loadRoomImage(room.image, room.seed);
    } catch {
      this.update({ status: "error", error: "image" });
      return;
    }
    const { PuzzleView } = await import("../game/puzzle-view");
    if (generation !== this.generation || this.view) return;
    const view = await PuzzleView.create({
      host,
      image: this.image,
      state,
      seed: room.seed,
      onGrab: (groupId) => this.onLocalGrab(groupId),
      onDrag: (groupId, x, y) => this.onLocalDrag(groupId, x, y),
      onDrop: (groupId, x, y) => this.onLocalDrop(groupId, x, y),
      onPointerMove: (x, y) => this.onLocalPointer(x, y),
      onCameraChange: () => this.sendViewport(),
      onUserCamera: () => {
        if (this.snapshot.following) this.update({ following: null });
      },
    });
    if (generation !== this.generation || this.view) {
      view.destroy();
      return;
    }
    this.view = view;
    view.setGhostVisible(this.tools.ghost);
    view.setEdgeFilter(this.tools.edgesOnly);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __puzzle: unknown }).__puzzle = { state, view, controller: this };
    }
    this.applyHolders();
    this.reportProgress();
    this.update({ status: "ready" });
    this.sendViewport(true);
  }

  // ---------------------------------------------------------------- local input

  private onLocalGrab(groupId: number): boolean {
    if (this.myRole !== "player") {
      this.notify(
        this.hasFreeSeat
          ? "Bo'laklarni ushlash uchun «O'yinchi bo'lish» ni bosing"
          : "Siz tomoshabinsiz: joy bo'shashini kuting",
      );
      return false;
    }
    const holder = this.locks.get(groupId);
    if (holder && holder !== this.snapshot.me) {
      const name = this.playerById(holder)?.name ?? "Boshqa o'yinchi";
      this.notify(`${name} bu bo'lakni ushlab turibdi`);
      return false;
    }
    if (this.snapshot.status !== "ready" || this.snapshot.completed) return false;
    this.locks.set(groupId, this.snapshot.me);
    this.startHoldHeartbeat(groupId);
    sounds.pick();
    void this.socket?.emitWithAck("piece:grab", { groupId }).then((ack) => {
      if (ack.ok || this.locks.get(groupId) !== this.snapshot.me) return;
      this.locks.delete(groupId);
      this.stopHoldHeartbeat();
      this.view?.cancelDrag(groupId);
      const name = ack.heldBy ? this.playerById(ack.heldBy)?.name : null;
      this.notify(name ? `${name} bu bo'lakni ushlab turibdi` : "Bu bo'lakni hozir olib bo'lmaydi");
    });
    return true;
  }

  private onLocalDrag(groupId: number, x: number, y: number) {
    this.lastDrag = { groupId, x, y };
    const send = () => {
      this.moveTimer = null;
      this.lastMoveSent = performance.now();
      this.socket?.emit("piece:move", { groupId, x, y });
    };
    if (this.moveTimer) window.clearTimeout(this.moveTimer);
    const wait = CURSOR_SEND_INTERVAL_MS - (performance.now() - this.lastMoveSent);
    if (wait <= 0) send();
    else this.moveTimer = window.setTimeout(send, wait);
  }

  private onLocalDrop(groupId: number, x: number, y: number) {
    this.stopHoldHeartbeat();
    if (this.moveTimer) {
      window.clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
    const state = this.state;
    const view = this.view;
    if (!state || !view) return;
    this.locks.delete(groupId);
    this.socket?.emit("piece:drop", { groupId, x, y });

    state.moveGroup(groupId, x, y);
    const me = this.snapshot.me;
    const predicted = state.snap(groupId, (id) => {
      const holder = this.locks.get(id);
      return !holder || holder === me;
    });
    this.pendingDrops.push(predicted);
    if (predicted) {
      view.applySnap(predicted);
      if (predicted.placed) sounds.place();
      else sounds.snap();
      haptic();
      this.reportProgress();
    } else {
      sounds.drop();
    }
  }

  private startHoldHeartbeat(groupId: number) {
    this.stopHoldHeartbeat();
    const group = this.state?.getGroup(groupId);
    this.lastDrag = group ? { groupId, x: group.x, y: group.y } : null;
    this.holdTimer = window.setInterval(() => {
      const drag = this.lastDrag;
      if (!drag || this.view?.draggingGroupId !== drag.groupId) return this.stopHoldHeartbeat();
      this.socket?.emit("piece:move", drag);
    }, 3000);
  }

  private stopHoldHeartbeat() {
    if (this.holdTimer) window.clearInterval(this.holdTimer);
    this.holdTimer = null;
    this.lastDrag = null;
  }

  private onLocalPointer(x: number, y: number) {
    this.lastPointer = { x, y };
    // Viewers watch quietly (the server would drop their cursor anyway).
    if (this.myRole !== "player") return;
    const now = performance.now();
    if (now - this.lastCursorSent < CURSOR_SEND_INTERVAL_MS) return;
    this.lastCursorSent = now;
    this.socket?.emit("cursor:move", { x, y });
  }

  // ---------------------------------------------------------------- remote events

  private onCursor(playerId: string, x: number, y: number) {
    const cursor = this.cursors.get(playerId);
    const now = performance.now();
    if (cursor) {
      cursor.targetX = x;
      cursor.targetY = y;
      cursor.lastMoveAt = now;
    } else {
      this.cursors.set(playerId, { playerId, x, y, targetX: x, targetY: y, lastMoveAt: now });
    }
  }

  private onGrabbed(groupId: number, playerId: string) {
    if (!this.state!.getGroup(groupId)) return false;
    this.locks.set(groupId, playerId);
    // Someone else got it first while we were optimistically dragging it.
    if (this.view?.draggingGroupId === groupId) {
      this.stopHoldHeartbeat();
      this.view.cancelDrag(groupId);
    }
    this.applyHolders();
  }

  private onReleased(groupId: number) {
    if (this.locks.get(groupId) === this.snapshot.me) return;
    this.locks.delete(groupId);
    this.applyHolders();
  }

  private onMoved(groupId: number, x: number, y: number) {
    if (!this.state!.setGroupPosition(groupId, x, y)) return false;
    // Updates arrive ~25 times a second; a short tween turns them into smooth motion.
    this.view?.syncGroup(groupId, { animate: true, duration: CURSOR_SEND_INTERVAL_MS * 2 });
  }

  private onDropped(groupId: number, x: number, y: number, playerId: string) {
    const state = this.state!;
    if (playerId === this.snapshot.me) {
      const predicted = this.pendingDrops.shift();
      const group = state.getGroup(groupId);
      if (predicted !== null || !group) return false;
      if (group.x !== x || group.y !== y) {
        // Server corrected our position (stale lock).
        state.setGroupPosition(groupId, x, y);
        this.view?.syncGroup(groupId, { animate: true });
      }
      return;
    }
    if (!state.setGroupPosition(groupId, x, y)) return false;
    this.locks.delete(groupId);
    this.view?.syncGroup(groupId, { animate: true });
    this.applyHolders();
  }

  private onSnapped(result: RemoteSnap) {
    const state = this.state!;
    if (result.playerId === this.snapshot.me) {
      const predicted = this.pendingDrops.shift();
      if (!predicted || !sameSnap(predicted, result)) return false;
      return;
    }
    for (const id of [result.groupId, ...result.absorbed]) this.locks.delete(id);
    if (!state.applySnap(result)) return false;
    this.view?.applySnap(result);
    this.applyHolders();
    sounds.snap();
    this.reportProgress();
  }

  private onGroupsMoved(moves: Array<{ id: number; x: number; y: number }>) {
    const state = this.state!;
    for (const move of moves) {
      if (!state.setGroupPosition(move.id, move.x, move.y)) return false;
      this.view?.syncGroup(move.id, { animate: true });
    }
  }

  // ---------------------------------------------------------------- helpers

  private upsertPlayer(player: PlayerDTO) {
    const players = this.snapshot.players.some((p) => p.id === player.id)
      ? this.snapshot.players.map((p) => (p.id === player.id ? player : p))
      : [...this.snapshot.players, player];
    this.update({ players });
    this.applyHolders();
  }

  /** Outlines groups held by other players and publishes who holds what. */
  private applyHolders() {
    const holding: Record<string, number> = {};
    const view = this.view;
    if (view && this.state) {
      for (const group of this.state.allGroups()) view.setHolder(group.id, null);
    }
    for (const [groupId, playerId] of this.locks) {
      holding[playerId] = groupId;
      if (playerId === this.snapshot.me) continue;
      const color = this.playerById(playerId)?.color ?? "#ffffff";
      view?.setHolder(groupId, color);
      view?.setLifted(groupId, true);
    }
    // Groups that were lifted by a remote player and are no longer held settle down.
    if (view && this.state) {
      for (const group of this.state.allGroups()) {
        if (!this.locks.has(group.id) && view.draggingGroupId !== group.id)
          view.setLifted(group.id, false);
      }
    }
    this.update({ holding });
  }

  private reportProgress() {
    if (!this.state) return;
    this.update({
      progress: { connected: this.state.connectedPieceCount(), total: this.state.pieceCount },
    });
  }

  notify(text: string) {
    this.update({ notice: { id: ++this.noticeId, text } });
  }
}

function sameSnap(a: SnapResult, b: SnapResult): boolean {
  const sortedA = [...a.absorbed].sort((x, y) => x - y);
  const sortedB = [...b.absorbed].sort((x, y) => x - y);
  return (
    a.groupId === b.groupId &&
    a.placed === b.placed &&
    Math.abs(a.x - b.x) < 1e-6 &&
    Math.abs(a.y - b.y) < 1e-6 &&
    sortedA.length === sortedB.length &&
    sortedA.every((id, i) => id === sortedB[i])
  );
}
