import { ImageResponse } from "next/og";
import type { RoomPreview } from "@/lib/api";
import { API_URL, SITE_URL } from "@/lib/env";

export const alt = "Puzzle'ni birga yig'amiz!";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadRoom(id: string): Promise<RoomPreview | null> {
  try {
    const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
    return res.ok ? ((await res.json()) as RoomPreview) : null;
  } catch {
    return null;
  }
}

/** Link preview for shared room links (Telegram, WhatsApp, …). */
export default async function RoomImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await loadRoom(id);
  const thumb = room?.image.thumbUrl;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #2b1b67 0%, #6c5ce7 55%, #00c2a8 100%)",
        padding: 56,
        gap: 48,
        alignItems: "center",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 520,
          height: 420,
          borderRadius: 32,
          overflow: "hidden",
          boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
          background: "rgba(255,255,255,0.15)",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 180,
          transform: "rotate(-3deg)",
        }}
      >
        {thumb ? (
          <img src={thumb} alt="" width={520} height={420} style={{ objectFit: "cover" }} />
        ) : (
          "🧩"
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
        <div style={{ fontSize: 34, opacity: 0.85, display: "flex" }}>
          🧩 {new URL(SITE_URL).host}
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, display: "flex" }}>
          Puzzle&apos;ni birga yig&apos;amiz!
        </div>
        {room && (
          <div style={{ display: "flex", gap: 16, fontSize: 32 }}>
            <span
              style={{
                background: "rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "10px 24px",
              }}
            >
              {room.pieces} bo&apos;lak
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "10px 24px",
              }}
            >
              {room.players}/{room.maxPlayers} o&apos;yinchi
            </span>
          </div>
        )}
        <div style={{ fontSize: 30, opacity: 0.85, display: "flex" }}>
          Havolani oching va qo&apos;shiling
        </div>
      </div>
    </div>,
    size,
  );
}
