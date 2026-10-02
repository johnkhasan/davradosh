import type { Metadata } from "next";
import { MafiaRoomLoader } from "@/components/mafia/room-loader";

// Private invites: link previews read them, search engines skip them.
export const metadata: Metadata = {
  title: "Mafia stoli",
  description: "Sizni mafia o'yiniga taklif qilishdi. Havolani oching va stolga o'tiring.",
  robots: { index: false, follow: false },
};

export default async function MafiaRoomPage({ params }: PageProps<"/mafia/[id]">) {
  const { id } = await params;
  return <MafiaRoomLoader roomId={id} />;
}
