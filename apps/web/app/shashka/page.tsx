import type { Metadata } from "next";
import { StaticBoard } from "@/components/games/checkers/board-art";
import { CreateCheckersTable } from "@/components/games/checkers/create-table";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { OPEN_GRAPH } from "@/lib/seo";

const TITLE = "Shashka onlayn: do'stlar bilan shashka o'ynash";
const DESCRIPTION =
  "Shashka o'ynash endi oson: do'stingizga havola yuboring va onlayn rus shashkasini bepul o'ynang. Majburiy urish, damka, ro'yxatdan o'tishsiz.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "shashka o'ynash",
    "shashka onlayn",
    "shashka online",
    "rus shashkasi",
    "do'stlar bilan shashka",
    "шашки онлайн",
    "русские шашки",
  ],
  alternates: { canonical: "/shashka" },
  openGraph: { ...OPEN_GRAPH, url: "/shashka", title: TITLE, description: DESCRIPTION },
};

const FAQ = [
  {
    question: "Onlayn shashka o'ynash bepulmi?",
    answer:
      "Ha, butunlay bepul va ro'yxatdan o'tish shart emas. Stol yaratasiz, ismingizni yozasiz va havolani do'stingizga yuborasiz.",
  },
  {
    question: "Do'stim bilan qanday o'ynayman?",
    answer:
      "«Shashka stolini yaratish» tugmasini bosing va stol havolasini Telegram yoki boshqa messenjer orqali yuboring. Do'stingiz havolani ochib stolga o'tirgach, o'yinni boshlaysiz. Boshqalar havola orqali tomosha qilishi mumkin.",
  },
  {
    question: "Qaysi qoidalar bo'yicha o'ynaladi?",
    answer:
      "Rus shashkasi (русские шашки) qoidalari bo'yicha — O'zbekistonda eng ko'p o'ynaladigan tur: 8×8 taxta, har tomonda 12 ta dona, majburiy urish va uchar damka.",
  },
  {
    question: "Urish majburiymi?",
    answer:
      "Ha. Agar raqib donasini urish mumkin bo'lsa, urish shart. Bir nechta variant bo'lsa, istalganini tanlaysiz: eng ko'p dona uradigan yo'lni tanlash shart emas. Lekin boshlangan urishni oxirigacha davom ettirish kerak.",
  },
  {
    question: "Damka qanday yuradi?",
    answer:
      "Oxirgi qatorga yetgan dona damkaga aylanadi. Damka diagonal bo'ylab istalgancha uzoqqa yuradi, raqib donasini uzoqdan ura oladi va urilgan donadan keyingi istalgan bo'sh katakka tushadi.",
  },
  {
    question: "Vaqt cheklovi bormi?",
    answer:
      "Stol yaratishda o'zingiz tanlaysiz: cheklovsiz, har bir yurishga 30 yoki 60 soniya. Vaqt cheklovi bo'lsa va vaqt tugasa, o'sha o'yinchi yutqazadi.",
  },
];

const RULES: { title: string; text: string }[] = [
  {
    title: "Taxta va donalar",
    text: "8×8 taxtaning faqat qora kataklarida o'ynaladi. Har tomonda 12 tadan dona birinchi uch qatorga teriladi. Oqlar birinchi yuradi, keyin navbat bilan.",
  },
  {
    title: "Oddiy yurish",
    text: "Dona diagonal bo'ylab bitta katak oldinga, bo'sh katakka yuradi. Oddiy dona orqaga yurmaydi.",
  },
  {
    title: "Urish majburiy",
    text: "Raqib donasi diagonal bo'yicha yoningizda turgan bo'lsa va uning orqasidagi katak bo'sh bo'lsa, uning ustidan sakrab urasiz. Oddiy dona oldinga ham, orqaga ham uradi. Urish imkoni bo'lsa, urish shart; bir nechta variantdan istalganini tanlash mumkin.",
  },
  {
    title: "Ketma-ket urish",
    text: "Urgan dona yana ura olsa, o'sha yurishda urishni davom ettiradi. Urilgan donalar yurish tugagach olib tashlanadi: ularning ustidan ikkinchi marta sakrab bo'lmaydi va ular yo'lni to'sib turadi («turk zarbasi» qoidasi).",
  },
  {
    title: "Damka",
    text: "Oxirgi qatorga yetgan dona damka bo'ladi. Damka diagonal bo'ylab istalgancha uzoq yuradi va uradi, urilgan donadan keyingi istalgan bo'sh katakka tushadi; agar biror katakdan urishni davom ettirish mumkin bo'lsa, o'sha katakka tushishi shart. Urish paytida oxirgi qatorga yetgan dona darhol damka bo'lib, urishni damka sifatida davom ettiradi.",
  },
  {
    title: "G'alaba va durang",
    text: "Raqibning donasi qolmasa yoki u yurolmay qolsa, siz yutasiz. Durang: o'yinchilar kelishsa, bir xil holat uch marta takrorlansa yoki 15 yurish davomida faqat damkalar yurib, urish bo'lmasa.",
  },
];

/** A mid-game position for the hero picture: white's king on d4 is about to take e5. */
const DEMO_PIECES = [
  ...["a1", "c1", "e1", "b2", "f2", "h2", "c3", "g3"].map((s) => ({ s, owner: 0 as const })),
  { s: "d4", owner: 0 as const, king: true },
  ...["b6", "h6", "a7", "c7", "e7", "g7", "b8", "d8", "h8"].map((s) => ({
    s,
    owner: 1 as const,
  })),
  { s: "e5", owner: 1 as const },
].map((p) => ({ square: toSquare(p.s), owner: p.owner, king: "king" in p }));

function toSquare(name: string) {
  return (Number(name[1]) - 1) * 8 + "abcdefgh".indexOf(name[0]!);
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function ShashkaPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={faqJsonLd} />
      <SiteHeader current="checkers" />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              ⚫ Rus shashkasi · 2 kishi · bepul
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Do&apos;stlar bilan <span className="text-primary">onlayn shashka</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Stol yarating, havolani do&apos;stingizga yuboring va bir zumda shashka o&apos;ynang.
              Majburiy urish, ketma-ket urishlar va uchar damka — hammasi haqiqiy rus shashkasi
              qoidalari bo&apos;yicha. Yurishlarni server tekshiradi, siz faqat o&apos;ylaysiz.
            </p>
            <CreateCheckersTable className="mt-8" />
          </div>
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#2f5d50]/40 via-[#c69c6d]/25 to-[#4a2c17]/30 blur-3xl" />
            <StaticBoard pieces={DEMO_PIECES} marks={[toSquare("f6")]} />
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h2 className="font-display text-2xl font-bold">Qanday o&apos;ynaladi</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {RULES.map((rule, i) => (
              <li key={rule.title} className="rounded-card border border-border bg-surface p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-sm text-primary">
                    {i + 1}
                  </span>
                  {rule.title}
                </div>
                <p className="mt-1.5 text-sm text-muted">{rule.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-col items-center rounded-card border border-dashed border-border p-6 text-center">
            <p className="text-muted">
              Taxta, donalar va qoidalar tayyor. Faqat raqib kerak: stol yarating va havolani
              do&apos;stingizga yuboring.
            </p>
            <CreateCheckersTable className="mt-4 md:items-center" />
          </div>

          <h2 className="mt-16 font-display text-2xl font-bold">Ko&apos;p beriladigan savollar</h2>
          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
