"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { loadIdentity } from "@/lib/identity";

const DEFAULT_COLOR = "#6C5CE7";
const INTERACTIVE = "a, button, [role='button'], [tabindex]:not([tabindex='-1']), label, select";

const FINE = "(pointer: fine)";
const FORCED = "(forced-colors: active)";

function subscribeMedia(onChange: () => void) {
  const queries = [window.matchMedia(FINE), window.matchMedia(FORCED)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

const canUseCursor = () => window.matchMedia(FINE).matches && !window.matchMedia(FORCED).matches;

/** "color|name" of the saved player, or "" (a string, so the snapshot is stable). */
const savedIdentity = () => {
  const identity = loadIdentity();
  return identity ? `${identity.color}|${identity.name}` : "";
};

const noSubscribe = () => () => {};

/**
 * The in-game cursor on the landing page: a coloured arrow with a name pill,
 * in the player's own name and colour when they have played before.
 * Mouse/trackpad only; touch screens and forced-colours mode keep the system cursor.
 */
export function GameCursor() {
  const enabled = useSyncExternalStore(subscribeMedia, canUseCursor, () => false);
  const identityKey = useSyncExternalStore(noSubscribe, savedIdentity, () => "");
  const split = identityKey.indexOf("|");
  const identity =
    split > 0 ? { color: identityKey.slice(0, split), name: identityKey.slice(split + 1) } : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    const arrow = arrowRef.current;
    const pill = pillRef.current;
    if (!root || !arrow || !pill) return;

    // Hide the system cursor only while this one is running.
    document.documentElement.classList.add("game-cursor");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = { x: -100, y: -100 };
    const trail = { x: -100, y: -100 };
    let hovering = false;
    let pressed = false;
    let visible = false;
    let frame = 0;
    let last = performance.now();

    const render = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      // The pill trails the arrow a little, like a name tag being pulled along.
      const k = reduced ? 1 : 1 - Math.exp(-dt / 45);
      trail.x += (target.x - trail.x) * k;
      trail.y += (target.y - trail.y) * k;
      const scale = pressed ? 0.88 : hovering ? 1.15 : 1;
      arrow.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) scale(${scale})`;
      pill.style.transform = `translate3d(${trail.x + 14}px, ${trail.y + 18}px, 0) scale(${hovering ? 1.06 : 1})`;
      frame = requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        // Appear where the pointer is, without flying in from the corner.
        trail.x = target.x;
        trail.y = target.y;
        visible = true;
        root.style.opacity = "1";
      }
      hovering = e.target instanceof Element && e.target.closest(INTERACTIVE) !== null;
    };
    const onLeave = () => {
      visible = false;
      root.style.opacity = "0";
    };
    const onDown = () => (pressed = true);
    const onUp = () => (pressed = false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("game-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;
  const color = identity?.color ?? DEFAULT_COLOR;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] opacity-0 transition-opacity duration-200"
    >
      <div
        ref={arrowRef}
        className="absolute top-0 left-0 origin-top-left transition-[scale] will-change-transform"
      >
        <svg width="22" height="24" viewBox="0 0 20 22" className="drop-shadow-md">
          <path
            d="M2 1.5 L17.5 10.2 L10.4 11.7 L7 18.8 Z"
            fill={color}
            stroke="white"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        ref={pillRef}
        className="absolute top-0 left-0 origin-top-left rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-md will-change-transform"
        style={{ backgroundColor: color }}
      >
        {identity?.name ?? "Siz"}
      </span>
    </div>
  );
}
