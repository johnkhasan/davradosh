import { CalendarDays, Puzzle, Timer, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyLoader } from "@/components/puzzle-modes/daily/daily-loader";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { OPEN_GRAPH } from "@/lib/seo";

const TITLE = "Kunlik puzzle: har kuni yangi pazl";
const DESCRIPTION =
  "Kunlik puzzle: har kuni hamma uchun bitta yangi pazl. Onlayn yig'ing, vaqtingizni do'stlaringiz bilan solishtiring va kunlik reytingga chiqing. Bepul.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/puzzle/kunlik" },
  openGraph: { ...OPEN_GRAPH, url: "/puzzle/kunlik", title: TITLE, description: DESCRIPTION },
};

const RULES = [
  {
    icon: CalendarDays,
    title: "Har kuni yangi rasm",
    text: "Toshkent vaqti bilan yarim tunda yangi puzzle chiqadi. Hamma bir xil rasm va bir xil bo'laklarni yig'adi.",
  },
  {
    icon: Puzzle,
    title: "Hafta oxiri kattaroq",
    text: "Ish kunlari 64 bo'lak, shanba va yakshanba 100 bo'lak.",
  },
  {
    icon: Timer,
    title: "Vaqt hisoblanadi",
    text: "Soat «Boshlash» tugmasidan boshlanadi va oxirgi bo'lak joyiga tushganda to'xtaydi.",
  },
  {
    icon: Trophy,
    title: "Kunlik reyting",
    text: "Eng tez 20 kishi reytingda ko'rinadi. Qayta yig'sangiz, eng yaxshi vaqtingiz saqlanadi.",
  },
] as const;

const FAQ = [
  {
    question: "Kunlik puzzle nima?",
    answer:
      "Har kuni hamma uchun bitta umumiy pazl. Rasm va bo'laklar hamma uchun bir xil, shuning uchun vaqtingizni boshqalar bilan halol solishtirasiz.",
  },
  {
    question: "Yangi puzzle qachon chiqadi?",
    answer:
      "Har kuni Toshkent vaqti bilan soat 00:00 da. Sahifada keyingi puzzle'gacha qolgan vaqt ko'rinib turadi.",
  },
  {
    question: "Ro'yxatdan o'tish kerakmi?",
    answer:
      "Yo'q. Natijani reytingga qo'shish uchun faqat ism, rang va avatar tanlaysiz. Parol ham, email ham kerak emas.",
  },
  {
    question: "Sahifani yopib qo'ysam nima bo'ladi?",
    answer:
      "Yig'gan bo'laklaringiz brauzerda saqlanadi. Qaytib kelsangiz, o'sha joydan davom ettirasiz; sahifa yopiq paytda soat yurmaydi.",
  },
  {
    question: "Telefonda o'ynasa bo'ladimi?",
    answer: "Ha. Bo'laklarni barmoq bilan suring, ikki barmoq bilan kattalashtiring.",
  },
] as const;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function DailyPuzzlePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={faqJsonLd} />
      <SiteHeader current="puzzle">
        <Link
          href="/puzzle"
          className="rounded-control px-3 py-2 font-medium text-muted hover:text-foreground"
        >
          Puzzle
        </Link>
      </SiteHeader>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-4 pb-12 md:pt-8">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              <CalendarDays className="size-4" aria-hidden /> Har kuni yangi
            </span>
            <h1 className="mt-4 font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">
              Kunlik <span className="text-primary">puzzle</span>
            </h1>
            <p className="mt-3 text-lg text-muted">
              Bugungi rasmni yig&apos;ing, vaqtingizni do&apos;stlaringiz bilan solishtiring va
              reytingning tepasiga chiqing.
            </p>
          </div>
          <DailyLoader />
        </section>

        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-14">
            <h2 className="text-center font-display text-3xl font-bold">Qanday o&apos;ynaladi</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {RULES.map((rule) => (
                <li
                  key={rule.title}
                  className="rounded-card border border-border bg-surface p-5 shadow-soft-sm"
                >
                  <rule.icon
                    className="size-9 rounded-control bg-primary-soft p-2 text-primary"
                    aria-hidden
                  />
                  <h3 className="mt-3 font-display text-lg font-bold">{rule.title}</h3>
                  <p className="mt-1 text-sm text-muted">{rule.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-4 py-14">
          <h2 className="text-center font-display text-3xl font-bold">
            Ko&apos;p beriladigan savollar
          </h2>
          <div className="mt-8 divide-y divide-border rounded-card border border-border bg-surface">
            {FAQ.map((item) => (
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
          <p className="mt-8 text-center text-muted">
            Do&apos;stlar bilan birga yig&apos;moqchimisiz?{" "}
            <Link href="/puzzle" className="font-medium text-primary hover:underline">
              Birgalikdagi puzzle
            </Link>{" "}
            yoki{" "}
            <Link href="/puzzle#poyga" className="font-medium text-primary hover:underline">
              puzzle poyga
            </Link>
            ni sinab ko&apos;ring.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
