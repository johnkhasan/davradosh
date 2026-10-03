import {
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_PLAYERS,
  MAFIA_ROLE_DECK,
  MAFIA_TIMINGS,
  type MafiaRole,
} from "@puzzle/shared/mafia";
import type { Metadata } from "next";
import Link from "next/link";
import { MafiaDemo } from "@/components/landing/mafia-demo";
import { CreateTableButton } from "@/components/mafia/create-table-button";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { MAFIA_DESCRIPTION, MAFIA_FAQ, MAFIA_TITLE, mafiaJsonLd, OPEN_GRAPH } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: MAFIA_TITLE },
  description: MAFIA_DESCRIPTION,
  alternates: { canonical: "/mafia" },
  openGraph: { ...OPEN_GRAPH, url: "/mafia", title: MAFIA_TITLE, description: MAFIA_DESCRIPTION },
};

const ROLES: Record<MafiaRole, { name: string; emoji: string; team: string; text: string }> = {
  civilian: {
    name: "Tinch aholi",
    emoji: "🙂",
    team: "Qizillar",
    text: "Kunduzi muhokama qiladi va ovoz berib mafiyani stoldan chiqaradi.",
  },
  sheriff: {
    name: "Sherif",
    emoji: "⭐",
    team: "Qizillar",
    text: "Har tun bitta o'yinchini tekshiradi: qizilmi yoki qora.",
  },
  mafia: {
    name: "Mafiya",
    emoji: "🕶️",
    team: "Qoralar",
    text: "Tunda jamoasi bilan birga «otadi»: hammasi bitta o'yinchini tanlasagina o'q tegadi.",
  },
  don: {
    name: "Don",
    emoji: "🎩",
    team: "Qoralar",
    text: "Mafiya bilan birga otadi va har tun Sherifni qidiradi.",
  },
};

const count = (role: MafiaRole) => MAFIA_ROLE_DECK.filter((r) => r === role).length;
const seconds = (ms: number) => Math.round(ms / 1000);

export default function MafiaPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={mafiaJsonLd()} />
      <SiteHeader current="mafia">
        <Link
          href="/mafia/qoidalar"
          className="ml-1 rounded-control border border-border bg-surface px-3 py-2 font-medium hover:bg-surface-muted"
        >
          📖 Qoidalar
        </Link>
      </SiteHeader>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1.1fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              🎙️ Ovozli chat · avtomatik boshlovchi
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Do&apos;stlar bilan <span className="text-primary">onlayn mafia</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Sport mafiasining rasmiy qoidalari bo&apos;yicha, {MAFIA_MIN_PLAYERS}–
              {MAFIA_MAX_PLAYERS} kishilik stolda (rasmiy o&apos;yin {MAFIA_PLAYERS} kishi).
              Fazalarni, so&apos;z navbatini va ovoz berishni server o&apos;zi yuritadi, siz faqat
              o&apos;ynaysiz.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center md:justify-start">
              <CreateTableButton />
              <Link
                href="/join"
                className="inline-flex items-center justify-center rounded-control border border-border bg-surface px-7 py-3.5 text-lg font-semibold whitespace-nowrap shadow-soft-sm transition-colors hover:bg-surface-muted"
              >
                Kod bilan qo&apos;shilish
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#e2725b]/30 via-[#6C5CE7]/20 to-[#0b0d24]/30 blur-3xl" />
            <div className="overflow-hidden rounded-[28px] shadow-soft-lg">
              <MafiaDemo />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h2 className="mt-12 font-display text-2xl font-bold">Rollar</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(ROLES) as MafiaRole[]).map((role) => (
              <li key={role} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <span aria-hidden>{ROLES[role].emoji}</span>
                  {ROLES[role].name}
                  <span className="ml-auto text-sm font-normal text-muted">
                    {ROLES[role].team} · {MAFIA_PLAYERS} kishida {count(role)} ta
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{ROLES[role].text}</p>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-bold">O&apos;yin qanday o&apos;tadi</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            <li>
              <strong className="text-foreground">Tanishuv tuni.</strong> Qoralar bir-birini
              ko&apos;radi va {seconds(MAFIA_TIMINGS.zeroNight)} soniyada otish tartibini kelishib
              oladi. Bu tunda hech kim o&apos;lmaydi.
            </li>
            <li>
              <strong className="text-foreground">Kun.</strong> Har kimga{" "}
              {seconds(MAFIA_TIMINGS.speech)} soniya so&apos;z navbat bilan beriladi. O&apos;z
              navbatida bitta nomzod ko&apos;rsatish mumkin.
            </li>
            <li>
              <strong className="text-foreground">Ovoz berish.</strong> Eng ko&apos;p ovoz olgan
              o&apos;yinchi stolni tark etadi. Ovoz bermaganning ovozi oxirgi nomzodga o&apos;tadi,
              teng ovozda nomzodlar {seconds(MAFIA_TIMINGS.tieSpeech)} soniyadan qo&apos;shimcha
              so&apos;z oladi.
            </li>
            <li>
              <strong className="text-foreground">Tun.</strong> Mafiya otadi, Don Sherifni qidiradi,
              Sherif tekshiradi. Birinchi o&apos;ldirilgan o&apos;yinchi «eng yaxshi yurish» qiladi:
              uchta gumondorni aytadi.
            </li>
            <li>
              <strong className="text-foreground">G&apos;alaba.</strong> Qizillar barcha qoralarni
              chiqarsa yutadi. Qoralar esa stolda qizillar bilan teng bo&apos;lib qolganida yutadi.
            </li>
          </ol>

          <div className="mt-12 flex flex-col items-center rounded-card border border-dashed border-border p-6 text-center">
            <p className="text-muted">
              {MAFIA_MIN_PLAYERS} dan {MAFIA_MAX_PLAYERS} kishigacha stol yarating va havolani
              do&apos;stlaringizga yuboring. Ovozli chatda gaplashasiz: so&apos;z navbati kelganda
              mikrofoningiz o&apos;zi ochiladi.
            </p>
            <div className="mt-4">
              <CreateTableButton />
            </div>
          </div>

          <h2 className="mt-16 font-display text-2xl font-bold">Ko&apos;p beriladigan savollar</h2>
          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
            {MAFIA_FAQ.map((item) => (
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
