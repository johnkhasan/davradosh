import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Dengiz jangi onlayn: do'stlar bilan o'ynash";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="🚢 Davradosh · Dengiz jangi"
      title="Dengiz jangi onlayn"
      text="Kemalarni joylashtiring, do'stingizga havola yuboring va raqib flotini cho'ktiring."
      background="linear-gradient(135deg, #0b2545 0%, #13597a 55%, #2f8fe0 100%)"
      art="⚓"
    />,
    size,
  );
}
