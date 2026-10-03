import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Shashka onlayn: do'stlar bilan shashka o'ynash";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="⚫ Davradosh · Shashka"
      title="Onlayn shashka do'stlar bilan"
      text="Rus shashkasi: majburiy urish, ketma-ket urishlar va uchar damka. Havolani yuboring va o'ynang."
      background="linear-gradient(135deg, #1b362f 0%, #2f5d50 55%, #8a5a33 100%)"
      art="👑"
    />,
    size,
  );
}
