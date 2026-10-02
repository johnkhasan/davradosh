import Link from "next/link";
import type { ReactNode } from "react";
import { GAMES } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { DavradoshMark } from "./davradosh-mark";

/** Brand, game links and an optional slot for the page's own call to action. */
export function SiteHeader({ current, children }: { current?: string; children?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5">
      <Link
        href="/"
        className="flex items-center gap-2 font-display text-xl font-bold"
        aria-label="Davradosh bosh sahifasi"
      >
        <DavradoshMark className="size-8" />
        <span>Davradosh</span>
      </Link>
      <nav aria-label="O'yinlar" className="flex items-center gap-1 text-sm">
        {GAMES.map((game) => (
          <Link
            key={game.slug}
            href={game.path}
            aria-current={current === game.slug ? "page" : undefined}
            className={cn(
              "hidden rounded-control px-3 py-2 font-medium sm:inline-flex",
              current === game.slug
                ? "bg-primary-soft text-primary"
                : "text-muted hover:text-foreground",
            )}
          >
            {game.emoji} {game.name}
          </Link>
        ))}
        {children}
      </nav>
    </header>
  );
}
