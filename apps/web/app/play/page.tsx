import type { Metadata } from "next";
import { PlaygroundLoader } from "@/components/game/playground-loader";

export const metadata: Metadata = {
  title: "Yolg'iz mashq qilish",
  description:
    "Onlayn pazlni yolg'iz sinab ko'ring: bo'laklarni yig'ing, o'z rasmingizni yuklang, hech qanday ro'yxatdan o'tmasdan.",
  alternates: { canonical: "/play" },
};

export default function PlayPage() {
  return <PlaygroundLoader />;
}
