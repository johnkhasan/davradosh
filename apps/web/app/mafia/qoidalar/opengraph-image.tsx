import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Mafia qoidalari: rollar, kun va tun, ovoz berish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="📖 Davradosh · Mafia"
      title="Sport mafiasi qoidalari"
      text="Rollar, tanishuv tuni, nomzod va ovoz berish, folllar va g'alaba shartlari."
      background="linear-gradient(135deg, #0b0d24 0%, #27306b 55%, #e2725b 100%)"
      art="📖"
    />,
    size,
  );
}
