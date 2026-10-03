"use client";

import { UNO_CARDS, type UnoCard } from "@puzzle/shared/games/uno";
import { useEffect, useRef } from "react";
import { UNO_HEX, UnoCardBack, UnoCardFace } from "@/components/games/uno/card";

const pick = (color: UnoCard["color"], value: UnoCard["value"]) =>
  UNO_CARDS.find((c) => c.color === color && c.value === value)!;

// Positions are in a 100 × 80 box (the table's aspect ratio), converted to percentages.
const BOX_H = 80;
const PILE = { x: 58, y: 37 };
const DECK = { x: 41, y: 37 };
/** Card width in % of the table; the height follows the 60 × 90 card. */
const CARD_W = 11;

const PLAYERS = [
  { name: "Siz", avatar: "🦊", color: "#6C5CE7", seat: { x: 17, y: 70 } },
  { name: "Malika", avatar: "🐬", color: "#E84393", seat: { x: 10, y: 17 } },
  { name: "Aziz", avatar: "🐯", color: "#0984E3", seat: { x: 90, y: 17 } },
] as const;

/** Where each player's hand is fanned out: own cards face up and big, the others small. */
const HANDS = [
  { x: 54, y: 69, spacing: 7.2, tilt: 6, scale: 1, curve: 0.5 },
  { x: 28, y: 17, spacing: 3.6, tilt: 5, scale: 0.62, curve: 0.15 },
  { x: 72, y: 17, spacing: 3.6, tilt: 5, scale: 0.62, curve: 0.15 },
];

interface Item {
  id: string;
  /** 0 = you, 1–2 = opponents, -1 = the card that starts the pile. */
  owner: number;
  card: UnoCard;
  /** Joins the hand from the deck at this time (else held from the start). */
  drawAt?: number;
  /** Thrown onto the pile at this time. */
  playAt?: number;
  /** Colour the pile takes (a joker's chosen colour). */
  sets?: keyof typeof UNO_HEX;
}

// The story, in seconds. Three friends, one round to the end: match, +2, a joker, «UNO!», a win.
const ITEMS: Item[] = [
  { id: "start", owner: -1, card: pick("blue", "5") },
  { id: "s1", owner: 0, card: pick("blue", "7"), playAt: 0.8 },
  { id: "s2", owner: 0, card: pick("yellow", "2") },
  { id: "s3", owner: 0, card: pick("green", "9"), playAt: 9.6 },
  { id: "s4", owner: 0, card: pick("red", "1") },
  { id: "s5", owner: 0, card: pick("yellow", "skip") },
  { id: "m1", owner: 1, card: pick("red", "7"), playAt: 2.2 },
  { id: "m2", owner: 1, card: pick("blue", "3") },
  { id: "m3", owner: 1, card: pick("wild", "wild"), playAt: 6.4, sets: "green" },
  { id: "m4", owner: 1, card: pick("green", "4"), playAt: 11.0 },
  { id: "m5", owner: 1, card: pick("red", "2") },
  { id: "a1", owner: 2, card: pick("red", "draw2"), playAt: 3.6 },
  { id: "a2", owner: 2, card: pick("green", "3"), playAt: 8.0 },
  { id: "a3", owner: 2, card: pick("yellow", "4"), playAt: 12.4 },
  // The +2 lands on you: two cards come from the deck.
  { id: "d1", owner: 0, card: pick("blue", "0"), drawAt: 4.8 },
  { id: "d2", owner: 0, card: pick("green", "reverse"), drawAt: 5.15 },
];

const FLIGHT = 0.55;
const UNO_AT = 8.6;
const UNO_UNTIL = 12.4;
const WIN_AT = 12.95;
const CYCLE = 16.2;
const FADE = 0.5;
/** Aziz has just said «UNO!» on a green pile: what reduced motion shows. */
const STILL = 9.2;

const CAPTIONS = [
  { from: 0.3, to: 2.1, text: "Rangi yoki raqami mos kartani tashlang" },
  { from: 2.1, to: 3.5, text: "7 ustiga 7: raqam mos keldi" },
  { from: 3.6, to: 6.3, text: "+2: siz 2 ta karta olasiz, navbat o'tadi" },
  { from: 6.4, to: 7.9, text: "Joker: Malika yashil rangni tanladi" },
  { from: 8.0, to: 12.3, text: "Aziz'da bitta karta qoldi" },
];

const EVENTS = ITEMS.flatMap((item) =>
  [item.playAt, item.drawAt]
    .filter((at): at is number => at !== undefined)
    .map((at) => ({ at, owner: item.owner })),
).sort((a, b) => a.at - b.at);
const PLAY_ORDER = ITEMS.filter((i) => i.playAt !== undefined).sort(
  (a, b) => a.playAt! - b.playAt!,
);

const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  x: 8 + ((i * 37) % 86),
  delay: (i % 5) * 0.12,
  color: Object.values(UNO_HEX)[i % 4]!,
  drift: (i % 2 ? 1 : -1) * (2 + (i % 3)),
}));

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 → 0 over [a, b], with soft edges. */
const win = (t: number, a: number, b: number, edge = 0.3) =>
  clamp(Math.min((t - a) / edge, (b - t) / edge));
const ease = (p: number) => 1 - (1 - p) ** 3;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

interface Pose {
  x: number;
  y: number;
  rot: number;
  scale: number;
}

/** A small, fixed jitter so the pile looks thrown, not stacked. */
function pilePose(index: number): Pose {
  const rot = ((index * 47) % 30) - 15;
  return { x: PILE.x + (((index * 13) % 5) - 2) * 0.5, y: PILE.y, rot, scale: 1 };
}

const pct = (pose: Pose) => ({ left: `${pose.x}%`, top: `${(pose.y / BOX_H) * 100}%` });

/**
 * Self-playing hero for the uno landing: three friends play a round to the end. Cards fly
 * from the hands onto the pile, a +2 makes you draw, a joker turns the pile green, Aziz says
 * «UNO!» and wins. DOM + rAF like the other demos; a still scene with reduced motion.
 */
export function UnoDemo() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el: Record<string, HTMLElement> = {};
    rootRef.current
      ?.querySelectorAll<HTMLElement>("[data-k]")
      .forEach((node) => (el[node.dataset.k!] = node));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const begin = performance.now();
    const current = new Map<string, Pose>();
    const launched = new Map<string, Pose>();
    let last = -1;
    let frame = 0;
    const show = (key: string, opacity: number) => {
      const node = el[key];
      if (node) node.style.opacity = String(opacity);
    };
    const place = (key: string, pose: Pose, extra = "") => {
      const node = el[key];
      if (!node) return;
      const { left, top } = pct(pose);
      node.style.left = left;
      node.style.top = top;
      node.style.transform = `translate(-50%, -50%) rotate(${pose.rot}deg) scale(${pose.scale})${extra}`;
    };

    const render = (now: number) => {
      const t = reduced ? STILL : ((now - begin) / 1000) % CYCLE;
      // A new loop (or the still frame): cards jump to their places instead of gliding.
      const snap = reduced || t < last;
      if (snap) {
        current.clear();
        launched.clear();
      }
      last = t;
      show("scene", reduced ? 1 : Math.min(1, t / FADE, (CYCLE - t) / FADE));

      // Hand slots: who still holds what right now.
      const slots = new Map<string, Pose>();
      HANDS.forEach((hand, owner) => {
        const live = ITEMS.filter(
          (i) =>
            i.owner === owner &&
            (i.drawAt === undefined || t >= i.drawAt + FLIGHT) &&
            (i.playAt === undefined || t < i.playAt),
        );
        live.forEach((item, k) => {
          const offset = k - (live.length - 1) / 2;
          slots.set(item.id, {
            x: hand.x + offset * hand.spacing,
            y: hand.y + offset * offset * hand.curve,
            rot: offset * hand.tilt,
            scale: hand.scale,
          });
        });
      });

      ITEMS.forEach((item) => {
        const key = `card-${item.id}`;
        const node = el[key];
        if (!node) return;
        const mine = item.owner === 0;
        let pose: Pose;
        let faceUp = mine || item.owner === -1;
        let z = 10;
        let opacity = 1;

        if (item.owner === -1) {
          pose = pilePose(0);
          z = 100;
        } else if (item.playAt !== undefined && t >= item.playAt) {
          const index = PLAY_ORDER.indexOf(item) + 1;
          const from = launched.get(item.id) ?? current.get(item.id) ?? slots.get(item.id);
          const start = from ?? pilePose(index);
          launched.set(item.id, start);
          const p = clamp((t - item.playAt) / FLIGHT);
          const e = ease(p);
          const to = pilePose(index);
          pose = {
            x: lerp(start.x, to.x, e),
            y: lerp(start.y, to.y, e) - Math.sin(p * Math.PI) * 6,
            rot: lerp(start.rot, to.rot, e),
            scale: lerp(start.scale, 1, e) * (1 + Math.sin(p * Math.PI) * 0.15),
          };
          // Opponents' cards turn over in the air.
          if (!mine) faceUp = p >= 0.5;
          z = 100 + index;
        } else if (item.drawAt !== undefined && t < item.drawAt + FLIGHT) {
          const target = slots.get(item.id) ?? {
            x: HANDS[item.owner]!.x,
            y: HANDS[item.owner]!.y,
            rot: 0,
            scale: HANDS[item.owner]!.scale,
          };
          const p = clamp((t - item.drawAt) / FLIGHT);
          const e = ease(p);
          pose = {
            x: lerp(DECK.x, target.x, e),
            y: lerp(DECK.y, target.y, e),
            rot: lerp(0, target.rot, e),
            scale: lerp(1, target.scale, e),
          };
          faceUp = p >= 0.5;
          opacity = t >= item.drawAt ? 1 : 0;
          z = 200;
        } else {
          const target = slots.get(item.id)!;
          const prev = current.get(item.id);
          const k = snap || !prev ? 1 : 0.16;
          pose = prev
            ? {
                x: lerp(prev.x, target.x, k),
                y: lerp(prev.y, target.y, k),
                rot: lerp(prev.rot, target.rot, k),
                scale: lerp(prev.scale, target.scale, k),
              }
            : target;
          z = 20 + Math.round(pose.x);
        }

        current.set(item.id, pose);
        node.style.zIndex = String(z);
        node.style.opacity = String(opacity);
        place(key, pose);
        show(`back-${item.id}`, faceUp ? 0 : 1);
      });

      // The colour ring under the pile follows the top card; it pulses after the joker.
      const top = PLAY_ORDER.filter((i) => t >= i.playAt! + FLIGHT).at(-1);
      const pileColor = top
        ? UNO_HEX[top.sets ?? (top.card.color as keyof typeof UNO_HEX)]
        : UNO_HEX.blue;
      const ring = el.ring;
      if (ring) {
        const pulse = 1 + win(t, 6.4 + FLIGHT, 8.0, 0.3) * Math.abs(Math.sin(t * 5)) * 0.14;
        ring.style.background = `radial-gradient(circle, ${pileColor}cc 0%, ${pileColor}55 45%, transparent 70%)`;
        ring.style.transform = `translate(-50%, -50%) scale(${pulse})`;
      }

      // Whose turn it is: the owner of the next move.
      const next = EVENTS.find((e) => e.at + 0.3 > t);
      const winner = t >= WIN_AT;
      PLAYERS.forEach((_, i) => {
        const ringNode = el[`turn-${i}`];
        if (ringNode)
          ringNode.style.opacity = String(
            winner ? (i === 2 ? 1 : 0) : next?.owner === i ? 0.6 + Math.sin(t * 6) * 0.4 : 0,
          );
      });

      const uno = win(t, UNO_AT, UNO_UNTIL, 0.2);
      show("uno", uno);
      const bubble = el.uno;
      if (bubble)
        bubble.style.transform = `translate(-50%, 0) scale(${0.6 + 0.4 * ease(clamp((t - UNO_AT) / 0.35))})`;

      CAPTIONS.forEach((c, i) => show(`caption-${i}`, win(t, c.from, c.to, 0.25)));

      const won = win(t, WIN_AT, CYCLE + 1, 0.3);
      show("win", won);
      const banner = el.win;
      if (banner)
        banner.style.transform = `translate(-50%, -50%) scale(${0.7 + 0.3 * ease(clamp((t - WIN_AT) / 0.4))})`;
      CONFETTI.forEach((c, i) => {
        const node = el[`confetti-${i}`];
        if (!node) return;
        const p = clamp((t - WIN_AT - c.delay) / 2.4);
        node.style.opacity = String(p > 0 && p < 1 ? 1 : 0);
        node.style.top = `${-4 + p * 104}%`;
        node.style.transform = `translateX(${Math.sin(p * 9) * c.drift * 4}px) rotate(${p * 540}deg)`;
      });

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#e5484d]/30 via-[#6C5CE7]/20 to-[#2f9e62]/30 blur-3xl" />
      <div
        ref={rootRef}
        role="img"
        aria-label="Uch do'st uno o'ynamoqda: kartalar navbat bilan tashlanadi, +2 bilan karta olinadi, joker rangni yashilga o'zgartiradi, Aziz «UNO!» deb oxirgi kartasini tashlab yutadi"
        className="table-felt relative aspect-[10/8] w-full overflow-hidden rounded-[32px] shadow-soft-lg ring-4 ring-[#1d3f36] select-none"
      >
        <div data-k="scene" aria-hidden className="absolute inset-0" style={{ opacity: 0 }}>
          <div
            data-k="ring"
            className="absolute aspect-square w-[34%] rounded-full"
            style={{ ...pct({ ...PILE, rot: 0, scale: 1 }), transform: "translate(-50%, -50%)" }}
          />

          {/* The deck: a few backs, slightly offset. */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                ...pct({ ...DECK, rot: 0, scale: 1 }),
                width: `${CARD_W}%`,
                transform: `translate(calc(-50% + ${i * 1.5}px), calc(-50% - ${i * 1.5}px))`,
              }}
            >
              <UnoCardBack className="h-auto w-full drop-shadow-md" />
            </div>
          ))}

          {PLAYERS.map((player, i) => (
            <div
              key={player.name}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={pct({ ...player.seat, rot: 0, scale: 1 })}
            >
              <div className="relative">
                <span
                  data-k={`turn-${i}`}
                  className="absolute -inset-1.5 rounded-full ring-[3px] ring-[#ffd166]"
                  style={{ opacity: 0 }}
                />
                <span
                  className="flex size-9 items-center justify-center rounded-full text-lg ring-2 ring-white sm:size-11 sm:text-xl"
                  style={{ backgroundColor: player.color }}
                >
                  {player.avatar}
                </span>
              </div>
              <span className="mt-1 text-[11px] font-semibold text-white/90 sm:text-xs">
                {player.name}
              </span>
            </div>
          ))}

          {ITEMS.map((item) => (
            <div
              key={item.id}
              data-k={`card-${item.id}`}
              className="absolute will-change-transform"
              style={{ width: `${CARD_W}%`, left: 0, top: 0, opacity: 0 }}
            >
              <UnoCardFace card={item.card} className="h-auto w-full drop-shadow-md" />
              <div data-k={`back-${item.id}`} className="absolute inset-0">
                <UnoCardBack className="h-auto w-full" />
              </div>
            </div>
          ))}

          <div
            data-k="uno"
            className="absolute z-[300] origin-top rounded-2xl bg-[#ffd166] px-3 py-1 font-display text-base font-black text-[#e5484d] shadow-soft-md sm:text-lg"
            style={{ left: `${PLAYERS[2].seat.x - 6}%`, top: "35%", opacity: 0 }}
          >
            UNO!
            <span className="absolute -top-1.5 right-4 size-3 rotate-45 bg-[#ffd166]" />
          </div>

          {CAPTIONS.map((c, i) => (
            <div
              key={c.text}
              data-k={`caption-${i}`}
              className="absolute top-[64%] left-1/2 z-[250] w-max max-w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-1 text-center text-[11px] font-semibold text-white backdrop-blur-sm sm:text-sm"
              style={{ opacity: 0 }}
            >
              {c.text}
            </div>
          ))}

          <div
            data-k="win"
            className="absolute top-1/2 left-1/2 z-[400] w-max max-w-[86%] rounded-2xl bg-white px-5 py-3 text-center shadow-soft-lg"
            style={{ opacity: 0 }}
          >
            <div className="font-display text-xl font-black text-[#1c1a24] sm:text-2xl">
              G&apos;alaba! 🎉
            </div>
            <div className="text-xs font-medium text-[#6b6880] sm:text-sm">
              Aziz birinchi bo&apos;lib kartalarini tugatdi
            </div>
          </div>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              data-k={`confetti-${i}`}
              className="absolute z-[350] h-2.5 w-1.5 rounded-[2px]"
              style={{ left: `${c.x}%`, top: "-4%", backgroundColor: c.color, opacity: 0 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
