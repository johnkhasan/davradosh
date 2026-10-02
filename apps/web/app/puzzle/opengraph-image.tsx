import { ImageResponse } from "next/og";
import { MAX_PLAYERS_PER_ROOM } from "@puzzle/shared";

export const alt = "Pazl onlayn: do'stlar bilan birga puzzle yig'ing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PIECES = [
  { color: "#6C5CE7", x: 0, y: 0 },
  { color: "#00C2A8", x: 1, y: 0 },
  { color: "#E84393", x: 0, y: 1 },
  { color: "#FFB020", x: 1, y: 1 },
];

/** Link preview for the site itself (search results, Telegram, social networks). */
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 64,
        padding: 72,
        background: "linear-gradient(135deg, #2b1b67 0%, #6c5ce7 60%, #00c2a8 100%)",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", width: 340, height: 340, gap: 14 }}>
        {PIECES.map((piece) => (
          <div
            key={piece.color}
            style={{
              width: 163,
              height: 163,
              borderRadius: 32,
              background: piece.color,
              boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
              transform: `rotate(${(piece.x - piece.y) * 4}deg)`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 34, opacity: 0.85 }}>🧩 Pazl onlayn · bepul</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 18 }}>
          Puzzle&apos;ni birga yig&apos;amiz
        </div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.9, lineHeight: 1.35 }}>
          {`Rasm tanlang, havolani ulashing va ${MAX_PLAYERS_PER_ROOM} kishigacha do'stlaringiz bilan real vaqtda yig'ing.`}
        </div>
      </div>
    </div>,
    size,
  );
}
