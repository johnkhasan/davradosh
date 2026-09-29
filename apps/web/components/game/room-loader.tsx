"use client";

import dynamic from "next/dynamic";
import { PuzzleLoader } from "@/components/puzzle-loader";

// The room reads localStorage and draws on <canvas> on first render.
export const RoomLoader = dynamic(
  () => import("./multiplayer-room").then((m) => m.MultiplayerRoom),
  {
    ssr: false,
    loading: () => <PuzzleLoader label="Xona ochilmoqda" tone="onTable" className="table-felt" />,
  },
);
