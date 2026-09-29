import type { Metadata } from "next";
import { PlaygroundLoader } from "@/components/game/playground-loader";

export const metadata: Metadata = {
  title: "Mashq maydoni",
  description: "Puzzle dvigatelini bir o'zingiz sinab ko'ring.",
};

export default function PlayPage() {
  return <PlaygroundLoader />;
}
