import type { Metadata } from "next";
import { CreateBattleship } from "@/components/games/battleship/create-battleship";
import { SEA_STYLE } from "@/components/games/battleship/sea-grid";
import { BattleshipDemo } from "@/components/landing/battleship-demo";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SITE_URL } from "@/lib/env";
import { OPEN_GRAPH, SITE_NAME } from "@/lib/seo";

const TITLE = "Dengiz jangi onlayn: do'stlar bilan o'ynash";
const DESCRIPTION =
  "Dengiz jangi o'yini onlayn: do'stingiz bilan bepul морской бой (battleship) o'ynang. Kemalarni joylashtiring, havolani yuboring va raqib flotini cho'ktiring.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/dengiz-jangi" },
  openGraph: { ...OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: "/dengiz-jangi" },
};

const FAQ = [
  {
    question: "Dengiz jangi onlayn o'yini bepulmi?",
    answer:
      "Ha, butunlay bepul. Ro'yxatdan o'tish shart emas: ism tanlaysiz, stol yaratasiz va havolani do'stingizga yuborasiz.",
  },
  {
    question: "Do'stim bilan qanday o'ynayman?",
    answer:
      "«Stol yaratish» tugmasini bosing va havolani Telegram yoki WhatsApp orqali yuboring. Do'stingiz havolani ochib stolga o'tiradi, siz o'yinni boshlaysiz.",
  },
  {
    question: "Kemalarni qanday joylashtiraman?",
    answer:
      "Kemani tanlab, dengizdagi katakka bosing. Joylashgan kemani bossangiz buriladi, sudrasangiz suriladi. Vaqt bo'lmasa «Tasodifiy joylash» tugmasi hammasini bir zumda joylaydi.",
  },
  {
    question: "Kemalar bir-biriga tegib tursa bo'ladimi?",
    answer:
      "Yo'q. Klassik qoida bo'yicha kemalar orasida kamida bitta bo'sh katak bo'lishi kerak, burchagi bilan tegishi ham mumkin emas.",
  },
  {
    question: "O'q uzish uchun qancha vaqt beriladi?",
    answer:
      "Stol yaratayotganda 30, 45 yoki 60 soniya yoki cheklovsiz variantni tanlaysiz. Vaqt tugasa, o'q tasodifiy katakka o'zi uziladi.",
  },
  {
    question: "Telefonda o'ynasa bo'ladimi?",
    answer:
      "Ha. Dengiz jangi telefon, planshet va kompyuter brauzerida ishlaydi, hech narsa yuklab olish shart emas.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["VideoGame", "WebApplication"],
      "@id": `${SITE_URL}/dengiz-jangi#game`,
      name: `Dengiz jangi — ${SITE_NAME}`,
      alternateName: ["Морской бой онлайн", "Battleship online"],
      url: `${SITE_URL}/dengiz-jangi`,
      description: DESCRIPTION,
      genre: ["Board game", "Strategy", "Battleship"],
      applicationCategory: "GameApplication",
      gamePlatform: "Web browser",
      operatingSystem: "Any (web browser)",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 2 },
      inLanguage: "uz",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "UZS" },
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Dengiz jangi",
          item: `${SITE_URL}/dengiz-jangi`,
        },
      ],
    },
  ],
};

const RULES: Array<[string, string]> = [
  [
    "Flot.",
    "Har bir o'yinchida 10×10 maydon va 10 ta kema bor: bitta 4 palubali, ikkita 3 palubali, uchta 2 palubali va to'rtta 1 palubali.",
  ],
  [
    "Joylashtirish.",
    "Kemalar to'g'ri chiziqda, yotiq yoki tik turadi va bir-biriga, hatto burchagi bilan ham tegmaydi. Joylashtirishga 2 daqiqa beriladi.",
  ],
  [
    "O'q uzish.",
    "Navbat bilan raqib dengizidagi katakni tanlaysiz (masalan, B5). Tegsa yana otasiz, xato ketsa navbat raqibga o'tadi.",
  ],
  [
    "Cho'kish.",
    "Kemaning hamma katagiga o'q tegsa, u cho'kadi. Atrofidagi kataklar avtomatik bo'sh deb belgilanadi: u yerda kema bo'lishi mumkin emas.",
  ],
  ["G'alaba.", "Raqibning butun flotini birinchi bo'lib cho'ktirgan o'yinchi yutadi."],
];

export default function DengizJangiPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={jsonLd} />
      <SiteHeader current="battleship" />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              🚢 2 kishilik · bepul · ro&apos;yxatsiz
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              <span className="text-primary">Dengiz jangi</span> onlayn
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Bolalikdagi «морской бой» endi brauzerda: kemalaringizni joylashtiring, havolani
              do&apos;stingizga yuboring va navbat bilan o&apos;q uzing. Kim raqib flotini birinchi
              cho&apos;ktirsa, o&apos;sha yutadi.
            </p>
            <div className="mt-8">
              <CreateBattleship />
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]" style={SEA_STYLE}>
            <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#2f8fe0]/35 via-[#6C5CE7]/20 to-[#00c2a8]/25 blur-3xl" />
            <div className="rounded-[28px] border border-border bg-surface p-4 shadow-soft-lg">
              <BattleshipDemo />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h2 className="font-display text-2xl font-bold">Qanday o&apos;ynaladi</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            {RULES.map(([title, text]) => (
              <li key={title}>
                <strong className="text-foreground">{title}</strong> {text}
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-col items-center rounded-card border border-dashed border-border p-6 text-center">
            <p className="text-muted">
              Stol yarating va havolani do&apos;stingizga yuboring. Har o&apos;q uchun vaqtni
              o&apos;zingiz tanlaysiz, qayta o&apos;yinda birinchi o&apos;q navbati almashadi.
            </p>
            <div className="mt-4">
              <CreateBattleship compact />
            </div>
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
