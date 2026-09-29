"use client";

import dynamic from "next/dynamic";
import { PuzzleLoader } from "@/components/puzzle-loader";

// The playground draws its demo image with <canvas> and reads the URL on first render.
export const PlaygroundLoader = dynamic(() => import("./playground").then((m) => m.Playground), {
  ssr: false,
  loading: () => <PuzzleLoader label="Mashq maydoni tayyorlanmoqda" />,
});
