import type { Metadata } from "next";
import { CreateLoader } from "@/components/create/create-loader";

export const metadata: Metadata = {
  title: "Puzzle yaratish",
  description:
    "O'z rasmingizdan onlayn puzzle yarating: bo'laklar sonini tanlang va havolani do'stlaringizga yuboring.",
  alternates: { canonical: "/create" },
};

export default function CreatePage() {
  return <CreateLoader />;
}
