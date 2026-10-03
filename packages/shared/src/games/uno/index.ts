import { z } from "zod";
import type { EngineContext, GameEngine, GameResult } from "../engine";

/*
 * Uno-style card game, one round: the first player to empty their hand wins.
 *
 * Rule choices (kept simple and consistent):
 * - 108 cards. The first discard is flipped from the deck; a Wild Draw Four goes back and the
 *   deck is reshuffled. A first Skip skips seat 0, a first Reverse reverses play and the last
 *   seat (the "dealer") starts, a first Draw Two makes seat 0 draw 2 and lose the turn, a first
 *   Wild lets seat 0 choose the colour (move "color") before playing.
 * - Wild Draw Four may be played at any time; there is no challenge rule.
 * - Reverse with two players acts as Skip.
 * - Not playing means drawing one card. Only that card may then be played; if it is not
 *   playable the turn ends at once, otherwise the player plays it or passes.
 * - Draw Two / Wild Draw Four without stacking: the next player draws and loses the turn.
 *   With stacking, +2 may answer +2 and +4 may answer +4; the player who cannot (or will not)
 *   answer draws the whole total with "draw" and loses the turn.
 * - "Uno!": a play that leaves one card should carry `uno: true`. Otherwise any other player may
 *   "catch" that seat (2 penalty cards) until the next action of the player on turn.
 * - Turn timer: on timeout the player takes a pending penalty, or draws one card, and passes.
 *   A first Wild whose colour is not chosen in time gets a random colour.
 * - A player who leaves puts their hand under the draw pile and is skipped from then on; the
 *   last player left wins ("last-player").
 */

export const UNO_COLORS = ["red", "yellow", "green", "blue"] as const;
export type UnoColor = (typeof UNO_COLORS)[number];
export const UNO_VALUES = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "skip",
  "reverse",
  "draw2",
  "wild",
  "wild4",
] as const;
export type UnoValue = (typeof UNO_VALUES)[number];

export interface UnoCard {
  /** Stable id 0..107. */
  id: number;
  color: UnoColor | "wild";
  value: UnoValue;
}

export const UNO_HAND_SIZE = 7;
export const UNO_TURN_SECONDS = [15, 30, 60] as const;
export type UnoTurnSeconds = (typeof UNO_TURN_SECONDS)[number];
/** How many log entries the state keeps. */
export const UNO_LOG_KEEP = 8;
export const UNO_CATCH_PENALTY = 2;

/** The full deck by id: per colour one 0, two of 1–9, Skip, Reverse, Draw Two; 4 Wild, 4 Wild +4. */
export const UNO_CARDS: readonly UnoCard[] = (() => {
  const cards: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    cards.push({ id: cards.length, color, value: "0" });
    for (const value of UNO_VALUES.slice(1, 13)) {
      cards.push({ id: cards.length, color, value });
      cards.push({ id: cards.length, color, value });
    }
  }
  for (let i = 0; i < 4; i++) cards.push({ id: cards.length, color: "wild", value: "wild" });
  for (let i = 0; i < 4; i++) cards.push({ id: cards.length, color: "wild", value: "wild4" });
  return cards;
})();

export function unoCard(id: number): UnoCard {
  const card = UNO_CARDS[id];
  if (!card) throw new Error(`unknown uno card ${id}`);
  return card;
}

const COLOR_ORDER: Record<UnoCard["color"], number> = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  wild: 4,
};

/** Hand order: by colour (wilds last), then by value. */
export function compareUnoCards(a: UnoCard, b: UnoCard): number {
  return (
    COLOR_ORDER[a.color] - COLOR_ORDER[b.color] ||
    UNO_VALUES.indexOf(a.value) - UNO_VALUES.indexOf(b.value) ||
    a.id - b.id
  );
}

export interface UnoOptions {
  stacking: boolean;
  turnSeconds: UnoTurnSeconds;
}

export const UNO_DEFAULT_OPTIONS: UnoOptions = { stacking: false, turnSeconds: 30 };

export type UnoLogEntry = { n: number; seat: number } & (
  | { kind: "play"; card: UnoCard; color: UnoColor | null; uno: boolean }
  | { kind: "draw"; count: number }
  | { kind: "penalty"; count: number }
  | { kind: "pass" }
  | { kind: "timeout" }
  | { kind: "color"; color: UnoColor }
  | { kind: "catch"; target: number; count: number }
  | { kind: "leave" }
);

/** Distributes Omit over the log union. */
type LogInput = UnoLogEntry extends infer E ? (E extends unknown ? Omit<E, "n"> : never) : never;

export interface UnoState {
  players: number;
  options: UnoOptions;
  hands: number[][];
  /** Draw pile; the top card is the last one. */
  deck: number[];
  /** Discard pile; the top card is the last one. */
  discard: number[];
  /** The colour to match; null while seat `turn` chooses the colour of a first Wild. */
  color: UnoColor | null;
  direction: 1 | -1;
  turn: number;
  /** Server time when the current turn (or colour choice) times out. */
  deadline: number;
  /** The current player drew this turn; `drawnCard` is the drawn card if it can be played. */
  hasDrawn: boolean;
  drawnCard: number | null;
  /** Stacking: cards the current player must draw unless they answer with the same card type. */
  pendingDraw: number;
  pendingType: "draw2" | "wild4" | null;
  /** Seat that went down to one card without saying "Uno!"; catchable until the next action. */
  unoOpen: number | null;
  /** Seats that said "Uno!" for their current last card. */
  unoSaid: boolean[];
  left: boolean[];
  winner: number | null;
  reason: "empty-hand" | "last-player" | null;
  log: UnoLogEntry[];
  logSeq: number;
}

const colorSchema = z.enum(UNO_COLORS);

export const unoMoveSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("play"),
    card: z.number().int().min(0).max(107),
    color: colorSchema.optional(),
    uno: z.boolean().optional(),
  }),
  z.object({ type: z.literal("draw") }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("color"), color: colorSchema }),
  z.object({ type: z.literal("catch"), seat: z.number().int().min(0).max(7) }),
]);
export type UnoMove = z.infer<typeof unoMoveSchema>;

export const unoOptionsSchema = z
  .object({
    stacking: z.boolean().default(false),
    turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
  })
  .default({ ...UNO_DEFAULT_OPTIONS });

export interface UnoView {
  /** The viewer's seat, null for spectators. */
  you: number | null;
  /** The viewer's hand, sorted by colour then value. */
  hand: UnoCard[];
  /** Ids of the viewer's cards that may be played right now. */
  playable: number[];
  /** Cards in each seat's hand. */
  counts: number[];
  left: boolean[];
  top: UnoCard;
  color: UnoColor | null;
  direction: 1 | -1;
  deckCount: number;
  turn: number;
  deadline: number;
  /** Seat `turn` has to choose the colour of the first Wild. */
  choosingColor: boolean;
  pendingDraw: number;
  pendingType: "draw2" | "wild4" | null;
  /** The current player already drew this turn. */
  hasDrawn: boolean;
  /** The card the viewer just drew, when it may be played (viewer's turn only). */
  drawnCard: number | null;
  /** Seats that went down to one card without saying "Uno!" (catchable now). */
  catchable: number[];
  /** Seats holding one card after saying "Uno!". */
  unoSaid: number[];
  log: UnoLogEntry[];
  winner: number | null;
  options: UnoOptions;
}

// ------------------------------------------------------------------ helpers

/** Deep copy of plain JSON data. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function addLog(state: UnoState, entry: LogInput) {
  state.logSeq++;
  state.log.push({ ...entry, n: state.logSeq } as UnoLogEntry);
  if (state.log.length > UNO_LOG_KEEP) state.log.splice(0, state.log.length - UNO_LOG_KEEP);
}

function activeSeats(state: UnoState): number[] {
  const seats: number[] = [];
  for (let s = 0; s < state.players; s++) if (!state.left[s]) seats.push(s);
  return seats;
}

/** The seat `steps` turns after `from`, in the current direction, skipping seats that left. */
function nextSeat(state: UnoState, from: number, steps = 1): number {
  let seat = from;
  for (let k = 0; k < steps; k++) {
    for (let i = 0; i < state.players; i++) {
      seat = (seat + state.direction + state.players) % state.players;
      if (!state.left[seat]) break;
    }
  }
  return seat;
}

function topCard(state: UnoState): UnoCard {
  return unoCard(state.discard[state.discard.length - 1]!);
}

/** Draws up to `count` cards for `seat`, reshuffling the discard pile when the deck runs out. */
function drawCards(state: UnoState, seat: number, count: number, random: () => number): number[] {
  const drawn: number[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      const top = state.discard.pop();
      state.deck = shuffle(state.discard, random);
      state.discard = top === undefined ? [] : [top];
    }
    const card = state.deck.pop();
    if (card === undefined) break;
    state.hands[seat]!.push(card);
    drawn.push(card);
  }
  if (state.hands[seat]!.length !== 1) state.unoSaid[seat] = false;
  return drawn;
}

function canPlay(state: UnoState, card: UnoCard): boolean {
  if (state.color === null) return false;
  if (state.pendingDraw > 0) return card.value === state.pendingType;
  if (card.color === "wild") return true;
  return card.color === state.color || card.value === topCard(state).value;
}

function startTurn(state: UnoState, seat: number, now: number) {
  state.turn = seat;
  state.hasDrawn = false;
  state.drawnCard = null;
  state.deadline = now + state.options.turnSeconds * 1000;
}

function normalizeOptions(options: Partial<UnoOptions> | undefined): UnoOptions {
  const seconds = options?.turnSeconds;
  const turnSeconds =
    seconds !== undefined && (UNO_TURN_SECONDS as readonly number[]).includes(seconds)
      ? seconds
      : UNO_DEFAULT_OPTIONS.turnSeconds;
  return { stacking: options?.stacking === true, turnSeconds };
}

function randomColor(random: () => number): UnoColor {
  return UNO_COLORS[Math.floor(random() * UNO_COLORS.length)] ?? "red";
}

/** The current player takes the pending penalty (or draws one card) and the turn moves on. */
function drawAndEnd(state: UnoState, seat: number, ctx: EngineContext, timeout: boolean) {
  if (state.pendingDraw > 0) {
    const got = drawCards(state, seat, state.pendingDraw, ctx.random);
    addLog(state, { kind: "penalty", seat, count: got.length });
    state.pendingDraw = 0;
    state.pendingType = null;
  } else if (!state.hasDrawn) {
    const got = drawCards(state, seat, 1, ctx.random);
    addLog(state, { kind: "draw", seat, count: got.length });
  } else if (!timeout) {
    addLog(state, { kind: "pass", seat });
  }
  if (timeout) addLog(state, { kind: "timeout", seat });
  startTurn(state, nextSeat(state, seat), ctx.now);
}

// ------------------------------------------------------------------ engine

export const unoEngine: GameEngine<UnoState, UnoMove, UnoView, UnoOptions> = {
  kind: "uno",
  moveSchema: unoMoveSchema,
  optionsSchema: unoOptionsSchema as unknown as z.ZodType<UnoOptions>,

  setup(players, options, ctx) {
    const deck = shuffle(
      UNO_CARDS.map((c) => c.id),
      ctx.random,
    );
    const hands: number[][] = [];
    for (let s = 0; s < players; s++) hands.push(deck.splice(deck.length - UNO_HAND_SIZE));
    // A Wild Draw Four never starts the game: back into the deck, reshuffle, flip again.
    let first = deck.pop()!;
    while (unoCard(first).value === "wild4") {
      deck.push(first);
      shuffle(deck, ctx.random);
      first = deck.pop()!;
    }
    const card = unoCard(first);
    const state: UnoState = {
      players,
      options: normalizeOptions(options),
      hands,
      deck,
      discard: [first],
      color: card.color === "wild" ? null : card.color,
      direction: 1,
      turn: 0,
      deadline: 0,
      hasDrawn: false,
      drawnCard: null,
      pendingDraw: 0,
      pendingType: null,
      unoOpen: null,
      unoSaid: Array.from({ length: players }, () => false),
      left: Array.from({ length: players }, () => false),
      winner: null,
      reason: null,
      log: [],
      logSeq: 0,
    };
    let turn = 0;
    if (card.value === "skip") turn = 1 % players;
    else if (card.value === "reverse") {
      // The dealer (last seat) starts and play goes the other way; with two players this is a skip.
      state.direction = -1;
      turn = players - 1;
    } else if (card.value === "draw2") {
      const got = drawCards(state, 0, 2, ctx.random);
      addLog(state, { kind: "penalty", seat: 0, count: got.length });
      turn = 1 % players;
    }
    startTurn(state, turn, ctx.now);
    return state;
  },

  move(state, seat, move, ctx) {
    if (state.winner !== null) return { ok: false, error: "game_over" };
    if (seat < 0 || seat >= state.players || state.left[seat])
      return { ok: false, error: "not_a_player" };

    if (move.type === "catch") {
      const target = move.seat;
      if (target === seat || state.unoOpen !== target || state.hands[target]?.length !== 1)
        return { ok: false, error: "no_catch" };
      const got = drawCards(state, target, UNO_CATCH_PENALTY, ctx.random);
      addLog(state, { kind: "catch", seat, target, count: got.length });
      state.unoOpen = null;
      return { ok: true, state };
    }

    if (seat !== state.turn) return { ok: false, error: "not_your_turn" };

    if (move.type === "color") {
      if (state.color !== null) return { ok: false, error: "not_choosing" };
      state.color = move.color;
      addLog(state, { kind: "color", seat, color: move.color });
      state.deadline = ctx.now + state.options.turnSeconds * 1000;
      return { ok: true, state };
    }
    if (state.color === null) return { ok: false, error: "choose_color" };

    if (move.type === "draw") {
      if (state.hasDrawn) return { ok: false, error: "already_drawn" };
      // Any action of the player on turn closes the "Uno!" catch window.
      state.unoOpen = null;
      if (state.pendingDraw > 0) {
        drawAndEnd(state, seat, ctx, false);
        return { ok: true, state };
      }
      const [card] = drawCards(state, seat, 1, ctx.random);
      addLog(state, { kind: "draw", seat, count: card === undefined ? 0 : 1 });
      state.hasDrawn = true;
      if (card !== undefined && canPlay(state, unoCard(card))) state.drawnCard = card;
      else startTurn(state, nextSeat(state, seat), ctx.now);
      return { ok: true, state };
    }

    if (move.type === "pass") {
      if (!state.hasDrawn) return { ok: false, error: "cant_pass" };
      state.unoOpen = null;
      drawAndEnd(state, seat, ctx, false);
      return { ok: true, state };
    }

    // play
    const hand = state.hands[seat]!;
    const index = hand.indexOf(move.card);
    if (index < 0) return { ok: false, error: "not_in_hand" };
    if (state.hasDrawn && move.card !== state.drawnCard)
      return { ok: false, error: "only_drawn_card" };
    const card = unoCard(move.card);
    if (!canPlay(state, card)) return { ok: false, error: "cant_play" };
    if (card.color === "wild" && !move.color) return { ok: false, error: "color_required" };

    hand.splice(index, 1);
    state.discard.push(card.id);
    state.color = card.color === "wild" ? move.color! : card.color;
    const saidUno = hand.length === 1 && move.uno === true;
    state.unoSaid[seat] = saidUno;
    state.unoOpen = hand.length === 1 && !saidUno ? seat : null;
    addLog(state, {
      kind: "play",
      seat,
      card,
      color: card.color === "wild" ? state.color : null,
      uno: saidUno,
    });

    if (hand.length === 0) {
      state.winner = seat;
      state.reason = "empty-hand";
      state.hasDrawn = false;
      state.drawnCard = null;
      return { ok: true, state };
    }

    let next = nextSeat(state, seat);
    if (card.value === "skip") next = nextSeat(state, seat, 2);
    else if (card.value === "reverse") {
      state.direction = state.direction === 1 ? -1 : 1;
      next = activeSeats(state).length === 2 ? seat : nextSeat(state, seat);
    } else if (card.value === "draw2" || card.value === "wild4") {
      const count = card.value === "draw2" ? 2 : 4;
      if (state.options.stacking) {
        state.pendingDraw += count;
        state.pendingType = card.value;
      } else {
        const got = drawCards(state, next, count, ctx.random);
        addLog(state, { kind: "penalty", seat: next, count: got.length });
        next = nextSeat(state, next);
      }
    }
    startTurn(state, next, ctx.now);
    return { ok: true, state };
  },

  view(state, seat) {
    const you = seat !== null && seat >= 0 && seat < state.players ? seat : null;
    const own = you === null ? [] : state.hands[you]!.map(unoCard).sort(compareUnoCards);
    const myTurn = you !== null && you === state.turn && state.winner === null;
    let playable: number[] = [];
    if (myTurn && state.color !== null) {
      if (!state.hasDrawn) playable = own.filter((c) => canPlay(state, c)).map((c) => c.id);
      else if (state.drawnCard !== null) playable = [state.drawnCard];
    }
    const counts = state.hands.map((h) => h.length);
    return {
      you,
      hand: own.map((c) => ({ ...c })),
      playable,
      counts,
      left: [...state.left],
      top: { ...topCard(state) },
      color: state.color,
      direction: state.direction,
      deckCount: state.deck.length,
      turn: state.turn,
      deadline: state.deadline,
      choosingColor: state.color === null,
      pendingDraw: state.pendingDraw,
      pendingType: state.pendingType,
      hasDrawn: state.hasDrawn,
      drawnCard: myTurn ? state.drawnCard : null,
      catchable:
        state.unoOpen !== null && counts[state.unoOpen] === 1 && state.winner === null
          ? [state.unoOpen]
          : [],
      unoSaid: counts.flatMap((c, s) => (c === 1 && state.unoSaid[s] ? [s] : [])),
      log: clone(state.log),
      winner: state.winner,
      options: { ...state.options },
    };
  },

  active(state) {
    return state.winner === null ? [state.turn] : [];
  },

  result(state): GameResult | null {
    if (state.winner === null) return null;
    return { winners: [state.winner], draw: false, reason: state.reason ?? "empty-hand" };
  },

  tick(state, ctx) {
    if (state.winner !== null || ctx.now < state.deadline) return null;
    const next = clone(state);
    if (next.color === null) {
      // The first Wild's colour was not chosen in time: a random one, and the turn goes on.
      next.color = randomColor(ctx.random);
      addLog(next, { kind: "color", seat: next.turn, color: next.color });
      next.deadline = ctx.now + next.options.turnSeconds * 1000;
      return next;
    }
    next.unoOpen = null;
    drawAndEnd(next, next.turn, ctx, true);
    return next;
  },

  leave(state, seat, ctx) {
    if (state.winner !== null || seat < 0 || seat >= state.players || state.left[seat])
      return state;
    state.left[seat] = true;
    // Their cards go under the draw pile.
    state.deck.unshift(...state.hands[seat]!);
    state.hands[seat] = [];
    state.unoSaid[seat] = false;
    if (state.unoOpen === seat) state.unoOpen = null;
    addLog(state, { kind: "leave", seat });
    const active = activeSeats(state);
    if (active.length === 1) {
      state.winner = active[0]!;
      state.reason = "last-player";
      return state;
    }
    if (state.turn === seat) {
      if (state.color === null) state.color = randomColor(ctx.random);
      state.pendingDraw = 0;
      state.pendingType = null;
      startTurn(state, nextSeat(state, seat), ctx.now);
    }
    return state;
  },
};
