import { Gamepad2, Link2, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GameCursor } from "@/components/landing/game-cursor";
import { HeroDemo } from "@/components/landing/hero-demo";
import { MafiaDemo } from "@/components/landing/mafia-demo";
import { DavradoshMark } from "@/components/site/davradosh-mark";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { GAMES, HOME_FAQ, homeJsonLd, OPEN_GRAPH, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { ...OPEN_GRAPH, url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

const STEPS = [
  {
    icon: Gamepad2,
    title: "O'yinni tanlang",
    text: "Puzzle yoki mafia: xona yoki stol bir bosishda yaratiladi.",
  },
  {
    icon: Link2,
    title: "Havolani ulashing",
    text: "Telegram yoki WhatsApp guruhiga tashlang. Ro'yxatdan o'tish shart emas.",
  },
  {
    icon: MessageCircle,
    title: "Birga o'ynang",
    text: "Hamma real vaqtda bir xil narsani ko'radi, mafiada esa ovozli chatda gaplashasiz.",
  },
] as const;

/** Per game: the live demo, its stage and its calls to action. */
const SHOWCASE = {
  puzzle: {
    demo: <HeroDemo />,
    stage: "table-felt p-4 sm:p-6",
    primary: { href: "/create", label: "Puzzle yaratish" },
    secondary: { href: "/puzzle", label: "Batafsil" },
    accent: "from-primary/25 via-snap/15 to-success/20",
  },
  mafia: {
    demo: <MafiaDemo />,
    stage: "",
    primary: { href: "/mafia", label: "Stol yaratish" },
    secondary: { href: "/mafia/qoidalar", label: "Qoidalar" },
    accent: "from-[#e2725b]/30 via-[#6C5CE7]/20 to-[#0b0d24]/30",
  },
} as const;

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={homeJsonLd()} />
      <GameCursor />
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-8 pb-12 text-center md:pt-16">
          <DavradoshMark className="mx-auto size-16 shadow-soft-lg [border-radius:18px]" />
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Do&apos;stlar bilan <span className="text-primary">onlayn o&apos;yinlar</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
            Davradosh: davrangiz bilan bepul o&apos;ynaladigan o&apos;yinlar. Havolani ulashing,
            do&apos;stlaringiz bir bosishda qo&apos;shiladi: telefonda ham, kompyuterda ham.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {GAMES.map((game) => (
              <a
                key={game.slug}
                href={`#${game.slug}`}
                className="rounded-full border border-border bg-surface px-5 py-2.5 font-semibold shadow-soft-sm transition-colors hover:bg-surface-muted"
              >
                {game.emoji} {game.name}
              </a>
            ))}
          </div>
        </section>

        <section aria-label="O'yinlar" className="mx-auto w-full max-w-6xl space-y-20 px-4 pb-20">
          {GAMES.map((game, i) => {
            const show = SHOWCASE[game.slug];
            return (
              <article
                key={game.slug}
                id={game.slug}
                className="grid scroll-mt-8 items-center gap-8 md:grid-cols-2 md:gap-12"
              >
                <div className={i % 2 ? "md:order-2" : undefined}>
                  <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                    {game.players} · bepul
                  </p>
                  <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                    <Link href={game.path} className="hover:text-primary">
                      {game.emoji} {game.name}
                    </Link>
                  </h2>
                  <p className="mt-4 text-lg text-muted">{game.tagline}</p>
                  <p className="mt-2 text-muted">{game.description}</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={show.primary.href}
                      className="rounded-control bg-primary px-6 py-3 text-center text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5"
                    >
                      {show.primary.label}
                    </Link>
                    <Link
                      href={show.secondary.href}
                      className="rounded-control border border-border bg-surface px-6 py-3 text-center text-lg font-medium shadow-soft-sm transition-colors hover:bg-surface-muted"
                    >
                      {show.secondary.label}
                    </Link>
                  </div>
                </div>
                <Link
                  href={game.path}
                  aria-label={`${game.name} o'yini haqida`}
                  className="relative block rounded-[28px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:outline-none"
                >
                  <div
                    className={`absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br blur-3xl ${show.accent}`}
                  />
                  <div className={`overflow-hidden rounded-[28px] shadow-soft-lg ${show.stage}`}>
                    {show.demo}
                  </div>
                </Link>
              </article>
            );
          })}

          <div className="rounded-card border border-dashed border-border p-6 text-center text-muted">
            Yangi o&apos;yinlar tayyorlanmoqda: Davradosh&apos;da tez orada boshqa o&apos;yinlar ham
            paydo bo&apos;ladi.
          </div>
        </section>

        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
              Qanday ishlaydi?
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="relative rounded-card border border-border bg-surface p-6 shadow-soft-sm"
                >
                  <span className="absolute top-5 right-5 font-display text-5xl font-extrabold text-surface-muted">
                    {index + 1}
                  </span>
                  <step.icon
                    className="size-9 rounded-control bg-primary-soft p-2 text-primary"
                    aria-hidden
                  />
                  <h3 className="mt-4 font-display text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-4 py-16">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
            Ko&apos;p beriladigan savollar
          </h2>
          <div className="mt-8 divide-y divide-border rounded-card border border-border bg-surface">
            {HOME_FAQ.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  <h3>{item.question}</h3>
                  <span
                    aria-hidden
                    className="text-xl text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
