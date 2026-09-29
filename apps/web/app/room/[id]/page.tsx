import type { Metadata } from "next";
import { RoomLoader } from "@/components/game/room-loader";

export const metadata: Metadata = {
  title: "Puzzle'ni birga yig'amiz!",
  description: "Sizni puzzle yig'ishga taklif qilishdi. Havolani oching va qo'shiling.",
  robots: { index: false },
};

export default async function RoomPage({ params }: PageProps<"/room/[id]">) {
  const { id } = await params;
  return <RoomLoader roomId={id} />;
}
