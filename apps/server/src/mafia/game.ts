import { randomInt } from "node:crypto";
import {
  BEST_MOVE_SIZE,
  MAFIA_DRAW_NIGHTS,
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  mafiaRoleDeck,
  MAFIA_TIMINGS,
  NIGHT_PHASES,
  teamOf,
  type MafiaAction,
  type MafiaActionResult,
  type MafiaCheckView,
  type MafiaEvent,
  type MafiaExit,
  type MafiaPhaseKind,
  type MafiaResult,
  type MafiaRole,
  type MafiaTimings,
  type MafiaView,
} from "@puzzle/shared/mafia";

/**
 * Sports mafia game engine: a pure state machine with no I/O and no timers.
 * The room calls the action methods and `advance(now)`; everything a person may
 * see comes out of `viewFor`. Clause numbers refer to the official ФСМ rules.
 */

export interface MafiaPlayerInput {
  id: string;
  name: string;
}

export interface MafiaGameOptions {
  /** Uniform integer in [0, max). Defaults to node:crypto (never Math.random: roles must be unguessable). */
  random?: (max: number) => number;
  timings?: Partial<MafiaTimings>;
}

/** JSON-safe copy of a game, for persistence. Contains the roles: never send it to a client. */
export interface MafiaGameSnapshot {
  version: 1;
  savedAt: number;
  seats: SeatState[];
  phase: Phase;
  day: number;
  night: number;
  firstSpeaker: number;
  nominations: Array<{ seat: number; by: number }>;
  votes: Array<[number, number]>;
  liftVotes: Array<[number, boolean]>;
  skipVoting: boolean;
  day1Exits: number;
  shots: Array<[number, number]>;
  donChecked: boolean;
  sheriffChecked: boolean;
  donChecks: MafiaCheckView[];
  sheriffChecks: MafiaCheckView[];
  killedTonight: number | null;
  bestMoveSeat: number | null;
  bestMovePick: number[] | null;
  announcedBestMove: { seat: number; seats: number[] } | null;
  nightsUnchanged: number;
  events: MafiaEvent[];
  result: MafiaResult | null;
}

interface SeatState {
  seat: number;
  playerId: string;
  name: string;
  role: MafiaRole;
  alive: boolean;
  exit: MafiaExit | null;
  connected: boolean;
}

/** Where the game goes once the last words are over (unless it has been decided by then). */
type AfterWords = "night" | "day";

type Phase =
  | { kind: "roleReveal"; endsAt: number }
  | { kind: "zeroNight"; endsAt: number }
  | { kind: "speech"; endsAt: number; speaker: number; queue: number[] }
  | { kind: "voting"; endsAt: number; candidates: number[]; round: number }
  | {
      kind: "tieSpeech";
      endsAt: number;
      speaker: number;
      queue: number[];
      candidates: number[];
      round: number;
    }
  | { kind: "liftAllVote"; endsAt: number; candidates: number[] }
  | { kind: "lastWords"; endsAt: number; speaker: number; queue: number[]; then: AfterWords }
  | { kind: "shoot"; endsAt: number }
  | { kind: "donCheck"; endsAt: number }
  | { kind: "sheriffCheck"; endsAt: number }
  | { kind: "bestMove"; endsAt: number }
  | { kind: "dawn"; endsAt: number }
  | { kind: "gameOver"; endsAt: number };

/** Set only while MafiaGame.restore runs its constructor. */
let restoring: MafiaGameSnapshot | null = null;

export class MafiaGame {
  private readonly timings: MafiaTimings;
  private readonly random: (max: number) => number;
  private readonly seats: SeatState[];
  private readonly bySeat = new Map<number, SeatState>();
  private readonly byPlayer = new Map<string, SeatState>();

  private phaseState: Phase;
  private day = 0;
  private night = 0;
  private firstSpeaker = 0;

  // Day
  private nominations: Array<{ seat: number; by: number }> = [];
  private readonly votes = new Map<number, number>();
  private readonly liftVotes = new Map<number, boolean>();
  /** 7.1: someone left the table, so the current or next voting is not held. */
  private skipVoting = false;
  private day1Exits = 0;

  // Night
  private readonly shots = new Map<number, number>();
  private donChecked = false;
  private sheriffChecked = false;
  private readonly donChecks: MafiaCheckView[] = [];
  private readonly sheriffChecks: MafiaCheckView[] = [];
  private killedTonight: number | null = null;
  private bestMoveSeat: number | null = null;
  private bestMovePick: number[] | null = null;
  private announcedBestMove: { seat: number; seats: number[] } | null = null;
  private nightsUnchanged = 0;

  private readonly events: MafiaEvent[] = [];
  private finalResult: MafiaResult | null = null;

  constructor(players: MafiaPlayerInput[], now: number, options: MafiaGameOptions = {}) {
    this.timings = { ...MAFIA_TIMINGS, ...options.timings };
    this.random = options.random ?? ((max) => randomInt(max));
    if (restoring) {
      // See MafiaGame.restore: the seats come from the snapshot, nothing is dealt.
      this.seats = restoring.seats.map((seat) => ({ ...seat }));
      this.indexSeats();
      this.phaseState = { kind: "roleReveal", endsAt: now };
      return;
    }
    // Ten is the official table; six to twelve is the club variant with the same rules.
    if (players.length < MAFIA_MIN_PLAYERS || players.length > MAFIA_MAX_PLAYERS) {
      throw new Error(
        `mafia needs ${MAFIA_MIN_PLAYERS}–${MAFIA_MAX_PLAYERS} players, got ${players.length}`,
      );
    }
    if (new Set(players.map((p) => p.id)).size !== players.length) {
      throw new Error("player ids must be unique");
    }
    // Seats and roles are dealt independently, both uniformly at random.
    const order = this.shuffle(players);
    const deck = this.shuffle(mafiaRoleDeck(players.length));
    this.seats = order.map((player, i) => ({
      seat: i + 1,
      playerId: player.id,
      name: player.name,
      role: deck[i]!,
      alive: true,
      exit: null,
      connected: true,
    }));
    this.indexSeats();
    this.phaseState = { kind: "roleReveal", endsAt: now + this.timings.roleReveal };
  }

  private indexSeats() {
    for (const seat of this.seats) {
      this.bySeat.set(seat.seat, seat);
      this.byPlayer.set(seat.playerId, seat);
    }
  }

  // ---------------------------------------------------------------- persistence

  snapshot(now: number): MafiaGameSnapshot {
    return structuredClone({
      version: 1 as const,
      savedAt: now,
      seats: this.seats,
      phase: this.phaseState,
      day: this.day,
      night: this.night,
      firstSpeaker: this.firstSpeaker,
      nominations: this.nominations,
      votes: [...this.votes],
      liftVotes: [...this.liftVotes],
      skipVoting: this.skipVoting,
      day1Exits: this.day1Exits,
      shots: [...this.shots],
      donChecked: this.donChecked,
      sheriffChecked: this.sheriffChecked,
      donChecks: this.donChecks,
      sheriffChecks: this.sheriffChecks,
      killedTonight: this.killedTonight,
      bestMoveSeat: this.bestMoveSeat,
      bestMovePick: this.bestMovePick,
      announcedBestMove: this.announcedBestMove,
      nightsUnchanged: this.nightsUnchanged,
      events: this.events,
      result: this.finalResult,
    });
  }

  /**
   * Rebuilds a game from a snapshot. The current phase keeps the time it had left when it was
   * saved, counted from `now`, so a server restart never cuts a speech or a night short.
   */
  static restore(
    snapshot: MafiaGameSnapshot,
    now: number,
    options: MafiaGameOptions = {},
  ): MafiaGame {
    const data = structuredClone(snapshot);
    restoring = data;
    let game: MafiaGame;
    try {
      game = new MafiaGame([], now, options);
    } finally {
      restoring = null;
    }
    const remaining = Math.max(0, data.phase.endsAt - data.savedAt);
    game.phaseState = {
      ...data.phase,
      endsAt: data.phase.kind === "gameOver" ? now : now + remaining,
    };
    game.day = data.day;
    game.night = data.night;
    game.firstSpeaker = data.firstSpeaker;
    game.nominations = data.nominations;
    for (const [voter, target] of data.votes) game.votes.set(voter, target);
    for (const [voter, agree] of data.liftVotes) game.liftVotes.set(voter, agree);
    game.skipVoting = data.skipVoting;
    game.day1Exits = data.day1Exits;
    for (const [shooter, target] of data.shots) game.shots.set(shooter, target);
    game.donChecked = data.donChecked;
    game.sheriffChecked = data.sheriffChecked;
    game.donChecks.push(...data.donChecks);
    game.sheriffChecks.push(...data.sheriffChecks);
    game.killedTonight = data.killedTonight;
    game.bestMoveSeat = data.bestMoveSeat;
    game.bestMovePick = data.bestMovePick;
    game.announcedBestMove = data.announcedBestMove;
    game.nightsUnchanged = data.nightsUnchanged;
    game.events.push(...data.events);
    game.finalResult = data.result;
    return game;
  }

  // ---------------------------------------------------------------- read access (server only)

  get phase(): MafiaPhaseKind {
    return this.phaseState.kind;
  }

  get endsAt(): number {
    return this.phaseState.endsAt;
  }

  get result(): MafiaResult | null {
    return this.finalResult;
  }

  get dayNumber(): number {
    return this.day;
  }

  get nightNumber(): number {
    return this.night;
  }

  get log(): readonly MafiaEvent[] {
    return this.events;
  }

  seatOf(playerId: string): number | null {
    return this.byPlayer.get(playerId)?.seat ?? null;
  }

  playerAt(seat: number): string | null {
    return this.bySeat.get(seat)?.playerId ?? null;
  }

  /** Secret: for the server and tests only, never sent as is. */
  roleAt(seat: number): MafiaRole | null {
    return this.bySeat.get(seat)?.role ?? null;
  }

  isAlive(seat: number): boolean {
    return this.bySeat.get(seat)?.alive ?? false;
  }

  aliveSeats(): number[] {
    return this.seats.filter((s) => s.alive).map((s) => s.seat);
  }

  /** Seat whose microphone is open, if any. */
  get speaker(): number | null {
    const phase = this.phaseState;
    return phase.kind === "speech" || phase.kind === "tieSpeech" || phase.kind === "lastWords"
      ? phase.speaker
      : null;
  }

  // ---------------------------------------------------------------- time

  /** Runs every transition that is due at `now`. */
  advance(now: number) {
    while (this.phaseState.kind !== "gameOver" && this.phaseState.endsAt <= now) {
      this.next(this.phaseState.endsAt);
    }
  }

  setConnected(playerId: string, connected: boolean) {
    const seat = this.byPlayer.get(playerId);
    if (seat) seat.connected = connected;
  }

  /**
   * The player left the table for good (e.g. did not come back after a disconnect).
   * Like a disqualification: the role stays hidden and, per 7.1, the current or next
   * voting is not held.
   */
  removePlayer(playerId: string, now: number): MafiaActionResult {
    const seat = this.byPlayer.get(playerId);
    if (!seat) return { ok: false, error: "not_a_player" };
    if (!seat.alive) return { ok: false, error: "dead" };
    if (this.phaseState.kind === "gameOver") return { ok: false, error: "wrong_phase" };

    seat.alive = false;
    seat.exit = "left";
    this.nightsUnchanged = 0;
    this.events.push({ type: "left", seat: seat.seat });
    this.nominations = this.nominations.filter((n) => n.seat !== seat.seat);

    const result = this.winner();
    if (result) {
      this.finish(result, now);
      return { ok: true };
    }

    const phase = this.phaseState;
    switch (phase.kind) {
      case "speech":
        this.skipVoting = true;
        if (phase.speaker === seat.seat) this.next(now);
        else phase.queue = phase.queue.filter((s) => s !== seat.seat);
        break;
      case "voting":
      case "tieSpeech":
      case "liftAllVote":
        this.events.push({ type: "noVote", reason: "playerLeft" });
        this.startNight(now);
        break;
      case "lastWords":
        if (phase.speaker === seat.seat) this.next(now);
        else phase.queue = phase.queue.filter((s) => s !== seat.seat);
        break;
      default:
        // Night (or role reveal): the next day's voting is not held.
        this.skipVoting = true;
        if (this.killedTonight === seat.seat) this.killedTonight = null;
        if (this.bestMoveSeat === seat.seat) this.bestMoveSeat = null;
        break;
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- actions

  /** Ends the viewer's own minute early ("Pas" / "Spasibo", 4.3.5). */
  pass(playerId: string, now: number): MafiaActionResult {
    const check = this.canPass(playerId);
    if (!check.ok) return check;
    this.next(now);
    return check;
  }

  /** 4.4.2–4.4.3: during one's own minute, one candidate per day, each candidate once. */
  nominate(playerId: string, target: number): MafiaActionResult {
    const check = this.canNominate(playerId, target);
    if (!check.ok) return check;
    const by = this.byPlayer.get(playerId)!.seat;
    this.nominations.push({ seat: target, by });
    this.events.push({ type: "nominated", by, seat: target });
    return check;
  }

  /** 4.4.7: one vote against one candidate. */
  vote(playerId: string, target: number): MafiaActionResult {
    const check = this.canVote(playerId, target);
    if (!check.ok) return check;
    this.votes.set(this.byPlayer.get(playerId)!.seat, target);
    return check;
  }

  /** 4.4.12.3: "Should all the candidates leave the table?" */
  liftAll(playerId: string, agree: boolean): MafiaActionResult {
    const check = this.canLiftAll(playerId);
    if (!check.ok) return check;
    this.liftVotes.set(this.byPlayer.get(playerId)!.seat, agree);
    return check;
  }

  /** 4.5.3: every living black player shoots; a kill needs them all on the same seat. */
  shoot(playerId: string, target: number): MafiaActionResult {
    const check = this.canShoot(playerId, target);
    if (!check.ok) return check;
    this.shots.set(this.byPlayer.get(playerId)!.seat, target);
    return check;
  }

  /** 4.5.6 / 4.5.7: the Don looks for the Sheriff, the Sheriff checks a team. One check a night each. */
  check(playerId: string, target: number): MafiaActionResult {
    const allowed = this.canCheck(playerId, target);
    if (!allowed.ok) return allowed;
    const role = this.byPlayer.get(playerId)!.role;
    const targetRole = this.bySeat.get(target)!.role;
    if (role === "don") {
      this.donChecked = true;
      this.donChecks.push({
        night: this.night,
        seat: target,
        result: targetRole === "sheriff" ? "sheriff" : "not-sheriff",
      });
    } else {
      this.sheriffChecked = true;
      this.sheriffChecks.push({ night: this.night, seat: target, result: teamOf(targetRole) });
    }
    return allowed;
  }

  /** 4.5.9: the player killed on the first shooting night names three seats they think are black. */
  bestMove(playerId: string, seats: number[]): MafiaActionResult {
    const check = this.canBestMove(playerId, seats);
    if (!check.ok) return check;
    this.bestMovePick = [...seats];
    return check;
  }

  // ---------------------------------------------------------------- validation

  private player(playerId: string): SeatState | MafiaActionResult {
    const seat = this.byPlayer.get(playerId);
    if (!seat) return { ok: false, error: "not_a_player" };
    if (!seat.alive) return { ok: false, error: "dead" };
    return seat;
  }

  private canPass(playerId: string): MafiaActionResult {
    const phase = this.phaseState;
    const seat = this.byPlayer.get(playerId);
    if (!seat) return { ok: false, error: "not_a_player" };
    if (phase.kind !== "speech" && phase.kind !== "tieSpeech" && phase.kind !== "lastWords") {
      return { ok: false, error: "wrong_phase" };
    }
    // Last words belong to a player who is already out of the game.
    if (phase.kind !== "lastWords" && !seat.alive) return { ok: false, error: "dead" };
    if (phase.speaker !== seat.seat) return { ok: false, error: "not_your_turn" };
    return { ok: true };
  }

  private canNominate(playerId: string, target: number): MafiaActionResult {
    const seat = this.player(playerId);
    if ("ok" in seat) return seat;
    const phase = this.phaseState;
    if (phase.kind !== "speech") return { ok: false, error: "wrong_phase" };
    if (phase.speaker !== seat.seat) return { ok: false, error: "not_your_turn" };
    if (this.nominations.some((n) => n.by === seat.seat))
      return { ok: false, error: "already_done" };
    if (!this.isAlive(target) || this.nominations.some((n) => n.seat === target)) {
      return { ok: false, error: "invalid_target" };
    }
    return { ok: true };
  }

  private canVote(playerId: string, target?: number): MafiaActionResult {
    const seat = this.player(playerId);
    if ("ok" in seat) return seat;
    const phase = this.phaseState;
    if (phase.kind !== "voting") return { ok: false, error: "wrong_phase" };
    if (this.votes.has(seat.seat)) return { ok: false, error: "already_done" };
    if (target !== undefined && !phase.candidates.includes(target)) {
      return { ok: false, error: "invalid_target" };
    }
    return { ok: true };
  }

  private canLiftAll(playerId: string): MafiaActionResult {
    const seat = this.player(playerId);
    if ("ok" in seat) return seat;
    if (this.phaseState.kind !== "liftAllVote") return { ok: false, error: "wrong_phase" };
    if (this.liftVotes.has(seat.seat)) return { ok: false, error: "already_done" };
    return { ok: true };
  }

  private canShoot(playerId: string, target?: number): MafiaActionResult {
    const seat = this.player(playerId);
    if ("ok" in seat) return seat;
    if (this.phaseState.kind !== "shoot") return { ok: false, error: "wrong_phase" };
    if (teamOf(seat.role) !== "black") return { ok: false, error: "not_allowed" };
    if (this.shots.has(seat.seat)) return { ok: false, error: "already_done" };
    if (target !== undefined && !this.isAlive(target))
      return { ok: false, error: "invalid_target" };
    return { ok: true };
  }

  private canCheck(playerId: string, target?: number): MafiaActionResult {
    const seat = this.player(playerId);
    if ("ok" in seat) return seat;
    const kind = this.phaseState.kind;
    if (kind !== "donCheck" && kind !== "sheriffCheck") return { ok: false, error: "wrong_phase" };
    const role = kind === "donCheck" ? "don" : "sheriff";
    if (seat.role !== role) return { ok: false, error: "not_allowed" };
    if (role === "don" ? this.donChecked : this.sheriffChecked) {
      return { ok: false, error: "already_done" };
    }
    // Only players still at the table can be checked.
    if (target !== undefined && (target === seat.seat || !this.isAlive(target))) {
      return { ok: false, error: "invalid_target" };
    }
    return { ok: true };
  }

  private canBestMove(playerId: string, seats?: number[]): MafiaActionResult {
    const seat = this.byPlayer.get(playerId);
    if (!seat) return { ok: false, error: "not_a_player" };
    if (this.phaseState.kind !== "bestMove") return { ok: false, error: "wrong_phase" };
    if (seat.seat !== this.bestMoveSeat) return { ok: false, error: "not_allowed" };
    if (this.bestMovePick) return { ok: false, error: "already_done" };
    if (
      seats !== undefined &&
      (seats.length !== BEST_MOVE_SIZE ||
        new Set(seats).size !== seats.length ||
        seats.some((s) => s === seat.seat || !this.isAlive(s)))
    ) {
      return { ok: false, error: "invalid_target" };
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------- transitions

  private next(t: number) {
    const phase = this.phaseState;
    switch (phase.kind) {
      case "roleReveal":
        this.night = 1;
        this.events.push({ type: "night", night: 1 });
        this.phaseState = { kind: "zeroNight", endsAt: t + this.timings.zeroNight };
        return;
      case "zeroNight":
        return this.startDay(t);
      case "speech":
        if (phase.queue.length > 0) return this.startSpeech(phase.queue, t);
        return this.endDiscussion(t);
      case "voting":
        return this.countVotes(phase.candidates, phase.round, t);
      case "tieSpeech":
        if (phase.queue.length > 0) {
          const [speaker, ...queue] = phase.queue;
          this.phaseState = {
            ...phase,
            speaker: speaker!,
            queue,
            endsAt: t + this.timings.tieSpeech,
          };
          return;
        }
        return this.startVoting(phase.candidates, phase.round + 1, t);
      case "liftAllVote":
        return this.countLiftAll(phase.candidates, t);
      case "lastWords":
        if (phase.queue.length > 0) {
          const [speaker, ...queue] = phase.queue;
          this.phaseState = {
            ...phase,
            speaker: speaker!,
            queue,
            endsAt: t + this.timings.lastWords,
          };
          return;
        }
        {
          // Decided at the elimination, but checked again here: someone may have left meanwhile.
          const result = this.winner();
          if (result) return this.finish(result, t);
        }
        if (phase.then === "night") return this.startNight(t);
        return this.startDay(t);
      case "shoot":
        this.resolveShots();
        this.phaseState = { kind: "donCheck", endsAt: t + this.timings.donCheck };
        return;
      case "donCheck":
        this.phaseState = { kind: "sheriffCheck", endsAt: t + this.timings.sheriffCheck };
        return;
      case "sheriffCheck":
        // 4.5.9 / 7.10: best move for the first player shot, unless day one voted out two or more.
        this.bestMoveSeat =
          this.night === 2 && this.killedTonight !== null && this.day1Exits < 2
            ? this.killedTonight
            : null;
        if (this.bestMoveSeat !== null) {
          this.phaseState = { kind: "bestMove", endsAt: t + this.timings.bestMove };
          return;
        }
        return this.startDawn(t);
      case "bestMove":
        return this.startDawn(t);
      case "dawn":
        return this.afterDawn(t);
      case "gameOver":
        return;
    }
  }

  private startDay(t: number) {
    this.day++;
    this.events.push({ type: "day", day: this.day });
    this.nominations = [];
    this.votes.clear();
    this.liftVotes.clear();

    // 4.3.2: day one starts with seat 1, each later day with the player after the previous day's first speaker.
    const alive = this.aliveSeats();
    const start = this.day === 1 ? 1 : this.firstSpeaker + 1;
    const first = this.nextAliveFrom(start);
    this.firstSpeaker = first;
    const index = alive.indexOf(first);
    const order = [...alive.slice(index), ...alive.slice(0, index)];
    this.startSpeech(order, t);
  }

  /** The first living seat at or after `seat`, going round the table. */
  private nextAliveFrom(seat: number): number {
    const size = this.seats.length;
    for (let i = 0; i < size; i++) {
      const candidate = ((seat - 1 + i) % size) + 1;
      if (this.isAlive(candidate)) return candidate;
    }
    throw new Error("nobody is alive");
  }

  private startSpeech(queue: number[], t: number) {
    const [speaker, ...rest] = queue;
    const seat = this.bySeat.get(speaker!)!;
    const length = seat.connected ? this.timings.speech : this.timings.absentSpeaker;
    this.phaseState = { kind: "speech", speaker: speaker!, queue: rest, endsAt: t + length };
  }

  private endDiscussion(t: number) {
    const candidates = this.nominations.map((n) => n.seat).filter((s) => this.isAlive(s));
    if (this.skipVoting) {
      this.skipVoting = false;
      this.events.push({ type: "noVote", reason: "playerLeft" });
      return this.startNight(t);
    }
    if (candidates.length === 0) {
      this.events.push({ type: "noVote", reason: "noCandidates" });
      return this.startNight(t);
    }
    // 4.4.10: on day one a single candidate is not voted on.
    if (this.day === 1 && candidates.length === 1) {
      this.events.push({ type: "noVote", reason: "firstDaySingle" });
      return this.startNight(t);
    }
    this.startVoting(candidates, 1, t);
  }

  private startVoting(candidates: number[], round: number, t: number) {
    this.votes.clear();
    this.phaseState = {
      kind: "voting",
      candidates,
      round,
      endsAt: t + this.timings.votePerCandidate * candidates.length,
    };
  }

  private countVotes(candidates: number[], round: number, t: number) {
    const last = candidates[candidates.length - 1]!;
    const tally = new Map<number, number[]>(candidates.map((c) => [c, []]));
    for (const voter of this.aliveSeats()) {
      // 4.4.8: a player who did not vote votes against the last candidate.
      tally.get(this.votes.get(voter) ?? last)!.push(voter);
    }
    this.events.push({
      type: "votes",
      round,
      tally: candidates.map((seat) => ({ seat, voters: tally.get(seat)! })),
    });

    const most = Math.max(...candidates.map((c) => tally.get(c)!.length));
    const leaders = candidates.filter((c) => tally.get(c)!.length === most);
    // 4.4.11: the player with the most votes leaves.
    if (leaders.length === 1) return this.voteOut(leaders, t);

    this.events.push({ type: "tie", seats: leaders });
    // 4.4.12.3: a repeated tie between the very same candidates goes to the "all leave?" vote.
    if (round > 1 && leaders.length === candidates.length) {
      // 7.8: no such vote when every player at the table is a candidate.
      if (leaders.length === this.aliveSeats().length) return this.startNight(t);
      this.liftVotes.clear();
      this.phaseState = {
        kind: "liftAllVote",
        candidates: leaders,
        endsAt: t + this.timings.liftAllVote,
      };
      return;
    }
    // 4.4.12 / 4.4.12.2: the tied players get 30 seconds each, in nomination order, then a revote.
    const [speaker, ...queue] = leaders;
    this.phaseState = {
      kind: "tieSpeech",
      speaker: speaker!,
      queue,
      candidates: leaders,
      round,
      endsAt: t + this.timings.tieSpeech,
    };
  }

  private countLiftAll(candidates: number[], t: number) {
    const alive = this.aliveSeats();
    const yes = alive.filter((seat) => this.liftVotes.get(seat) === true);
    // 4.4.12.3: a majority must vote for it; against or an even split keeps everyone.
    const passed = yes.length * 2 > alive.length;
    this.events.push({ type: "liftAll", seats: candidates, yes, passed });
    if (passed) return this.voteOut(candidates, t);
    this.startNight(t);
  }

  private voteOut(seats: number[], t: number) {
    for (const seat of seats) {
      const state = this.bySeat.get(seat)!;
      state.alive = false;
      state.exit = "voted";
    }
    if (this.day === 1) this.day1Exits += seats.length;
    this.nightsUnchanged = 0;
    this.events.push({ type: "votedOut", seats });
    // 4.4.13 / 7.9: last words, even when this vote decided the game.
    this.startLastWords(seats, "night", t);
  }

  private startLastWords(seats: number[], then: AfterWords, t: number) {
    const [speaker, ...queue] = seats;
    this.phaseState = {
      kind: "lastWords",
      speaker: speaker!,
      queue,
      then,
      endsAt: t + this.timings.lastWords,
    };
  }

  private startNight(t: number) {
    this.night++;
    this.events.push({ type: "night", night: this.night });
    this.shots.clear();
    this.donChecked = false;
    this.sheriffChecked = false;
    this.killedTonight = null;
    this.bestMoveSeat = null;
    this.bestMovePick = null;
    this.phaseState = { kind: "shoot", endsAt: t + this.timings.shoot };
  }

  /** 4.5.4 / 4.5.5: a kill only when every living black player shot the same living seat. */
  private resolveShots() {
    const shooters = this.seats.filter((s) => s.alive && teamOf(s.role) === "black");
    const targets = shooters.map((s) => this.shots.get(s.seat));
    const first = targets[0];
    const agreed =
      shooters.length > 0 &&
      first !== undefined &&
      targets.every((target) => target === first) &&
      this.isAlive(first);
    this.killedTonight = agreed ? first : null;
  }

  private startDawn(t: number) {
    const killed = this.killedTonight;
    if (killed !== null && this.isAlive(killed)) {
      const state = this.bySeat.get(killed)!;
      state.alive = false;
      state.exit = "killed";
      this.nightsUnchanged = 0;
      this.events.push({ type: "killed", seat: killed });
    } else {
      this.killedTonight = null;
      this.nightsUnchanged++;
      this.events.push({ type: "miss" });
    }
    if (this.bestMoveSeat !== null && this.bestMovePick) {
      this.announcedBestMove = { seat: this.bestMoveSeat, seats: this.bestMovePick };
      this.events.push({ type: "bestMove", seat: this.bestMoveSeat, seats: this.bestMovePick });
    }
    this.phaseState = { kind: "dawn", endsAt: t + this.timings.dawn };
  }

  private afterDawn(t: number) {
    const killed = this.killedTonight;
    if (killed !== null) {
      // 4.5.4 / 7.9: the killed player gets a last minute, also when the kill decided the game.
      return this.startLastWords([killed], "day", t);
    }
    // 7.7: three nights in a row without anyone leaving the table is a draw.
    if (this.nightsUnchanged >= MAFIA_DRAW_NIGHTS) return this.finish("draw", t);
    this.startDay(t);
  }

  /** 1.4: red wins when every black player is out; black when it is at least as many as red. */
  private winner(): MafiaResult | null {
    let red = 0;
    let black = 0;
    for (const seat of this.seats) {
      if (!seat.alive) continue;
      if (teamOf(seat.role) === "black") black++;
      else red++;
    }
    if (black === 0) return "red";
    if (black >= red) return "black";
    return null;
  }

  private finish(result: MafiaResult, t: number) {
    this.finalResult = result;
    this.events.push({ type: "gameOver", result });
    this.phaseState = { kind: "gameOver", endsAt: t };
  }

  // ---------------------------------------------------------------- views

  /** Everything `playerId` may know. Pass `null` for a spectator. */
  viewFor(playerId: string | null): MafiaView {
    const me = playerId ? (this.byPlayer.get(playerId) ?? null) : null;
    const phase = this.phaseState;
    const over = phase.kind === "gameOver";
    const black = me !== null && me.alive && teamOf(me.role) === "black";

    const seesRole = (seat: SeatState) =>
      over || (me !== null && seat.seat === me.seat) || (black && teamOf(seat.role) === "black");

    const ballot =
      phase.kind === "voting" || phase.kind === "tieSpeech" || phase.kind === "liftAllVote"
        ? phase.candidates
        : [];
    const myVote =
      me === null
        ? null
        : phase.kind === "voting"
          ? (this.votes.get(me.seat) ?? null)
          : phase.kind === "liftAllVote"
            ? (this.liftVotes.get(me.seat) ?? null)
            : null;
    const checks =
      me?.role === "sheriff" ? this.sheriffChecks : me?.role === "don" ? this.donChecks : [];

    return {
      phase: this.visiblePhase(me),
      endsAt: phase.endsAt,
      day: this.day,
      night: this.night,
      seats: this.seats.map((seat) => ({
        seat: seat.seat,
        playerId: seat.playerId,
        name: seat.name,
        alive: seat.alive,
        exit: seat.exit,
        role: seesRole(seat) ? seat.role : null,
      })),
      me: me?.seat ?? null,
      speaker: this.speaker,
      nominations: this.nominations.map((n) => ({ ...n })),
      ballot: [...ballot],
      myVote,
      checks: checks.map((c) => ({ ...c })),
      actions: me ? this.actionsFor(me.playerId) : [],
      bestMove: this.announcedBestMove
        ? { seat: this.announcedBestMove.seat, seats: [...this.announcedBestMove.seats] }
        : null,
      log: this.events.map((e) => structuredClone(e)),
      result: this.finalResult,
    };
  }

  /** Night sub-phases stay hidden ("night") from anyone who does not act in them. */
  private visiblePhase(me: SeatState | null): MafiaView["phase"] {
    const kind = this.phaseState.kind;
    if (!NIGHT_PHASES.includes(kind)) return kind;
    // The player shot tonight only leaves the table at dawn, so check the best move first.
    if (kind === "bestMove") return me !== null && me.seat === this.bestMoveSeat ? kind : "night";
    if (!me || !me.alive) return "night";
    const team = teamOf(me.role);
    if (kind === "zeroNight" && team === "black") return kind;
    if (kind === "shoot" && team === "black") return kind;
    if (kind === "donCheck" && me.role === "don") return kind;
    if (kind === "sheriffCheck" && me.role === "sheriff") return kind;
    return "night";
  }

  private actionsFor(playerId: string): MafiaAction[] {
    const actions: MafiaAction[] = [];
    if (this.canPass(playerId).ok) actions.push("pass");
    const phase = this.phaseState;
    if (phase.kind === "speech") {
      const seat = this.byPlayer.get(playerId)!;
      if (
        seat.alive &&
        phase.speaker === seat.seat &&
        !this.nominations.some((n) => n.by === seat.seat)
      ) {
        actions.push("nominate");
      }
    }
    if (this.canVote(playerId).ok) actions.push("vote");
    if (this.canLiftAll(playerId).ok) actions.push("liftAll");
    if (this.canShoot(playerId).ok) actions.push("shoot");
    if (this.canCheck(playerId).ok) actions.push("check");
    if (this.canBestMove(playerId).ok) actions.push("bestMove");
    return actions;
  }

  // ---------------------------------------------------------------- helpers

  /** Fisher–Yates with the injected random source. */
  private shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.random(i + 1);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }
}
