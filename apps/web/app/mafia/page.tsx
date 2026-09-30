import {
  MAFIA_PLAYERS,
  MAFIA_ROLE_DECK,
  MAFIA_TIMINGS,
  type MafiaRole,
} from "@puzzle/shared/mafia";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateTableButton } from "@/components/mafia/create-table-button";

// Work in progress: reachable only by typing /mafia. Not linked, not in the sitemap, not indexed.
export const metadata: Metadata = {
  title: "Mafia",
  description: "Do'stlar bilan onlayn sport mafiasi: tez orada.",
  robots: { index: false, follow: false },
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
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/mafia" className="font-display text-xl font-bold">
          🕵️ Mafia
        </Link>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
          Ishlab chiqilmoqda
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Do&apos;stlar bilan onlayn mafia
        </h1>
        <p className="mt-4 text-lg text-muted">
          Sport mafiasining rasmiy qoidalari bo&apos;yicha, {MAFIA_PLAYERS} kishilik stolda.
          Boshlovchi avtomatik: fazalarni, so&apos;z navbatini va ovoz berishni server o&apos;zi
          yuritadi, siz faqat o&apos;ynaysiz.
        </p>

        <h2 className="mt-12 font-display text-2xl font-bold">Rollar</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(ROLES) as MafiaRole[]).map((role) => (
            <li key={role} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2 font-semibold">
                <span aria-hidden>{ROLES[role].emoji}</span>
                {ROLES[role].name}
                <span className="ml-auto text-sm font-normal text-muted">
                  {ROLES[role].team} · {count(role)} ta
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
            Stol yarating va havolani 9 ta do&apos;stingizga yuboring. Hozircha ovozsiz: gapirish
            navbatida ovozli chat keyingi bosqichda qo&apos;shiladi.
          </p>
          <div className="mt-4">
            <CreateTableButton />
          </div>
        </div>
      </main>
    </div>
  );
}
