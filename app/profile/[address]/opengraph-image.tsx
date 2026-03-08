import { ImageResponse } from "next/og";
import { analyzeWallet } from "@/app/actions/analyzeWallet";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type AnalysisResult = {
  trustScore?: number;
  scoreLabel?: string;
  badges?: string[];
  behavioral?: {
    confidenceLabel?: string;
  };
};

function clampScore(value?: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function badgeLabel(badge: string) {
  switch (badge) {
    case "diamond_hands":
      return "Diamond Hands";
    case "mega_jeet":
      return "High Churn";
    case "rug_magnet":
      return "Rug Exposure";
    case "whale":
      return "Whale";
    case "dev":
      return "Builder";
    case "og_wallet":
      return "OG Wallet";
    case "community_trusted":
      return "Community Trusted";
    default:
      return badge;
  }
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      ring: "#34d399",
      text: "#a7f3d0",
      glow: "rgba(52, 211, 153, 0.18)",
    };
  }

  if (score >= 50) {
    return {
      ring: "#f59e0b",
      text: "#fde68a",
      glow: "rgba(245, 158, 11, 0.16)",
    };
  }

  return {
    ring: "#fb7185",
    text: "#fecdd3",
    glow: "rgba(251, 113, 133, 0.16)",
  };
}

function renderRing(score: number, color: string) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="70" cy="70" r={radius} stroke="#1e293b" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={radius}
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
    </svg>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: rawAddress } = await params;
  const address = (rawAddress ?? "").trim();

  if (!BASE58_RE.test(address)) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#020617",
            color: "#f87171",
            fontSize: 42,
            fontWeight: 800,
            fontFamily: "sans-serif",
          }}
        >
          INVALID ADDRESS
        </div>
      ),
      size
    );
  }

  let analysis: AnalysisResult | null = null;

  try {
    const result = await analyzeWallet(address);
    analysis = (result?.walletAnalysis ?? null) as AnalysisResult | null;
  } catch {
    analysis = null;
  }

  const score = clampScore(analysis?.trustScore);
  const tone = scoreTone(score);
  const badges = (analysis?.badges ?? []).slice(0, 3).map(badgeLabel);
  const confidence =
    analysis?.behavioral?.confidenceLabel ??
    analysis?.scoreLabel ??
    "Public behavioral surface";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(180deg, #020617 0%, #08111f 55%, #0f172a 100%)",
          padding: "56px",
          fontFamily: "sans-serif",
          color: "#e2e8f0",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top, rgba(16,185,129,0.10), transparent 26%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.08), transparent 18%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 3,
              fontWeight: 800,
              color: "#94a3b8",
            }}
          >
            PUMPMATCH
          </div>

          <div
            style={{
              display: "flex",
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              fontSize: 18,
              color: "#cbd5e1",
              fontFamily: "monospace",
            }}
          >
            {shortenAddress(address)}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 700,
            }}
          >
            <div
              style={{
                display: "flex",
                marginBottom: 14,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 3,
                color: "#86efac",
              }}
            >
              Public Behavioral Analysis
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 62,
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: -2,
                color: "#f8fafc",
              }}
            >
              <span>Behavioral Signals</span>
              <span style={{ color: "#94a3b8" }}>for Solana</span>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 24,
                lineHeight: 1.5,
                color: "#94a3b8",
              }}
            >
              Explainable public signals for wallet behavior, visible reputation
              surfaces, and confidence-aware analysis.
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginTop: 24,
              }}
            >
              {(badges.length > 0 ? badges : ["Public Signals", "Masked Identity", confidence]).map(
                (item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      padding: "10px 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      fontSize: 16,
                      color: "#cbd5e1",
                    }}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <div
            style={{
              position: "relative",
              width: 220,
              height: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 180,
                height: 180,
                borderRadius: 999,
                background: tone.glow,
                filter: "blur(28px)",
              }}
            />
            <div style={{ position: "relative", display: "flex" }}>
              {renderRing(score, tone.ring)}
            </div>
            <div
              style={{
                position: "absolute",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 54,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: tone.text,
                }}
              >
                {score}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                Public Score
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 16,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex" }}>
            PumpMatch · Behavioral Intelligence for Solana
          </div>
          <div style={{ display: "flex" }}>{confidence}</div>
        </div>
      </div>
    ),
    size
  );
}