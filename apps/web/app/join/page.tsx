import type { Metadata } from "next";
import { JoinByCode } from "@/components/landing/join-by-code";

export const metadata: Metadata = {
  title: "Xonaga qo'shilish",
  description:
    "Do'stingiz yuborgan 4 xonali kod bilan puzzle xonasiga yoki mafia stoliga qo'shiling.",
  alternates: { canonical: "/join" },
};

/** `/join?code=1234` fills the field in, handy for sharing the code as a link. */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;
  return <JoinByCode initialCode={typeof code === "string" ? code : ""} />;
}
