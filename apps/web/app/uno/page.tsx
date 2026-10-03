import { TABLE_GAMES } from "@puzzle/shared/games";
import { UNO_HAND_SIZE } from "@puzzle/shared/games/uno";
import type { Metadata } from "next";
import { UnoCreate } from "@/components/games/uno/create";
import { UnoDemo } from "@/components/landing/uno-demo";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { OPEN_GRAPH } from "@/lib/seo";

const game = TABLE_GAMES.uno;
const TITLE = "Uno onlayn: do'stlar bilan karta o'yini";
const DESCRIPTION = `Uno onlayn bepul: ${game.minPlayers}–${game.maxPlayers} kishilik karta o'yini do'stlar bilan. Stol yarating, havolani Telegram'da ulashing va ro'yxatdan o'tmasdan uno o'ynang.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["uno online", "uno onlayn", "uno o'ynash", "karta o'yini onlayn", "уно онлайн"],
  alternates: { canonical: "/uno" },
  openGraph: { ...OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: "/uno" },
};

const FAQ = [
  {
    question: "Uno onlayn o'ynash bepulmi?",
    answer:
      "Ha, butunlay bepul. Ro'yxatdan o'tish shart emas: ismingizni yozasiz, stol yaratasiz va havolani do'stlaringizga yuborasiz.",
  },
  {
    question: "Necha kishi o'ynashi mumkin?",
    answer: `Bir stolda ${game.minPlayers} dan ${game.maxPlayers} kishigacha. Stol to'lgandan keyin kelganlar o'yinni tomosha qiladi.`,
  },
  {
    question: "«Uno!» deyishni unutsam nima bo'ladi?",
    answer:
      "Oxirgidan oldingi kartani qo'yayotganda «Uno!» tugmasini bosmasangiz, keyingi o'yinchi yurgunicha boshqalar «Ushla!» tugmasi bilan sizni ushlab qolishi mumkin. Ushlansangiz, 2 ta karta olasiz.",
  },
  {
    question: "+2 ustiga +2 qo'yish mumkinmi?",
    answer:
      "Stol yaratayotganda «+2 / +4 ustiga qo'yish» qoidasini yoqsangiz bo'ladi. Shunda +2 ga +2 bilan, +4 ga +4 bilan javob berasiz, jami kartalarni esa javob bera olmagan o'yinchi oladi.",
  },
  {
    question: "Bu rasmiy UNO o'yinimi?",
    answer:
      "Yo'q, bu Uno uslubidagi karta o'yini: qoidalar tanish, kartalar dizayni esa Davradoshning o'ziniki. UNO nomi Mattel kompaniyasiga tegishli.",
  },
  {
    question: "Telefonda o'ynasa bo'ladimi?",
    answer:
      "Ha, o'yin brauzerda ishlaydi va telefon ekraniga moslashgan. Hech narsa o'rnatish kerak emas.",
  },
];

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export default function UnoPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={faqJsonLd()} />
      <SiteHeader current="uno" />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1.05fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              🃏 {game.minPlayers}–{game.maxPlayers} kishi · bepul · brauzerda
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              <span className="text-primary">Uno onlayn</span>: do&apos;stlar bilan karta
              o&apos;yini
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Uno uslubidagi karta o&apos;yini: rang yoki raqamni moslang, +2 va +4 bilan raqiblarni
              to&apos;xtating va oxirgi kartada «Uno!» deyishni unutmang. Stol yarating, havolani
              yuboring va bir daqiqada o&apos;ynashni boshlang.
            </p>
            <div className="mt-8">
              <UnoCreate />
            </div>
          </div>
          <UnoDemo />
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h2 className="font-display text-2xl font-bold">Qanday o&apos;ynaladi</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted">
            <li>
              <strong className="text-foreground">Tarqatish.</strong> Dastada 108 ta karta bor:
              to&apos;rt rang (qizil, sariq, yashil, ko&apos;k), 0–9 raqamlar, «o&apos;tkazish»,
              «teskari», +2 hamda qora joker va +4 joker. Har kimga {UNO_HAND_SIZE} tadan karta
              beriladi, bittasi ochib qo&apos;yiladi.
            </li>
            <li>
              <strong className="text-foreground">Yurish.</strong> Navbatingizda ochiq kartaga
              rangi, raqami yoki belgisi mos kartani qo&apos;ying. Joker va +4 ni istalgan payt
              qo&apos;yish mumkin: rangni o&apos;zingiz tanlaysiz.
            </li>
            <li>
              <strong className="text-foreground">Karta olish.</strong> Qo&apos;yolmasangiz yoki
              qo&apos;yishni istamasangiz, dastadan bitta karta olasiz. U mos kelsa, darhol
              qo&apos;yishingiz yoki navbatni o&apos;tkazishingiz mumkin.
            </li>
            <li>
              <strong className="text-foreground">Maxsus kartalar.</strong> «O&apos;tkazish» keyingi
              o&apos;yinchini o&apos;tkazib yuboradi, «teskari» yo&apos;nalishni o&apos;zgartiradi
              (ikki kishida o&apos;tkazish kabi), +2 va +4 keyingi o&apos;yinchiga 2 yoki 4 ta karta
              oldirib, navbatini oladi.
            </li>
            <li>
              <strong className="text-foreground">«Uno!».</strong> Oxirgidan oldingi kartani
              qo&apos;yayotganda «Uno!» tugmasini bosing. Unutsangiz, boshqalar sizni ushlab, 2 ta
              karta oldiradi.
            </li>
            <li>
              <strong className="text-foreground">G&apos;alaba.</strong> Kartalarini birinchi
              bo&apos;lib tugatgan o&apos;yinchi yutadi. Har navbatga vaqt beriladi (15, 30 yoki 60
              soniya): vaqt tugasa, o&apos;yinchi bitta karta olib navbatni o&apos;tkazadi.
            </li>
          </ol>

          <div className="mt-12 flex flex-col items-center rounded-card border border-dashed border-border p-6 text-center">
            <p className="text-muted">
              Stol yarating va havolani do&apos;stlaringizga yuboring. Hamma tayyor bo&apos;lgach,
              kartalar avtomatik tarqatiladi.
            </p>
            <div className="mt-4">
              <UnoCreate compact />
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
