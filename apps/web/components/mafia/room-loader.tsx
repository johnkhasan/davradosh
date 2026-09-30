"use client";

import dynamic from "next/dynamic";
import { PuzzleLoader } from "@/components/puzzle-loader";

// Reads localStorage (identity) and opens a socket, so it renders on the client only.
export const MafiaRoomLoader = dynamic(
  () => import("./room-screen").then((m) => m.MafiaRoomScreen),
  {
    ssr: false,
    loading: () => <PuzzleLoader label="Stol tayyorlanmoqda" />,
  },
);
