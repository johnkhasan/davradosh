"use client";

import dynamic from "next/dynamic";

// The playground draws its demo image with <canvas> and reads the URL on first render.
export const PlaygroundLoader = dynamic(() => import("./playground").then((m) => m.Playground), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center text-muted">Yuklanmoqda…</div>
  ),
});
