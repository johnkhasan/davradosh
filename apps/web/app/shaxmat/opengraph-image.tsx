import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Shaxmat onlayn: do'stlar bilan shaxmat o'ynash";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="♟️ Davradosh · Shaxmat"
      title="Do'stlar bilan onlayn shaxmat"
      text="Havolani yuboring va o'ynang: shaxmat soati, durang taklifi va chat. Ro'yxatdan o'tmasdan."
      background="linear-gradient(135deg, #3b2a1e 0%, #8a5f3f 50%, #6c5ce7 100%)"
      art="♟️"
    />,
    size,
  );
}
