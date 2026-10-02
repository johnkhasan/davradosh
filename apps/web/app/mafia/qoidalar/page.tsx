import {
  BEST_MOVE_SIZE,
  blackTeamSize,
  MAFIA_DRAW_NIGHTS,
  MAFIA_FOULS_OUT,
  MAFIA_FOULS_SILENCE,
  MAFIA_MAX_PLAYERS,
  MAFIA_MIN_PLAYERS,
  MAFIA_PLAYERS,
  MAFIA_TIMINGS,
} from "@puzzle/shared/mafia";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/site/json-ld";
import { OPEN_GRAPH, RULES_DESCRIPTION, RULES_TITLE, rulesJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: RULES_TITLE },
  description: RULES_DESCRIPTION,
  alternates: { canonical: "/mafia/qoidalar" },
  openGraph: {
    ...OPEN_GRAPH,
    type: "article",
    url: "/mafia/qoidalar",
    title: RULES_TITLE,
    description: RULES_DESCRIPTION,
  },
};

const s = (ms: number) => Math.round(ms / 1000);

const SECTIONS = [
  ["maqsad", "O'yinning maqsadi"],
  ["rollar", "Rollar va stol"],
  ["boshlanish", "O'yin boshlanishi"],
  ["kun", "Kun: muhokama"],
  ["ovoz", "Ovoz berish"],
  ["tun", "Tun"],
  ["yurish", "Eng yaxshi yurish"],
  ["foll", "Folllar"],
  ["galaba", "G'alaba va durang"],
  ["onlayn", "Onlayn o'yinda"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mt-12 font-display text-2xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

const sizes = Array.from(
  { length: MAFIA_MAX_PLAYERS - MAFIA_MIN_PLAYERS + 1 },
  (_, i) => MAFIA_MIN_PLAYERS + i,
);

export default function MafiaRulesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
      <JsonLd data={rulesJsonLd()} />
      <Link
        href="/mafia"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Mafia
      </Link>

      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Mafia qoidalari
      </h1>
      <p className="mt-4 text-lg text-muted">
        Sport mafiasining rasmiy qoidalari (Sport mafiasi federatsiyasi, 2022). Bizda boshlovchini
        server bajaradi: fazalar, taymerlar, so&apos;z navbati va ovozlarni hisoblash avtomatik.
      </p>

      <nav aria-label="Mundarija" className="mt-8 rounded-card border border-border bg-surface p-4">
        <p className="text-sm font-semibold">Mundarija</p>
        <ol className="mt-2 grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm sm:grid-cols-2">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-primary hover:underline">
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="maqsad" title="O'yinning maqsadi">
        <p>
          Stol atrofida ikki jamoa bor: <strong>qizillar</strong> (tinch aholi va Sherif) va{" "}
          <strong>qoralar</strong> (mafiya va Don). Qoralar bir-birini taniydi, qizillar esa kim
          kimligini bilmaydi.
        </p>
        <p>
          Kunduzi hamma birga muhokama qiladi va ovoz berib bir o&apos;yinchini stoldan chiqaradi.
          Kechasi qoralar yashirincha bir o&apos;yinchini «otadi». Qizillar qoralarni topib
          chiqarishi, qoralar esa sezdirmay qizillarni kamaytirishi kerak.
        </p>
      </Section>

      <Section id="rollar" title="Rollar va stol">
        <ul className="space-y-2">
          <li>
            🙂 <strong>Tinch aholi</strong>: tunda uxlaydi. Kuchi muhokama va ovozda.
          </li>
          <li>
            ⭐ <strong>Sherif</strong>: har tun bitta o&apos;yinchini tekshiradi va uning qizil yoki
            qora ekanini bilib oladi. Natijani faqat o&apos;zi ko&apos;radi.
          </li>
          <li>
            🕶️ <strong>Mafiya</strong>: har tun jamoasi bilan birga bitta o&apos;yinchini otadi.
          </li>
          <li>
            🎩 <strong>Don</strong>: mafiyaning boshlig&apos;i. U ham otadi va har tun bitta
            o&apos;yinchini tekshirib, u Sherifmi yoki yo&apos;qmi, shuni bilib oladi.
          </li>
        </ul>
        <p>
          Rasmiy o&apos;yin <strong>{MAFIA_PLAYERS} kishi</strong> bilan o&apos;ynaladi: 6 tinch
          aholi, Sherif, 2 mafiya va Don. Stolni {MAFIA_MIN_PLAYERS} dan {MAFIA_MAX_PLAYERS}{" "}
          kishigacha yaratish mumkin. Qoidalar o&apos;zgarmaydi, faqat qoralar soni o&apos;zgaradi:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                <th className="py-2 pr-3 font-semibold">Jami</th>
                <th className="py-2 pr-3 font-semibold">Qora (Don bilan)</th>
                <th className="py-2 pr-3 font-semibold">Sherif</th>
                <th className="py-2 font-semibold">Tinch</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((n) => (
                <tr key={n} className="border-b border-border/60">
                  <td className="py-1.5 pr-3 tabular-nums">
                    {n}
                    {n === MAFIA_PLAYERS && (
                      <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 text-xs font-semibold text-primary">
                        rasmiy
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{blackTeamSize(n)}</td>
                  <td className="py-1.5 pr-3">1</td>
                  <td className="py-1.5 tabular-nums">{n - blackTeamSize(n) - 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          O&apos;yin boshida hammaga tasodifiy <strong>stol raqami</strong> beriladi. O&apos;yin
          davomida o&apos;yinchilarga raqam bilan murojaat qilinadi.
        </p>
      </Section>

      <Section id="boshlanish" title="O'yin boshlanishi">
        <p>
          Har kim o&apos;z rol kartasini ko&apos;radi. Karta faqat bosganda ochiladi, shunda
          yoningizdagilar ko&apos;rib qolmaydi.
        </p>
        <p>
          Keyin <strong>tanishuv tuni</strong> boshlanadi. Bu tunda hech kim o&apos;lmaydi. Qoralar
          bir-birini ko&apos;radi va {s(MAFIA_TIMINGS.zeroNight)} soniya ichida keyingi tunlarda
          kimni qaysi tartibda otishni kelishib oladi. Bu qoralar gaplasha oladigan yagona tun.
        </p>
      </Section>

      <Section id="kun" title="Kun: muhokama">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Har kimga navbat bilan <strong>{s(MAFIA_TIMINGS.speech)} soniya</strong> so&apos;z
            beriladi. Faqat navbatdagi o&apos;yinchi gapiradi, boshqalarning mikrofoni yopiq.
          </li>
          <li>
            Birinchi kunni 1-raqam boshlaydi. Keyingi har kunni oldingi kun birinchi gapirgandan
            keyingi o&apos;yinchi boshlaydi.
          </li>
          <li>
            Gapirib bo&apos;lgan o&apos;yinchi «Pas» ni bosib, so&apos;zini erta tugatishi mumkin.
          </li>
          <li>
            O&apos;z daqiqasida har kim <strong>bitta nomzod</strong> ko&apos;rsatishi mumkin. Bir
            o&apos;yinchi faqat bir marta nomzod bo&apos;ladi.
          </li>
          <li>
            Stoldan chiqayotgan har bir o&apos;yinchiga{" "}
            <strong>{s(MAFIA_TIMINGS.lastWords)} soniya</strong> oxirgi so&apos;z beriladi.
          </li>
        </ul>
      </Section>

      <Section id="ovoz" title="Ovoz berish">
        <ul className="list-disc space-y-2 pl-5">
          <li>Muhokamadan keyin faqat ko&apos;rsatilgan nomzodlar orasida ovoz beriladi.</li>
          <li>
            <strong>Birinchi kunda</strong> faqat bitta nomzod bo&apos;lsa, ovoz berilmaydi. Keyingi
            kunlarda bitta nomzod ham ovozga qo&apos;yiladi.
          </li>
          <li>
            Har kimning bitta ovozi bor. <strong>Ovoz bermaganning ovozi oxirgi nomzodga</strong>{" "}
            o&apos;tadi.
          </li>
          <li>
            <strong>Eng ko&apos;p ovoz</strong> olgan o&apos;yinchi stoldan chiqadi. Uning roli
            o&apos;yin oxirigacha oshkor qilinmaydi.
          </li>
          <li>
            <strong>Teng ovoz</strong> bo&apos;lsa, teng qolganlar {s(MAFIA_TIMINGS.tieSpeech)}{" "}
            soniyadan qo&apos;shimcha so&apos;z oladi va ular orasida qayta ovoz beriladi. Qayta
            ovozda kamroq o&apos;yinchi teng qolsa, ular yana so&apos;z oladi. Xuddi o&apos;sha
            o&apos;yinchilar yana teng qolsa, «Hammasi chiqsinmi?» degan ovoz beriladi.
            Ko&apos;pchilik «ha» desa, hammasi chiqadi, aks holda hammasi qoladi.
          </li>
          <li>Ovozlar ochiq: kim kimga ovoz bergani hammaga ko&apos;rinadi.</li>
        </ul>
      </Section>

      <Section id="tun" title="Tun">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Mafiya ovga chiqadi.</strong> Har bir tirik qora, gaplashmasdan, bitta nishonni
            tanlaydi. <strong>Hammasi bitta o&apos;yinchini</strong> tanlasa, u o&apos;ldiriladi.
            Kimdir boshqa nishonni tanlasa yoki otmasa, <strong>o&apos;q tegmaydi</strong> va bu
            tunda hech kim o&apos;lmaydi.
          </li>
          <li>
            <strong>Don Sherifni qidiradi</strong>: bitta o&apos;yinchini tekshiradi.
          </li>
          <li>
            <strong>Sherif tekshiradi</strong>: bitta o&apos;yinchining qizil yoki qora ekanini
            bilib oladi.
          </li>
          <li>
            <strong>Tong otadi</strong>: kim o&apos;ldirilgani (yoki o&apos;q tegmagani) e&apos;lon
            qilinadi va o&apos;ldirilgan o&apos;yinchi oxirgi so&apos;zini aytadi.
          </li>
        </ol>
        <p>
          Tunda kim nima qilgani o&apos;yin tugaguncha sir qoladi. Har bir tungi bosqich doim bir
          xil vaqt davom etadi, shuning uchun vaqtdan hech narsani bilib bo&apos;lmaydi.
        </p>
      </Section>

      <Section id="yurish" title="Eng yaxshi yurish">
        <p>
          Tanishuv tunidan keyingi <strong>birinchi tunda</strong> o&apos;ldirilgan o&apos;yinchi
          tong otishidan oldin qora deb o&apos;ylagan{" "}
          <strong>{BEST_MOVE_SIZE} ta o&apos;yinchini</strong> aytadi ({s(MAFIA_TIMINGS.bestMove)}{" "}
          soniya). Bu raqamlar tongda hammaga e&apos;lon qilinadi.
        </p>
        <p>
          Istisno: birinchi kunda ovoz bilan 2 yoki undan ko&apos;p o&apos;yinchi chiqqan
          bo&apos;lsa, eng yaxshi yurish berilmaydi.
        </p>
      </Section>

      <Section id="foll" title="Folllar">
        <p>
          Stol egasi (host) qoidani buzgan o&apos;yinchiga foll berishi mumkin: masalan, haqorat
          uchun yoki «qasamyod qilaman, men qizilman» kabi gaplar uchun.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>{MAFIA_FOULS_SILENCE} foll</strong>: keyingi daqiqasida o&apos;yinchi gapira
            olmaydi, faqat nomzod ko&apos;rsatishi mumkin. Stolda 3–4 kishi qolgan bo&apos;lsa,
            gapirish o&apos;rniga 30 soniya oladi.
          </li>
          <li>
            <strong>{MAFIA_FOULS_OUT} foll</strong>: o&apos;yinchi darhol, oxirgi so&apos;zsiz
            stoldan chiqadi. O&apos;sha kungi ovoz berish o&apos;tkazilmaydi.
          </li>
        </ul>
      </Section>

      <Section id="galaba" title="G'alaba va durang">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Qizillar yutadi</strong>, qachonki barcha qoralar stoldan chiqsa.
          </li>
          <li>
            <strong>Qoralar yutadi</strong>, qachonki stolda qoralar qizillar bilan teng bo&apos;lib
            qolsa yoki ulardan ko&apos;p bo&apos;lsa.
          </li>
          <li>
            <strong>Durang</strong>: ketma-ket {MAFIA_DRAW_NIGHTS} tun davomida hech kim stoldan
            chiqmasa.
          </li>
        </ul>
        <p>
          O&apos;yin tugagach hamma rollar ochiladi va har bir tunda kim kimni otgani, Don va Sherif
          kimni tekshirgani ko&apos;rsatiladi.
        </p>
      </Section>

      <Section id="onlayn" title="Onlayn o'yinda">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Ovozli chatda gaplashasiz. So&apos;z navbatingiz kelganda mikrofoningiz o&apos;zi
            ochiladi, boshqa paytda server uni yopiq ushlaydi.
          </li>
          <li>
            Mikrofoningiz yo&apos;qmi? O&apos;z navbatingizda matn bilan yozing, u hammaga
            ko&apos;rinadi. Tanishuv tunida qoralarning maxfiy chati ham bor.
          </li>
          <li>
            Ovoz berish, otish va tekshirish tugmalar bilan qilinadi: avval o&apos;rinni tanlaysiz,
            keyin tasdiqlaysiz.
          </li>
          <li>
            Aloqa uzilsa, 90 soniya ichida qaytsangiz, o&apos;yinni davom ettirasiz. Qaytmasangiz,
            stoldan chiqqan hisoblanasiz.
          </li>
          <li>O&apos;yin boshlangandan keyin kelganlar tomoshabin bo&apos;lib kuzatadi.</li>
        </ul>
      </Section>

      <div className="mt-14 flex justify-center">
        <Link
          href="/mafia"
          className="rounded-control bg-primary px-7 py-3.5 text-lg font-semibold text-primary-foreground shadow-soft-lg"
        >
          O&apos;ynashga qaytish
        </Link>
      </div>
    </div>
  );
}
