"use client";

import dynamic from "next/dynamic";

// The room reads localStorage and draws on <canvas> on first render.
export const RoomLoader = dynamic(
  () => import("./multiplayer-room").then((m) => m.MultiplayerRoom),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 table-felt" />,
  },
);
