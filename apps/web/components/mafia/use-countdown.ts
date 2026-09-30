"use client";

import { useEffect, useState } from "react";

/** Whole seconds left until the server time `endsAt`, corrected by the client/server clock offset. */
export function useCountdown(endsAt: number | null, clockOffset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    // Restart from the current time for each new deadline, so a fresh phase never shows a stale clock.
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 250);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [endsAt]);
  if (endsAt === null || !Number.isFinite(endsAt)) return null;
  // Rounded: a new 60 s phase reads 60, not 61, when the state arrives a few ms late.
  return Math.max(0, Math.round((endsAt + clockOffset - now) / 1000));
}
