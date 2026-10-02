import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Davradosh: do'stlar bilan onlayn o'yinlar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for the site itself (search results, Telegram, social networks). */
export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="davradosh.uz · bepul"
      title="Do'stlar bilan onlayn o'yinlar"
      text="Puzzle va mafia: havolani ulashing va davrangiz bilan birga o'ynang."
      background="linear-gradient(135deg, #1c1a24 0%, #4b3bc9 60%, #e84393 100%)"
      art="🎲"
    />,
    size,
  );
}
