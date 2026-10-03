"use client";

import dynamic from "next/dynamic";

// Reads localStorage on first render and draws the puzzle with <canvas>: client only.
export const DailyLoader = dynamic(() => import("./daily-puzzle").then((m) => m.DailyPuzzle), {
  ssr: false,
  loading: () => (
    <div className="mx-auto grid w-full max-w-4xl animate-pulse gap-5 md:grid-cols-[1.1fr_1fr]">
      <div className="aspect-[4/3] rounded-card bg-surface-muted" />
      <div className="h-64 rounded-card bg-surface-muted" />
    </div>
  ),
});
