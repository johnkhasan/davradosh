import { MAX_PLAYERS_PER_ROOM } from "@puzzle/shared";
import Link from "next/link";
import { ServerStatus } from "@/components/server-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        🧩
      </span>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
        Puzzle&apos;ni <span className="text-primary">birga</span> yig&apos;amiz
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Rasm tanlang, linkni ulashing va {MAX_PLAYERS_PER_ROOM} kishigacha do&apos;stlaringiz bilan
        real vaqtda yig&apos;ing.
      </p>
      <Link
        href="/play"
        className="rounded-control bg-primary px-6 py-3 font-medium text-primary-foreground shadow-soft-md transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Mashq maydonida sinab ko&apos;rish
      </Link>
      <ServerStatus />
    </main>
  );
}
