import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Sizni mafia stoliga taklif qilishdi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Invite preview for a table link shared in Telegram. */
export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="🕵️ Davradosh · Mafia"
      title="Sizni mafia stoliga chaqirishdi"
      text="Havolani oching, ismingizni yozing va stolga o'tiring."
      background="linear-gradient(135deg, #0b0d24 0%, #27306b 55%, #e2725b 100%)"
      art="🃏"
    />,
    size,
  );
}
