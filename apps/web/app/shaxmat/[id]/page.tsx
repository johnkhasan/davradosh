import { TABLE_GAMES } from "@puzzle/shared/games";
import type { Metadata } from "next";
import { TableRoomLoader } from "@/components/table/room-loader";

const game = TABLE_GAMES.chess;

// Private invites: link previews read them, search engines skip them.
export const metadata: Metadata = {
  title: `${game.name} stoli`,
  description: `Sizni ${game.name.toLowerCase()} o'yiniga taklif qilishdi. Havolani oching va stolga o'tiring.`,
  robots: { index: false, follow: false },
};

export default async function TableRoomPage({ params }: PageProps<"/shaxmat/[id]">) {
  const { id } = await params;
  return <TableRoomLoader roomId={id} kind="chess" />;
}
