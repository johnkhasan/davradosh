"use client";

import { useEffect, useRef } from "react";

const W = 560;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const SEAT_R = 178;
const TABLE_R = 124;
const SEATS = 10;

const COLORS = [
  "#6C5CE7",
  "#E84393",
  "#0984E3",
  "#00B894",
  "#E17055",
  "#FDAA2C",
  "#00CEC9",
  "#A29BFE",
  "#FD79A8",
  "#55EFC4",
];

/** Seat n (1-based), clockwise from the top. */
const seatAt = (n: number, r = SEAT_R) => {
  const a = ((n - 1) / SEATS) * Math.PI * 2 - Math.PI / 2;
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
};

// The story, in seconds. Mafia 2 and 9 and the Don 5 frame seat 7, then shoot seat 4 at night.
const SPEAKERS = [
  { seat: 1, from: 0.6, text: "Men tinch aholiman 🙂" },
  { seat: 2, from: 2.4, text: "7-raqamni nomzod qilaman" },
  { seat: 3, from: 4.2, text: "Menga ham 7 shubhali" },
];
const SPEECH = 1.8;
const NOMINATED = 7;
const VOTERS = [1, 2, 3, 5, 9, 10];
const VOTE_AT = 6.2;
const VOTE_STEP = 0.32;
const OUT_AT = 8.7;
const NIGHT_AT = 10.0;
const SHOOT_AT = 10.9;
const MAFIA = [2, 5, 9];
const TARGET = 4;
const SHERIFF = 8;
const CHECK_AT = 12.5;
const DAWN_AT = 14.1;
const KILL_AT = 14.7;
const CYCLE = 17.8;
const FADE = 0.5;
/** Night scene with the shot lined up: what reduced motion shows. */
const STILL = 12.2;

const ROLE_BADGES: Record<number, string> = { 2: "🕶️", 5: "🎩", 9: "🕶️", 8: "⭐" };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 → 0 over [a, b], with soft edges. */
const win = (t: number, a: number, b: number, edge = 0.3) =>
  clamp(Math.min((t - a) / edge, (b - t) / edge));
const rise = (t: number, a: number, edge = 0.5) => clamp((t - a) / edge);

const CAPTIONS = [
  { from: 0.4, to: 6.1, text: "☀️ 1-kun · muhokama" },
  { from: 6.1, to: OUT_AT, text: "🗳️ Ovoz berish" },
  { from: OUT_AT, to: NIGHT_AT, text: `${NOMINATED}-raqam stolni tark etdi` },
  { from: NIGHT_AT + 0.3, to: CHECK_AT, text: "🌙 Tun · mafiya otadi" },
  { from: CHECK_AT, to: DAWN_AT, text: "⭐ Sherif tekshiradi" },
  { from: DAWN_AT + 0.3, to: CYCLE, text: `🌅 Tong: ${TARGET}-raqam o'ldirildi` },
];

/**
 * Self-playing hero animation for the mafia landing: a ten-seat table goes through one
 * day (speeches, a nomination, a vote) and one night (the shot, the Sheriff's check), then loops.
 * Pure SVG + rAF like the puzzle demo; a still night scene when the user prefers reduced motion.
 */
export function MafiaDemo() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Animated parts are tagged with data-k; collect them once instead of a ref per element.
    const el: Record<string, SVGElement> = {};
    svgRef.current
      ?.querySelectorAll<SVGElement>("[data-k]")
      .forEach((node) => (el[node.dataset.k!] = node));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const begin = performance.now();
    let frame = 0;
    const set = (key: string, attr: string, value: string | number) =>
      el[key]?.setAttribute(attr, String(value));
    const show = (key: string, opacity: number) => {
      const node = el[key];
      if (node) node.style.opacity = String(opacity);
    };

    const render = (now: number) => {
      const t = reduced ? STILL : ((now - begin) / 1000) % CYCLE;
      show("scene", reduced ? 1 : Math.min(1, t / FADE, (CYCLE - t) / FADE));

      // Night falls after the vote and lifts at dawn.
      const night = Math.min(rise(t, NIGHT_AT, 0.8), 1 - rise(t, DAWN_AT, 0.8));
      show("night", night);
      set("moon", "transform", `translate(0 ${(1 - night) * 60})`);
      show("moon", night);
      show("sun", 1 - night);

      // Seats: out of the game after the vote / the shot, dimmed at night unless acting.
      for (let n = 1; n <= SEATS; n++) {
        const out =
          n === NOMINATED ? rise(t, OUT_AT) : n === TARGET ? rise(t, KILL_AT) * (1 - night) : 0;
        const acting = MAFIA.includes(n) || n === SHERIFF || n === TARGET;
        const dim = acting ? 1 : 1 - night * 0.5;
        show(`seat-${n}`, (1 - out * 0.65) * dim);
        show(`cross-${n}`, out);
        show(`role-${n}`, night);
      }

      // Speaker ring and speech bubbles.
      const speaker = SPEAKERS.find((s) => t >= s.from && t < s.from + SPEECH);
      if (speaker) {
        const p = seatAt(speaker.seat);
        set("ring", "cx", p.x);
        set("ring", "cy", p.y);
        set("ring", "r", 33 + Math.sin(t * 9) * 2.5);
      }
      show("ring", speaker ? 1 : 0);
      SPEAKERS.forEach((s, i) => show(`bubble-${i}`, win(t, s.from + 0.15, s.from + SPEECH)));
      show("nominee", win(t, 3.2, OUT_AT, 0.35));

      // Votes: one line per voter, the tally counting up.
      let votes = 0;
      VOTERS.forEach((n, i) => {
        const at = VOTE_AT + i * VOTE_STEP;
        if (t >= at) votes++;
        show(`vote-${n}`, win(t, at, OUT_AT + 0.2, 0.2));
      });
      const tally = el.tally;
      if (tally) tally.textContent = `${votes} ovoz → ${NOMINATED}-raqam`;

      // Night: the black team aims, the Sheriff checks the Don.
      MAFIA.forEach((n, i) => show(`shot-${n}`, win(t, SHOOT_AT + i * 0.25, DAWN_AT, 0.25)));
      show("crosshair", win(t, SHOOT_AT + 0.8, DAWN_AT, 0.25));
      set("crosshair", "transform", `rotate(${t * 40} ${seatAt(TARGET).x} ${seatAt(TARGET).y})`);
      show("check", win(t, CHECK_AT, DAWN_AT, 0.25));
      show("verdict", win(t, CHECK_AT + 0.6, DAWN_AT, 0.25));

      CAPTIONS.forEach((c, i) => show(`caption-${i}`, win(t, c.from, c.to, 0.25)));

      if (!reduced) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  const target = seatAt(TARGET);
  const sheriff = seatAt(SHERIFF);
  const don = seatAt(5);
  const nominee = seatAt(NOMINATED);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="O'n kishilik mafia stoli: kunduzi muhokama va ovoz berish, kechasi mafiya otadi va Sherif tekshiradi"
    >
      <defs>
        <radialGradient id="mafia-felt" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#3d2a5c" />
          <stop offset="1" stopColor="#1f1533" />
        </radialGradient>
        <radialGradient id="mafia-day" cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#ffcf8a" />
          <stop offset="1" stopColor="#e2725b" />
        </radialGradient>
        <radialGradient id="mafia-night" cx="0.5" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#27306b" />
          <stop offset="1" stopColor="#0b0d24" />
        </radialGradient>
      </defs>

      <g data-k="scene">
        <rect width={W} height={H} rx={28} fill="url(#mafia-day)" />
        <rect data-k="night" width={W} height={H} rx={28} fill="url(#mafia-night)" opacity={0} />
        <circle data-k="sun" cx={W - 52} cy={52} r={22} fill="#fff4d6" />
        <g data-k="moon" opacity={0}>
          <circle cx={W - 52} cy={52} r={22} fill="#f5f3ff" />
          <circle cx={W - 42} cy={45} r={19} fill="#1d2356" />
          {[
            [40, 40],
            [90, 80],
            [470, 120],
            [60, 430],
            [500, 420],
            [140, 30],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} fill="white" opacity={0.8} />
          ))}
        </g>

        <circle
          cx={CX}
          cy={CY}
          r={TABLE_R}
          fill="url(#mafia-felt)"
          stroke="rgb(255 255 255 / 0.18)"
          strokeWidth={3}
        />

        {/* Vote lines and night shots, under the seats. */}
        {VOTERS.map((n) => {
          const p = seatAt(n, SEAT_R - 30);
          const q = seatAt(NOMINATED, SEAT_R - 30);
          return (
            <line
              key={n}
              data-k={`vote-${n}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="#ffffff"
              strokeOpacity={0.75}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0}
            />
          );
        })}
        {MAFIA.map((n) => {
          const p = seatAt(n, SEAT_R - 30);
          const q = seatAt(TARGET, SEAT_R - 30);
          return (
            <line
              key={n}
              data-k={`shot-${n}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="#ff4d6d"
              strokeWidth={3}
              strokeDasharray="8 7"
              strokeLinecap="round"
              opacity={0}
            />
          );
        })}
        <line
          data-k="check"
          x1={sheriff.x}
          y1={sheriff.y}
          x2={don.x}
          y2={don.y}
          stroke="#ffd166"
          strokeWidth={10}
          strokeOpacity={0.45}
          strokeLinecap="round"
          opacity={0}
        />

        <circle
          data-k="ring"
          cx={CX}
          cy={CY}
          r={33}
          fill="none"
          stroke="#fff"
          strokeWidth={4}
          opacity={0}
        />

        {Array.from({ length: SEATS }, (_, i) => {
          const n = i + 1;
          const p = seatAt(n);
          return (
            <g key={n}>
              <g data-k={`seat-${n}`}>
                <circle cx={p.x} cy={p.y} r={26} fill={COLORS[i]} stroke="white" strokeWidth={3} />
                <text
                  x={p.x}
                  y={p.y + 7}
                  textAnchor="middle"
                  fill="white"
                  fontSize={20}
                  fontWeight={800}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {n}
                </text>
              </g>
              <g
                data-k={`cross-${n}`}
                opacity={0}
                stroke="#1c1a24"
                strokeWidth={5}
                strokeLinecap="round"
              >
                <path
                  d={`M${p.x - 13} ${p.y - 13}L${p.x + 13} ${p.y + 13}M${p.x + 13} ${p.y - 13}L${p.x - 13} ${p.y + 13}`}
                />
              </g>
              {ROLE_BADGES[n] && (
                <text
                  data-k={`role-${n}`}
                  x={p.x + 20}
                  y={p.y - 16}
                  fontSize={20}
                  opacity={0}
                  textAnchor="middle"
                >
                  {ROLE_BADGES[n]}
                </text>
              )}
            </g>
          );
        })}

        {/* The nominee's chip and the shot's crosshair sit on their seats. */}
        <g data-k="nominee" opacity={0}>
          <rect
            x={nominee.x - 44}
            y={nominee.y + 30}
            width={88}
            height={24}
            rx={12}
            fill="#1c1a24"
          />
          <text
            x={nominee.x}
            y={nominee.y + 47}
            textAnchor="middle"
            fill="white"
            fontSize={13}
            fontWeight={700}
            fontFamily="Inter, system-ui, sans-serif"
          >
            ✋ nomzod
          </text>
        </g>
        <g data-k="crosshair" opacity={0} stroke="#ff4d6d" strokeWidth={3} fill="none">
          <circle cx={target.x} cy={target.y} r={36} />
          <path
            d={`M${target.x} ${target.y - 46}v16M${target.x} ${target.y + 30}v16M${target.x - 46} ${target.y}h16M${target.x + 30} ${target.y}h16`}
          />
        </g>
        <g data-k="verdict" opacity={0}>
          <rect x={don.x - 34} y={don.y + 30} width={68} height={24} rx={12} fill="#111" />
          <text
            x={don.x}
            y={don.y + 47}
            textAnchor="middle"
            fill="white"
            fontSize={13}
            fontWeight={700}
            fontFamily="Inter, system-ui, sans-serif"
          >
            ⚫ qora
          </text>
        </g>

        {/* Speech bubbles sit in the table's upper half, the tail pointing at the speaker. */}
        {SPEAKERS.map((s, i) => {
          const bx = CX;
          const by = CY - 52;
          const tip = seatAt(s.seat, TABLE_R - 2);
          const width = s.text.length * 7.4 + 52;
          const dx = tip.x - bx;
          const dy = tip.y - by;
          const len = Math.hypot(dx, dy);
          const nx = (-dy / len) * 9;
          const ny = (dx / len) * 9;
          return (
            <g key={s.seat} data-k={`bubble-${i}`} opacity={0}>
              <path
                d={`M${bx + nx} ${by + ny}L${tip.x} ${tip.y}L${bx - nx} ${by - ny}Z`}
                fill="white"
              />
              <rect x={bx - width / 2} y={by - 18} width={width} height={36} rx={18} fill="white" />
              <circle cx={bx - width / 2 + 18} cy={by} r={10} fill={COLORS[s.seat - 1]} />
              <text
                x={bx - width / 2 + 18}
                y={by + 4}
                textAnchor="middle"
                fill="white"
                fontSize={11}
                fontWeight={800}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {s.seat}
              </text>
              <text
                x={bx + 12}
                y={by + 5}
                textAnchor="middle"
                fill="#1c1a24"
                fontSize={14}
                fontWeight={600}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {s.text}
              </text>
            </g>
          );
        })}

        {CAPTIONS.map((c, i) => (
          <g key={c.text} data-k={`caption-${i}`} opacity={0}>
            <text
              x={CX}
              y={CY + 38}
              textAnchor="middle"
              fill="white"
              fontSize={17}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {c.text}
            </text>
            {i === 1 && (
              <text
                data-k="tally"
                x={CX}
                y={CY + 64}
                textAnchor="middle"
                fill="white"
                fillOpacity={0.75}
                fontSize={14}
                fontFamily="Inter, system-ui, sans-serif"
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
