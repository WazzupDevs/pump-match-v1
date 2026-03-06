import { ImageResponse } from "next/og";

// Next.js App Router'da OG görseli üretmek için Edge çalışma zamanını kullanıyoruz
export const runtime = "edge";

// Standart OpenGraph Görsel Boyutları
export const alt = "PumpMatch | The Trust Layer for Solana";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: "#020617", // slate-950
          backgroundImage: "radial-gradient(circle at 80% 120%, rgba(16, 185, 129, 0.15), transparent 50%), radial-gradient(circle at 20% -20%, rgba(45, 212, 191, 0.15), transparent 50%)",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* LOGO & BRAND */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #34d399, #14b8a6)", // emerald-400 to teal-500
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "20px",
              boxShadow: "0 0 40px rgba(52, 211, 153, 0.4)",
            }}
          >
            <span style={{ fontSize: "24px" }}>⚡</span>
          </div>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 800,
              color: "#f8fafc", // slate-50
              letterSpacing: "-0.02em",
            }}
          >
            PumpMatch
          </span>
        </div>

        {/* HEADLINE */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "30px",
          }}
        >
          <span
            style={{
              fontSize: "72px",
              fontWeight: 900,
              color: "#f8fafc",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            The On-Chain
          </span>
          <span
            style={{
              fontSize: "84px",
              fontWeight: 900,
              backgroundClip: "text",
              color: "transparent",
              backgroundImage: "linear-gradient(to right, #34d399, #2dd4bf, #22d3ee)", // emerald-400 -> teal-400 -> cyan-400
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Trust Layer
          </span>
          <span
            style={{
              fontSize: "72px",
              fontWeight: 900,
              color: "#f8fafc",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            for Solana.
          </span>
        </div>

        {/* SUB-TAGLINE (Sniper Note) */}
        <div
          style={{
            display: "flex",
            fontSize: "32px",
            fontWeight: 500,
            color: "#94a3b8", // slate-400
            letterSpacing: "-0.01em",
            marginTop: "20px",
          }}
        >
          Verifiable today, immutable tomorrow.
        </div>

        {/* BOTTOM ACCENT BAR */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "linear-gradient(to right, #34d399, #2dd4bf, #22d3ee)",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}