import Link from "next/link";
import { ServerStatus } from "@/components/server-status";
import { SITE_URL } from "@/lib/env";
import { GAMES } from "@/lib/seo";
import { DavradoshMark } from "./davradosh-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-[1fr_auto_auto] sm:items-start">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-base font-bold text-foreground"
          >
            <DavradoshMark className="size-6" />
            Davradosh
          </Link>
          <p className="mt-2 max-w-xs">
            Do&apos;stlar davrasida o&apos;ynaladigan bepul onlayn o&apos;yinlar.
          </p>
        </div>
        <nav aria-label="O'yinlar">
          <p className="font-semibold text-foreground">O&apos;yinlar</p>
          <ul className="mt-2 space-y-1">
            {GAMES.map((game) => (
              <li key={game.slug}>
                <Link href={game.path} className="hover:text-foreground">
                  {game.emoji} {game.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/mafia/qoidalar" className="hover:text-foreground">
                📖 Mafia qoidalari
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                🔒 Maxfiylik siyosati
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex flex-col gap-2 sm:items-end">
          <ServerStatus />
          <span>
            © {new Date().getFullYear()} {new URL(SITE_URL).host}
          </span>
        </div>
      </div>
    </footer>
  );
}
