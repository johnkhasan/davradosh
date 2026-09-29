import { MAX_PLAYERS_PER_ROOM } from "@puzzle/shared";
import {
  ImagePlus,
  Link2,
  MousePointer2,
  Puzzle,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { HeroDemo } from "@/components/landing/hero-demo";
import { ServerStatus } from "@/components/server-status";

const STEPS = [
  {
    icon: ImagePlus,
    title: "Rasm tanlang",
    text: "Galereyadan yoki o'zingizning suratingizni yuklang: oilaviy rasm, sayohat, sevimli joy.",
  },
  {
    icon: Link2,
    title: "Havolani ulashing",
    text: "Telegram yoki WhatsApp orqali yuboring. Do'stlaringiz bir bosishda qo'shiladi.",
  },
  {
    icon: Puzzle,
    title: "Birga yig'ing",
    text: "Kim qaysi bo'lakni ushlab turgani real vaqtda ko'rinadi. Oxirida kim eng ko'p yordam bergani chiqadi.",
  },
] as const;

const FEATURES = [
  {
    icon: MousePointer2,
    title: "Jonli kursorlar",
    text: "Har kimning kursori ismi va rangi bilan, xuddi Figmadagidek.",
  },
  {
    icon: Users,
    title: `${MAX_PLAYERS_PER_ROOM} kishigacha`,
    text: "Kichik davra uchun ideal: oila, do'stlar yoki hamkasblar.",
  },
  {
    icon: Sparkles,
    title: "24 dan 500 gacha bo'lak",
    text: "Tezkor 5 daqiqalik o'yindan butun kechalik sarguzashtgacha.",
  },
  {
    icon: UserRoundCheck,
    title: "Ro'yxatdan o'tmasdan",
    text: "Ism va rang tanlaysiz, xolos. Hech qanday parol yoki email yo'q.",
  },
  {
    icon: Smartphone,
    title: "Telefon va kompyuterda",
    text: "Sichqoncha, trackpad yoki barmoq bilan: hammasi qulay.",
  },
  {
    icon: Link2,
    title: "7 kun saqlanadi",
    text: "Bugun tugatolmadingizmi? Ertaga shu havola orqali davom eting.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="font-display text-xl font-bold">
          🧩 Puzzle
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/play"
            className="rounded-control px-3 py-2 font-medium text-muted hover:text-foreground"
          >
            Mashq qilish
          </Link>
          <Link
            href="/create"
            className="rounded-control bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
          >
            Yaratish
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1.1fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Real vaqtda, birgalikda
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Puzzle&apos;ni <span className="text-primary">birga</span> yig&apos;amiz
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Rasm tanlang, havolani ulashing va {MAX_PLAYERS_PER_ROOM} kishigacha
              do&apos;stlaringiz bilan bitta stol atrofida o&apos;tirgandek yig&apos;ing, qayerda
              bo&apos;lishingizdan qat&apos;i nazar.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:justify-start">
              <Link
                href="/create"
                className="w-full rounded-control bg-primary px-7 py-3.5 text-center text-lg font-semibold text-primary-foreground shadow-soft-lg transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
              >
                Puzzle yaratish
              </Link>
              <Link
                href="/play"
                className="w-full rounded-control border border-border bg-surface px-7 py-3.5 text-center text-lg font-medium shadow-soft-sm transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:w-auto"
              >
                Yolg&apos;iz sinab ko&apos;rish
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-primary/25 via-snap/15 to-success/20 blur-3xl" />
            <div className="table-felt overflow-hidden rounded-[28px] p-4 shadow-soft-lg sm:p-8">
              <HeroDemo />
            </div>
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

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <feature.icon className="size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                  <p className="mt-1 text-muted">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-5 rounded-[28px] bg-gradient-to-br from-primary to-[#4b3bc9] px-6 py-12 text-center text-white shadow-soft-lg">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Bugun kechqurun birga o&apos;ynaymizmi?
            </h2>
            <p className="max-w-md text-white/80">
              Bir daqiqada puzzle yarating va havolani oilaviy chatga tashlang.
            </p>
            <Link
              href="/create"
              className="rounded-control bg-white px-7 py-3.5 text-lg font-semibold text-primary shadow-soft-md transition-transform hover:-translate-y-0.5"
            >
              Boshlash
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} puzzle.javohir.ru</span>
          <ServerStatus />
        </div>
      </footer>
    </div>
  );
}
