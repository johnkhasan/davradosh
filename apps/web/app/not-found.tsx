import type { Metadata } from "next";
import Link from "next/link";
import { GameCursor } from "@/components/landing/game-cursor";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { GAMES } from "@/lib/seo";

// Next adds the noindex tag to 404 responses itself.
export const metadata: Metadata = { title: "Sahifa topilmadi" };

/** The app icon's jigsaw piece, in a 64×64 box. */
const PIECE =
  "M18 16h10a5 5 0 1 1 8 0h10v10a5 5 0 1 0 0 8v14H36a5 5 0 1 0-8 0H18V34a5 5 0 1 1 0-8z";

function Digit({ children }: { children: string }) {
  return (
    <span className="font-display text-[clamp(6rem,22vw,12rem)] leading-none font-extrabold tracking-tight">
      {children}
    </span>
  );
}

/** "4 _ 4": the zero is the puzzle's missing piece, hovering next to its empty slot. */
function MissingPiece() {
  return (
    <span className="relative inline-block size-[clamp(5.5rem,20vw,11rem)]" aria-hidden>
      <svg viewBox="12 10 40 44" className="lost-slot absolute inset-0 size-full">
        <path
          d={PIECE}
          fill="rgb(108 92 231 / 0.08)"
          stroke="currentColor"
          className="text-primary"
          strokeWidth={1.2}
          strokeDasharray="3 2.5"
        />
      </svg>
      <svg
        viewBox="12 10 40 44"
        className="lost-piece absolute inset-0 size-full drop-shadow-[0_14px_14px_rgb(0_0_0/0.25)]"
      >
        <path d={PIECE} fill="#6C5CE7" stroke="white" strokeWidth={1.2} />
        <text
          x={30}
          y={37}
          textAnchor="middle"
          fill="white"
          fontSize={14}
          fontWeight={800}
          fontFamily="var(--font-bricolage), system-ui, sans-serif"
        >
          0
        </text>
      </svg>
    </span>
  );
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <GameCursor />
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pt-8 pb-20 text-center sm:pt-14">
        <p className="sr-only">404</p>
        <div className="flex items-center gap-2 sm:gap-4">
          <Digit>4</Digit>
          <MissingPiece />
          <Digit>4</Digit>
        </div>
        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Bu bo&apos;lak topilmadi
        </h1>
        <p className="mt-3 max-w-md text-lg text-muted">
          Siz qidirgan sahifa yo&apos;q yoki boshqa joyga ko&apos;chgan. Balki uni tunda mafiya
          «otib» yuborgandir 🕵️
        </p>
        <p className="mt-2 text-sm text-muted">
          Do&apos;stingiz yuborgan havola bo&apos;lsa, o&apos;yin tugagan yoki xona muddati
          o&apos;tgan bo&apos;lishi mumkin.
        </p>
        <Link
          href="/"
          className="mt-8 w-full rounded-control bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 sm:w-auto"
        >
          Bosh sahifaga
        </Link>
        <ul className="mt-5 flex max-w-xl flex-wrap justify-center gap-2" aria-label="O'yinlar">
          {GAMES.map((game) => (
            <li key={game.slug}>
              <Link
                href={game.path}
                className="inline-flex rounded-full border border-border bg-surface px-4 py-2 font-medium shadow-soft-sm transition-colors hover:bg-surface-muted"
              >
                {game.emoji} {game.name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
