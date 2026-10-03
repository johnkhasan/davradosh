import { TABLE_GAMES } from "@puzzle/shared/games";
import { ImageResponse } from "next/og";
import { OgCard } from "@/components/site/og-card";

const game = TABLE_GAMES.uno;

export const alt = "Uno onlayn: do'stlar bilan karta o'yini";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <OgCard
      kicker="🃏 Davradosh · Uno"
      title="Uno onlayn do'stlar bilan"
      text={`${game.minPlayers}–${game.maxPlayers} kishilik karta o'yini: rangni moslang, +4 qo'ying va «Uno!» deng.`}
      background="linear-gradient(135deg, #e5484d 0%, #f2b51b 35%, #2f9e62 68%, #3b74f0 100%)"
      art="🃏"
    />,
    size,
  );
}
