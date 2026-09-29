import { SNAP_TOLERANCE } from "../constants";
import { createRandom } from "./random";

/**
 * Authoritative puzzle state, shared by the browser (optimistic updates) and
 * the game server (validation).
 *
 * A group stores a single origin `(x, y)`: the world position where the puzzle's
 * top-left corner would be if this group were correct. A piece's world position is
 * therefore `origin + (col * pieceWidth, row * pieceHeight)`. Two groups fit
 * together exactly when their origins coincide, which makes snapping trivial.
 * The board (target frame) sits at world (0, 0), so a group is in its final
 * place when its origin is (0, 0).
 */

export interface PuzzleConfig {
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
}

export interface GroupState {
  id: number;
  x: number;
  y: number;
  pieceIds: number[];
  /** Snapped into the board frame; no longer movable. */
  placed: boolean;
}

export interface PuzzleSnapshot {
  groups: GroupState[];
}

export interface HintPair {
  /** Two neighbouring pieces that fit together. */
  pieceIds: [number, number];
  /** Their (different) groups. */
  groupIds: [number, number];
}

export interface SnapResult {
  /** Group that survived (and was possibly moved). */
  groupId: number;
  /** Groups absorbed into `groupId`; they no longer exist. */
  absorbed: number[];
  x: number;
  y: number;
  placed: boolean;
}

export class PuzzleState {
  readonly config: PuzzleConfig;
  private readonly groups = new Map<number, GroupState>();
  private readonly pieceToGroup: Int32Array;

  constructor(config: PuzzleConfig, snapshot: PuzzleSnapshot) {
    this.config = config;
    this.pieceToGroup = new Int32Array(config.cols * config.rows).fill(-1);
    this.replaceWith(snapshot);
  }

  /** Replaces all groups in place (full resync from the server). */
  replaceWith(snapshot: PuzzleSnapshot) {
    this.groups.clear();
    this.pieceToGroup.fill(-1);
    for (const group of snapshot.groups) {
      const copy = { ...group, pieceIds: [...group.pieceIds] };
      this.groups.set(copy.id, copy);
      for (const pieceId of copy.pieceIds) this.pieceToGroup[pieceId] = copy.id;
    }
  }

  /** Fresh puzzle: every piece is its own group, scattered around the board. */
  /**
   * `scatterSeed` only changes where pieces start (used when the host restarts);
   * piece shapes always come from the room seed.
   */
  static create(config: PuzzleConfig, seed: number, scatterSeed = seed): PuzzleState {
    const count = config.cols * config.rows;
    const groups: GroupState[] = [];
    for (let id = 0; id < count; id++) {
      groups.push({ id, x: 0, y: 0, pieceIds: [id], placed: false });
    }
    const state = new PuzzleState(config, { groups });
    const ids = groups.map((g) => g.id);
    state.scatter(ids, createRandom(scatterSeed ^ 0x9e3779b9));
    return state;
  }

  get pieceCount(): number {
    return this.pieceToGroup.length;
  }

  get groupCount(): number {
    return this.groups.size;
  }

  getGroup(id: number): GroupState | undefined {
    return this.groups.get(id);
  }

  groupOfPiece(pieceId: number): GroupState | undefined {
    return this.groups.get(this.pieceToGroup[pieceId] ?? -1);
  }

  allGroups(): IterableIterator<GroupState> {
    return this.groups.values();
  }

  snapshot(): PuzzleSnapshot {
    return {
      groups: [...this.groups.values()].map((g) => ({ ...g, pieceIds: [...g.pieceIds] })),
    };
  }

  isComplete(): boolean {
    if (this.groups.size === 1) return true;
    for (const group of this.groups.values()) if (!group.placed) return false;
    return true;
  }

  /** Number of pieces that are connected to at least one neighbour or placed. */
  connectedPieceCount(): number {
    let count = 0;
    for (const group of this.groups.values()) {
      if (group.pieceIds.length > 1 || group.placed) count += group.pieceIds.length;
    }
    return count;
  }

  moveGroup(id: number, x: number, y: number): boolean {
    const group = this.groups.get(id);
    if (!group || group.placed) return false;
    group.x = x;
    group.y = y;
    return true;
  }

  /**
   * Called when a group is dropped. Merges it with every correctly aligned
   * neighbour and snaps it into the board when close enough.
   */
  snap(id: number, canMerge: (groupId: number) => boolean = () => true): SnapResult | null {
    let current = this.groups.get(id);
    if (!current) return null;

    const tolerance = SNAP_TOLERANCE * Math.min(this.config.pieceWidth, this.config.pieceHeight);
    const absorbed: number[] = [];
    const startX = current.x;
    const startY = current.y;
    const wasPlaced = current.placed;

    let changed = true;
    while (changed) {
      changed = false;

      for (const neighbourId of this.neighbourGroups(current)) {
        const neighbour = this.groups.get(neighbourId)!;
        if (!canMerge(neighbourId)) continue;
        if (
          Math.abs(neighbour.x - current.x) > tolerance ||
          Math.abs(neighbour.y - current.y) > tolerance
        ) {
          continue;
        }
        // The stationary neighbour keeps its position; the dropped group joins it.
        const [keep, drop] = this.mergeOrder(current, neighbour);
        this.merge(keep, drop);
        absorbed.push(drop.id);
        current = keep;
        changed = true;
        break;
      }

      if (!current.placed && Math.abs(current.x) <= tolerance && Math.abs(current.y) <= tolerance) {
        current.x = 0;
        current.y = 0;
        current.placed = true;
        changed = true;
      }
    }

    const moved = current.x !== startX || current.y !== startY || current.id !== id;
    if (absorbed.length === 0 && !moved && current.placed === wasPlaced) return null;

    // The surviving id may differ from `id`; report every other id that disappeared.
    const gone = absorbed.filter((g) => g !== current.id);
    if (current.id !== id && !gone.includes(id)) gone.push(id);

    return {
      groupId: current.id,
      absorbed: [...new Set(gone)],
      x: current.x,
      y: current.y,
      placed: current.placed,
    };
  }

  /**
   * Applies a snap computed elsewhere (by the server for another player's drop).
   * Returns false when the local state has diverged and needs a full resync.
   */
  applySnap(result: SnapResult): boolean {
    let survivor = this.groups.get(result.groupId);
    if (!survivor) {
      // The survivor may be a group that was absorbed locally by a prediction.
      return false;
    }
    for (const absorbedId of result.absorbed) {
      const absorbed = this.groups.get(absorbedId);
      if (!absorbed) return false;
      this.merge(survivor, absorbed);
    }
    survivor = this.groups.get(result.groupId)!;
    survivor.x = result.x;
    survivor.y = result.y;
    survivor.placed = result.placed;
    return true;
  }

  /** Moves a group even if placed (used when applying authoritative server state). */
  setGroupPosition(id: number, x: number, y: number): boolean {
    const group = this.groups.get(id);
    if (!group) return false;
    group.x = x;
    group.y = y;
    return true;
  }

  /**
   * Lays loose single pieces out tidily around the board. Edge pieces go
   * closest to the board when `edgesFirst` is set. Returns the moved group ids.
   */
  arrange(
    options: { edgesFirst?: boolean; seed?: number; exclude?: ReadonlySet<number> } = {},
  ): number[] {
    const loose = [...this.groups.values()].filter(
      (g) => !g.placed && g.pieceIds.length === 1 && !options.exclude?.has(g.id),
    );
    if (options.edgesFirst) {
      loose.sort(
        (a, b) =>
          Number(this.isEdgePiece(b.pieceIds[0]!)) - Number(this.isEdgePiece(a.pieceIds[0]!)),
      );
    }
    const ids = loose.map((g) => g.id);
    this.scatter(ids, createRandom(options.seed ?? 1), { ordered: true });
    return ids;
  }

  /**
   * A pair of neighbouring pieces that still belong to different groups: a hint
   * for "these two fit together". Groups in `exclude` (held by someone) are
   * skipped; pairs between two loose groups are preferred over pairs that
   * attach to the board. Returns null when nothing is left to connect.
   */
  findHint(
    options: { exclude?: ReadonlySet<number>; random?: () => number } = {},
  ): HintPair | null {
    const { cols, rows } = this.config;
    const random = options.random ?? Math.random;
    const loose: HintPair[] = [];
    const toBoard: HintPair[] = [];
    for (let pieceId = 0; pieceId < this.pieceCount; pieceId++) {
      const col = pieceId % cols;
      const row = Math.floor(pieceId / cols);
      const right = col < cols - 1 ? pieceId + 1 : -1;
      const below = row < rows - 1 ? pieceId + cols : -1;
      for (const other of [right, below]) {
        if (other < 0) continue;
        const a = this.pieceToGroup[pieceId]!;
        const b = this.pieceToGroup[other]!;
        if (a === b || options.exclude?.has(a) || options.exclude?.has(b)) continue;
        const groupA = this.groups.get(a)!;
        const groupB = this.groups.get(b)!;
        if (groupA.placed && groupB.placed) continue;
        const pair = {
          pieceIds: [pieceId, other] as [number, number],
          groupIds: [a, b] as [number, number],
        };
        (groupA.placed || groupB.placed ? toBoard : loose).push(pair);
      }
    }
    const pool = loose.length ? loose : toBoard;
    return pool.length ? pool[Math.floor(random() * pool.length)]! : null;
  }

  isEdgePiece(pieceId: number): boolean {
    const { cols, rows } = this.config;
    const col = pieceId % cols;
    const row = Math.floor(pieceId / cols);
    return row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
  }

  private neighbourGroups(group: GroupState): Set<number> {
    const { cols, rows } = this.config;
    const result = new Set<number>();
    for (const pieceId of group.pieceIds) {
      const col = pieceId % cols;
      const row = Math.floor(pieceId / cols);
      const around = [
        col > 0 ? pieceId - 1 : -1,
        col < cols - 1 ? pieceId + 1 : -1,
        row > 0 ? pieceId - cols : -1,
        row < rows - 1 ? pieceId + cols : -1,
      ];
      for (const neighbour of around) {
        if (neighbour < 0) continue;
        const gid = this.pieceToGroup[neighbour]!;
        if (gid !== group.id) result.add(gid);
      }
    }
    return result;
  }

  /** Returns [survivor, absorbed]. Placed groups, then bigger groups, then the stationary one stay put. */
  private mergeOrder(moving: GroupState, stationary: GroupState): [GroupState, GroupState] {
    if (moving.placed !== stationary.placed) {
      return moving.placed ? [moving, stationary] : [stationary, moving];
    }
    if (moving.pieceIds.length > stationary.pieceIds.length) return [moving, stationary];
    return [stationary, moving];
  }

  private merge(keep: GroupState, drop: GroupState) {
    for (const pieceId of drop.pieceIds) {
      keep.pieceIds.push(pieceId);
      this.pieceToGroup[pieceId] = keep.id;
    }
    keep.placed ||= drop.placed;
    this.groups.delete(drop.id);
  }

  /**
   * Places the given single-piece groups in slots on a ring around the board.
   * Slots are ordered by distance to the board; `ordered` keeps the ids order
   * (closest first), otherwise slots are shuffled.
   */
  private scatter(ids: number[], random: () => number, opts: { ordered?: boolean } = {}) {
    if (ids.length === 0) return;
    const { cols, rows, pieceWidth: pw, pieceHeight: ph } = this.config;
    const boardW = cols * pw;
    const boardH = rows * ph;
    const stepX = pw * 1.35;
    const stepY = ph * 1.35;
    const gap = Math.min(pw, ph) * 0.6;

    const slots: Array<{ x: number; y: number; d: number }> = [];
    for (let ring = 1; slots.length < ids.length; ring++) {
      slots.length = 0;
      const marginX = ring * stepX + gap;
      const marginY = ring * stepY + gap;
      for (let y = -marginY; y + ph <= boardH + marginY; y += stepY) {
        for (let x = -marginX; x + pw <= boardW + marginX; x += stepX) {
          const insideBoard =
            x + pw > -gap && x < boardW + gap && y + ph > -gap && y < boardH + gap;
          if (insideBoard) continue;
          const dx = Math.max(-x, x + pw - boardW, 0);
          const dy = Math.max(-y, y + ph - boardH, 0);
          slots.push({ x, y, d: Math.hypot(dx, dy) });
        }
      }
    }

    if (opts.ordered) {
      slots.sort((a, b) => a.d - b.d);
    } else {
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [slots[i], slots[j]] = [slots[j]!, slots[i]!];
      }
    }

    ids.forEach((groupId, index) => {
      const group = this.groups.get(groupId)!;
      const pieceId = group.pieceIds[0]!;
      const slot = slots[index]!;
      const jitterX = (random() - 0.5) * pw * 0.2;
      const jitterY = (random() - 0.5) * ph * 0.2;
      // Convert the piece's desired world position into a group origin.
      group.x = slot.x + jitterX - (pieceId % cols) * pw;
      group.y = slot.y + jitterY - Math.floor(pieceId / cols) * ph;
    });
  }
}
