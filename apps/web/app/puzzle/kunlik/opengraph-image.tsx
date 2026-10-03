import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Kunlik puzzle: har kuni yangi pazl";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="🗓️ Davradosh · Kunlik puzzle"
      title="Har kuni yangi puzzle"
      text="Hamma uchun bitta rasm. Tezroq yig'ing va kunlik reytingga chiqing."
      background="linear-gradient(135deg, #2b1b67 0%, #6c5ce7 55%, #00b894 100%)"
      art="🧩"
    />,
    size,
  );
}
