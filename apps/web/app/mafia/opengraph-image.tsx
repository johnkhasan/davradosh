import { MAFIA_MAX_PLAYERS, MAFIA_MIN_PLAYERS } from "@puzzle/shared/mafia";
import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

export const alt = "Mafia onlayn: do'stlar bilan ovozli sport mafiasi";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="🕵️ Davradosh · Mafia"
      title="Onlayn mafia do'stlar bilan"
      text={`${MAFIA_MIN_PLAYERS}–${MAFIA_MAX_PLAYERS} kishilik stol, ovozli chat va avtomatik boshlovchi.`}
      background="linear-gradient(135deg, #0b0d24 0%, #27306b 55%, #e2725b 100%)"
      art="🌙"
    />,
    size,
  );
}
