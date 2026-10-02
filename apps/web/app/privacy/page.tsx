import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OPEN_GRAPH } from "@/lib/seo";

const CONTACT = "javohirdevuz@gmail.com";
const UPDATED = "2026-yil 2-oktabr";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati",
  description:
    "Davradosh qanday ma'lumot yig'adi, qayerda saqlaydi va qachon o'chiradi: ism, xonalar, rasmlar, chat va ovoz.",
  alternates: { canonical: "/privacy" },
  openGraph: { ...OPEN_GRAPH, url: "/privacy", title: "Maxfiylik siyosati · Davradosh" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mt-10 font-display text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Bosh sahifa
      </Link>
      <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
        Maxfiylik siyosati
      </h1>
      <p className="mt-2 text-sm text-muted">Oxirgi yangilanish: {UPDATED}</p>
      <p className="mt-6 leading-relaxed text-muted">
        Davradosh (davradosh.uz sayti va iOS hamda Android ilovalari) — do&apos;stlar bilan birga
        o&apos;ynaladigan o&apos;yinlar: puzzle va mafia. Ro&apos;yxatdan o&apos;tish, parol va
        email talab qilinmaydi. Quyida qaysi ma&apos;lumotlar va nima uchun ishlatilishi, qancha
        saqlanishi aytilgan.
      </p>

      <Section title="Qanday ma'lumot ishlatiladi">
        <ul>
          <li>
            <strong>Ism, rang va avatar</strong> — o&apos;zingiz tanlaysiz. Ular xonadagi boshqa
            o&apos;yinchilarga ko&apos;rinadi.
          </li>
          <li>
            <strong>Qurilma identifikatori</strong> — qurilmangizda yaratiladigan tasodifiy raqam.
            Siz xonaga qaytganingizda o&apos;rningizni tanish uchun kerak. U sizning shaxsingiz,
            telefon raqamingiz yoki qurilma reklama ID&apos;si bilan bog&apos;liq emas. Boshqa
            o&apos;yinchilar uni emas, undan hosil qilingan va orqaga tiklab bo&apos;lmaydigan
            boshqa raqamni ko&apos;radi.
          </li>
          <li>
            <strong>O&apos;yin ma&apos;lumotlari</strong> — puzzle bo&apos;laklarining holati, kim
            nechta bo&apos;lak qo&apos;shgani, mafia o&apos;yinining borishi, xonadan chiqarilgan
            o&apos;yinchilar ro&apos;yxati.
          </li>
          <li>
            <strong>Yuklangan rasmlar</strong> — puzzle uchun o&apos;zingiz tanlagan rasm. Serverga
            yuklashdan oldin rasmdagi barcha metama&apos;lumotlar (joylashuv, kamera ma&apos;lumoti
            va boshqalar) o&apos;chiriladi.
          </li>
          <li>
            <strong>Chat xabarlari</strong> — xonadagilarga ko&apos;rinadi. Puzzle chati bazaga
            yozilmaydi va faqat xona ochiq turgan paytda server xotirasida saqlanadi.
          </li>
          <li>
            <strong>Ovoz va video</strong> — faqat siz mikrofon yoki kamerani yoqqaningizda
            xonadagilarga jonli uzatiladi. <strong>Hech qachon yozib olinmaydi.</strong>
          </li>
          <li>
            <strong>Texnik loglar</strong> — server so&apos;rovlarining IP manzili va vaqti. Ular
            faqat xavfsizlik va nosozliklarni tuzatish uchun qisqa muddat saqlanadi.
          </li>
        </ul>
      </Section>

      <Section title="Nima qilmaymiz">
        <ul>
          <li>Reklama ko&apos;rsatmaymiz va ma&apos;lumotlaringizni sotmaymiz.</li>
          <li>Analitika yoki kuzatuv (tracking) xizmatlaridan foydalanmaymiz.</li>
          <li>Ma&apos;lumotlarni uchinchi tomonlarga marketing uchun bermaymiz.</li>
        </ul>
      </Section>

      <Section title="Qancha saqlanadi">
        <ul>
          <li>
            <strong>Puzzle xonalari</strong> yaratilganidan 7 kun o&apos;tib, ularning holati va
            statistikasi bilan birga avtomatik o&apos;chiriladi.
          </li>
          <li>
            <strong>Mafia stollari</strong> 24 soatdan keyin avtomatik o&apos;chiriladi.
          </li>
          <li>
            <strong>Yuklangan rasmlar</strong> serverda saqlanadi. Ularni o&apos;chirishni
            istasangiz, quyidagi email orqali murojaat qiling.
          </li>
          <li>
            <strong>Ism, rang, avatar va qurilma identifikatori</strong> qurilmangizda saqlanadi.
            Ilovani o&apos;chirsangiz yoki brauzer ma&apos;lumotlarini tozalasangiz, ular ham
            o&apos;chadi.
          </li>
        </ul>
      </Section>

      <Section title="Qurilma ruxsatlari (ilova)">
        <ul>
          <li>
            <strong>Mikrofon</strong> — ovozli chat uchun. Faqat mikrofon tugmasini bosganingizda
            so&apos;raladi.
          </li>
          <li>
            <strong>Kamera</strong> — video chat va puzzle uchun rasmga olish uchun.
          </li>
          <li>
            <strong>Rasmlar</strong> — puzzle qilish uchun o&apos;zingiz tanlagan rasmni yuklash
            uchun. Ilova galereyangizni ko&apos;rib chiqmaydi.
          </li>
        </ul>
        <p>
          Ruxsatni istalgan vaqtda telefon sozlamalaridan o&apos;chirib qo&apos;yishingiz mumkin.
        </p>
      </Section>

      <Section title="Xizmatlar va serverlar">
        <ul>
          <li>Sayt Vercel platformasida joylashgan.</li>
          <li>
            O&apos;yin serveri, ma&apos;lumotlar bazasi, rasmlar va ovoz serveri (LiveKit)
            o&apos;zimizning serverimizda ishlaydi.
          </li>
          <li>
            Galereyadagi tayyor rasmlar Lorem Picsum va Unsplash xizmatlaridan yuklanadi. Ular
            ochilganda bu xizmatlar IP manzilingizni ko&apos;rishi mumkin.
          </li>
          <li>Barcha ulanishlar HTTPS orqali shifrlanadi.</li>
        </ul>
      </Section>

      <Section title="Xonadagi boshqa o'yinchilar">
        <p>
          Xona havolasi yoki kodi bor har kim xonaga kira oladi va ism, chat va rasmni ko&apos;radi.
          Xona egasi o&apos;yinchilarni chiqarib yuborishi va qayta kirishini taqiqlashi mumkin.
          Shaxsiy ma&apos;lumotlaringizni chatda yozmang.
        </p>
      </Section>

      <Section title="Bolalar">
        <p>
          Davradosh 13 yoshgacha bo&apos;lgan bolalarga maxsus mo&apos;ljallanmagan. Bola shaxsiy
          ma&apos;lumot qoldirgan bo&apos;lsa, bizga yozing va biz uni o&apos;chiramiz.
        </p>
      </Section>

      <Section title="Ma'lumotlarni o'chirish va aloqa">
        <p>
          Ma&apos;lumotlaringizni ko&apos;rish yoki o&apos;chirishni so&apos;rash, savol yoki
          shikoyat uchun yozing:{" "}
          <a href={`mailto:${CONTACT}`} className="font-medium text-primary hover:underline">
            {CONTACT}
          </a>
          . Murojaatlarga 30 kun ichida javob beramiz. Siyosat o&apos;zgarsa, shu sahifada
          yangilanish sanasi bilan e&apos;lon qilinadi.
        </p>
      </Section>

      <section lang="en" className="mt-16 rounded-card border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-bold">Privacy policy (English summary)</h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <p>
            Davradosh (davradosh.uz and the iOS and Android apps) needs no account, password or
            email. It uses the name, colour and avatar you choose, a random device identifier
            created on your device, game state (puzzle progress, per-player stats, mafia game
            progress), pictures you upload (all metadata, including location, is removed before they
            are stored), chat messages (puzzle chat is kept only in server memory while a room is
            open) and server logs with IP addresses, kept briefly for security and debugging.
          </p>
          <p>
            Voice and video are streamed live to the people in the room and are never recorded. The
            app asks for the microphone, camera and photos only when you use those features. There
            are no ads, no analytics or tracking, and no data is sold or shared for marketing.
          </p>
          <p>
            Puzzle rooms are deleted 7 days after they are created, mafia tables after 24 hours.
            Uploaded pictures are deleted on request. The site is hosted on Vercel; the game server,
            database, images and voice server (LiveKit) run on our own server. Gallery pictures load
            from Lorem Picsum and Unsplash. The service is not directed to children under 13.
          </p>
          <p>
            Questions and deletion requests:{" "}
            <a href={`mailto:${CONTACT}`} className="font-medium text-primary hover:underline">
              {CONTACT}
            </a>
            . Last updated: 2 October 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
