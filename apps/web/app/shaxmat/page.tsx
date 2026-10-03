import type { Metadata } from "next";
import { CreateChessTable } from "@/components/games/chess/create-chess-table";
import { StaticChessBoard } from "@/components/games/chess/pieces";
import { JsonLd } from "@/components/site/json-ld";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { OPEN_GRAPH } from "@/lib/seo";

const TITLE = "Shaxmat onlayn: do'stlar bilan shaxmat o'ynash";
const DESCRIPTION =
  "Shaxmat online: do'stingizga havola yuboring va bepul onlayn shaxmat o'ynang. Ro'yxatdan o'tmasdan, soat bilan yoki soatsiz, telefonda ham.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "shaxmat online",
    "shaxmat o'ynash",
    "onlayn shaxmat",
    "do'stlar bilan shaxmat",
    "shaxmat o'yini",
    "шахматы онлайн",
    "шахматы с другом",
  ],
  alternates: { canonical: "/shaxmat" },
  openGraph: { ...OPEN_GRAPH, title: TITLE, description: DESCRIPTION, url: "/shaxmat" },
};

/** Italian game after 3.Bc4: the last move is highlighted. */
const DEMO_FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";

const RULES: { title: string; text: string }[] = [
  {
    title: "Maqsad",
    text: "Raqib shohiga mat qilish: shoh hujum ostida (shoh) va undan qochib bo'lmaydi. Oqlar birinchi yuradi, keyin navbat bilan.",
  },
  {
    title: "Donalar",
    text: "Shoh bir katak istalgan tomonga yuradi. Farzin to'g'ri va diagonal bo'ylab istalgancha, rux faqat to'g'ri, fil faqat diagonal bo'ylab. Ot «G» shaklida sakraydi. Piyoda oldinga bir katak (birinchi yurishda ikki katak) yuradi va diagonal bo'ylab uradi.",
  },
  {
    title: "Rokirovka",
    text: "Shoh va rux hali yurmagan, oralig'i bo'sh va shoh hujum ostidan o'tmasa, shoh rux tomonga ikki katak suriladi, rux esa uning ortidan o'tadi. Ilovada shohni ikki katak suring.",
  },
  {
    title: "O'tib ketayotganni urish",
    text: "Piyoda ikki katak yurib raqib piyodasi yonida to'xtasa, raqib uni darhol keyingi yurishda xuddi bir katak yurgandek urishi mumkin.",
  },
  {
    title: "Piyodaning aylanishi",
    text: "Oxirgi qatorga yetgan piyoda farzin, rux, fil yoki otga aylanadi. Ilova qaysi birini tanlashni so'raydi.",
  },
  {
    title: "Durang",
    text: "Pat (yurishga joy yo'q, lekin shoh ham yo'q), pozitsiya uch marta takrorlansa, 50 yurish davomida urish va piyoda yurishi bo'lmasa, mat qilishga dona yetmasa yoki ikkala o'yinchi kelishsa durang bo'ladi.",
  },
  {
    title: "Vaqt",
    text: "Soatli o'yinda har kimning o'z vaqti bor. Oqlarning soati o'yin boshlanishi bilan yuradi. Har yurishdan keyin qo'shimcha soniyalar qo'shiladi (masalan, 10 + 5). Vaqti tugagan yutqazadi, raqibida mat qilishga dona qolmagan bo'lsa durang.",
  },
];

const FAQ = [
  {
    question: "Do'stim bilan onlayn shaxmat qanday o'ynayman?",
    answer:
      "Vaqt nazoratini tanlang va «Stol yaratish» tugmasini bosing. Havolani do'stingizga Telegram orqali yuboring: u ochishi bilan stolga o'tiradi. Ikkalangiz tayyor bo'lgach, o'yin boshlanadi.",
  },
  {
    question: "Ro'yxatdan o'tish yoki ilova o'rnatish kerakmi?",
    answer:
      "Yo'q. Shaxmat brauzerda ishlaydi, faqat ismingizni yozasiz. Telefonda ham, kompyuterda ham o'ynash mumkin.",
  },
  {
    question: "Kim oqlar bilan o'ynaydi?",
    answer:
      "Stolga birinchi o'tirgan o'yinchi oqlar bilan boshlaydi. Qayta o'ynaganda ranglar almashadi.",
  },
  {
    question: "Qanday vaqt nazoratlari bor?",
    answer:
      "3, 5, 10, 15 yoki 30 daqiqa, har yurishga 0 dan 10 soniyagacha qo'shimcha bilan. Shoshilmasdan o'ynamoqchi bo'lsangiz, soatsiz stol yarating.",
  },
  {
    question: "Durang taklif qilsa yoki taslim bo'lsa bo'ladimi?",
    answer:
      "Ha. «Durang taklif qilish» tugmasi raqibga taklif yuboradi, u qabul qilishi yoki rad etishi mumkin. Taslim bo'lish tugmasi o'yinning yuqori qismida.",
  },
  {
    question: "Boshqalar o'yinni tomosha qila oladimi?",
    answer:
      "Ha. Stol havolasini ochgan boshqa odamlar tomoshabin bo'lib qo'shiladi va chatda yozishishi mumkin.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function ChessPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={faqJsonLd} />
      <SiteHeader current="chess" />

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-6 pb-16 md:grid-cols-[1fr_1fr] md:pt-12">
          <div className="text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
              Bepul · ro&apos;yxatdan o&apos;tmasdan
            </span>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Do&apos;stlar bilan <span className="text-primary">onlayn shaxmat</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg text-muted md:mx-0">
              Stol yarating, havolani do&apos;stingizga yuboring va shu zahoti shaxmat o&apos;ynang.
              Barcha FIDE qoidalari, shaxmat soati, durang taklifi va chat bor. Telefonda ham qulay:
              donani bosib yoki sudrab yurasiz.
            </p>
            <CreateChessTable className="mt-8" />
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-[#b48762]/40 via-[#6C5CE7]/25 to-[#f0dcbc]/40 blur-3xl" />
            <StaticChessBoard fen={DEMO_FEN} highlight={["f1", "c4"]} />
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 pb-16">
          <h2 className="font-display text-2xl font-bold">Qanday o&apos;ynaladi</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {RULES.map((rule) => (
              <li key={rule.title} className="rounded-card border border-border bg-surface p-4">
                <h3 className="font-semibold">{rule.title}</h3>
                <p className="mt-1 text-sm text-muted">{rule.text}</p>
              </li>
            ))}
          </ul>

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
