"use client";

import dynamic from "next/dynamic";
import { PuzzleLoader } from "@/components/puzzle-loader";

// Reads localStorage and works with <canvas>, so it renders on the client only.
export const CreateLoader = dynamic(() => import("./create-wizard").then((m) => m.CreateWizard), {
  ssr: false,
  loading: () => <PuzzleLoader />,
});
