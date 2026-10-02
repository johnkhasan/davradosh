const DOTS = ["#6C5CE7", "#00B894", "#E84393", "#FDAA2C", "#0984E3", "#E17055"];

/** Link-preview layout shared by the Davradosh pages (rendered by next/og, so inline styles only). */
export function OgCard({
  kicker,
  title,
  text,
  background,
  art,
}: {
  kicker: string;
  title: string;
  text: string;
  background: string;
  art: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 64,
        padding: 72,
        background,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: 340,
          height: 340,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 150,
        }}
      >
        {DOTS.map((color, i) => {
          const a = (i / DOTS.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={color}
              style={{
                position: "absolute",
                left: 170 + Math.cos(a) * 140 - 34,
                top: 170 + Math.sin(a) * 140 - 34,
                width: 68,
                height: 68,
                borderRadius: 34,
                background: color,
                border: "5px solid white",
              }}
            />
          );
        })}
        {art}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 34, opacity: 0.85 }}>{kicker}</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 18 }}>
          {title}
        </div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.9, lineHeight: 1.35 }}>{text}</div>
      </div>
    </div>
  );
}
