import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GAMES } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { DavradoshMark } from "./davradosh-mark";

/** Brand, a menu of every game and an optional slot for the page's own call to action. */
export function SiteHeader({ current, children }: { current?: string; children?: ReactNode }) {
  const active = GAMES.find((game) => game.slug === current);
  return (
    <header className="relative z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5">
      <Link
        href="/"
        className="flex items-center gap-2 font-display text-xl font-bold"
        aria-label="Davradosh bosh sahifasi"
      >
        <DavradoshMark className="size-8" />
        <span>Davradosh</span>
      </Link>
      <nav aria-label="O'yinlar" className="flex items-center gap-1 text-sm">
        {/* A plain <details> menu: works without JavaScript and is crawlable. */}
        <details className="group relative">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-1 rounded-control px-3 py-2 font-medium [&::-webkit-details-marker]:hidden",
              active ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground",
            )}
          >
            {active ? `${active.emoji} ${active.name}` : "🎮 O'yinlar"}
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="absolute right-0 mt-2 w-56 rounded-card border border-border bg-surface p-1.5 shadow-soft-lg">
            {GAMES.map((game) => (
              <li key={game.slug}>
                <Link
                  href={game.path}
                  aria-current={current === game.slug ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-control px-3 py-2 font-medium",
                    current === game.slug
                      ? "bg-primary-soft text-primary"
                      : "hover:bg-surface-muted",
                  )}
                >
                  <span aria-hidden>{game.emoji}</span>
                  {game.name}
                  <span className="ml-auto text-xs text-muted">{game.players}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
        {children}
      </nav>
    </header>
  );
}
