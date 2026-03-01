import { ImageResponse } from "next/og";
import { analyzeWallet } from "@/app/actions/analyzeWallet";
import type { WalletAnalysis } from "@/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function clamp01(x: unknown) {
  const n = typeof x === "number" && Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(100, n));
}

function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "https://pumpmatch.com";
}

/**
 * Satori-safe score ring: solid stroke only (no SVG defs/linearGradient).
 */
function renderScoreRing(score: number, color: string) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="70" cy="70" r={radius} stroke="#1E293B" strokeWidth="12" />
      <circle
        cx="70"
        cy="70"
        r={radius}
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={`${offset}`}
        transform="rotate(-90 70 70)"
      />
    </svg>
  );
}

export default async function OG({ params }: { params: Promise<{ address: string }> }) {
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
            color: "#ef4444",
            fontSize: 48,
            fontFamily: "sans-serif",
            fontWeight: 800,
          }}
        >
          INVALID ADDRESS
        </div>
      ),
      size
    );
  }

  let analysis: WalletAnalysis | null = null;
  try {
    const result = await analyzeWallet(address);
    analysis = result.walletAnalysis;
  } catch {
    // Sessiz fail — analysis null kalır
  }

  const SITE_URL = getSiteUrl();
  const today = new Date().toISOString().slice(0, 10);

  const isUnavailable = !analysis;
  const trust = clamp01(analysis?.trustScore);
  const badges: string[] = analysis?.badges ?? [];
  const pump = analysis?.pumpStats ?? null;

  const isDiamond = badges.includes("diamond_hands");
  const isJeet = badges.includes("mega_jeet");
  const isRug = badges.includes("rug_magnet");

  const title = isUnavailable
    ? "DATA UNAVAILABLE"
    : isDiamond
      ? "DIAMOND HANDS 💎"
      : isJeet
        ? "MEGA JEET 🐟"
        : isRug
          ? "RUG MAGNET ☠️"
          : "ON-CHAIN PROFILE";

  const titleColor = isUnavailable ? "#64748B" : isDiamond ? "#10B981" : isJeet ? "#F43F5E" : isRug ? "#A855F7" : "#E2E8F0";

  const jeetScore = clamp01(pump?.jeetScore);
  const rugScore = clamp01(pump?.rugMagnetScore);

  // Satori-safe: sadece linear-gradient (radial-gradient kullanma)
  const background = `linear-gradient(180deg, #020617 0%, #0B1121 50%, #0f172a 100%)`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative" as const,
          display: "flex",
          flexDirection: "column",
          background,
          padding: 64,
          fontFamily: "sans-serif",
          color: "#E2E8F0",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, letterSpacing: 4, color: "#94A3B8", fontWeight: 800 }}>PUMPMATCH</div>
          <div
            style={{
              fontSize: 22,
              color: "#64748B",
              fontFamily: "monospace",
              border: "1px solid #1E293B",
              padding: "8px 16px",
              borderRadius: 12,
              background: "rgba(15,23,42,0.5)",
            }}
          >
            {address.slice(0, 6)}…{address.slice(-6)}
          </div>
        </div>

        {/* Title & Badges */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: titleColor, letterSpacing: "-0.02em" }}>{title}</div>
          {!isUnavailable && (
            <div style={{ display: "flex", gap: 12 }}>
              {badges.includes("whale") && (
                <div
                  style={{
                    background: "#3B82F633",
                    border: "1px solid #3B82F666",
                    color: "#60A5FA",
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  WHALE
                </div>
              )}
              {badges.includes("dev") && (
                <div
                  style={{
                    background: "#47556955",
                    border: "1px solid #64748B88",
                    color: "#CBD5E1",
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  BUILDER
                </div>
              )}
              {badges.includes("community_trusted") && (
                <div
                  style={{
                    background: "#EAB30833",
                    border: "1px solid #EAB30866",
                    color: "#FDE047",
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  TRUSTED
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ana İçerik Kutuları */}
        <div style={{ display: "flex", gap: 32, marginTop: 40, flex: 1 }}>
          {/* Trust Score */}
          <div
            style={{
              flex: 0.8,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(15,23,42,0.8)",
              border: `2px solid ${titleColor}33`,
              borderRadius: 32,
              padding: 32,
              position: "relative" as const,
            }}
          >
            {!isUnavailable ? (
              <>
                <div
                  style={{
                    position: "absolute" as const,
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {renderScoreRing(trust, titleColor)}
                </div>
                <div style={{ fontSize: 110, fontWeight: 900, color: "#F8FAFC", zIndex: 10 }}>{Math.round(trust)}</div>
                <div
                  style={{
                    fontSize: 20,
                    color: titleColor,
                    textTransform: "uppercase" as const,
                    letterSpacing: 2,
                    marginTop: 16,
                    fontWeight: 700,
                  }}
                >
                  Trust Score
                </div>
              </>
            ) : (
              <div style={{ fontSize: 32, color: "#64748B", fontWeight: 700 }}>NO DATA</div>
            )}
          </div>

          {/* Pump DNA */}
          <div
            style={{
              flex: 1.2,
              display: "flex",
              flexDirection: "column",
              background: "rgba(15,23,42,0.8)",
              border: `2px solid ${titleColor}33`,
              borderRadius: 32,
              padding: 40,
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: "#F8FAFC",
                fontWeight: 800,
                borderBottom: `2px solid ${titleColor}33`,
                paddingBottom: 16,
              }}
            >
              Pump.fun DNA
            </div>

            {!isUnavailable ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#CBD5E1" }}>
                    <span>Jeet Behavior</span>
                    <span style={{ color: "#F43F5E", fontWeight: 800 }}>{Math.round(jeetScore)}/100</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 16,
                      background: "#0F172A",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid #334155",
                      display: "flex",
                    }}
                  >
                    <div style={{ width: `${jeetScore}%`, height: "100%", background: "#F43F5E" }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#CBD5E1" }}>
                    <span>Rug Exposure</span>
                    <span style={{ color: "#A855F7", fontWeight: 800 }}>{Math.round(rugScore)}/100</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 16,
                      background: "#0F172A",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid #334155",
                      display: "flex",
                    }}
                  >
                    <div style={{ width: `${rugScore}%`, height: "100%", background: "#A855F7" }} />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: "1px solid #334155",
                  }}
                >
                  <div style={{ fontSize: 22, color: "#94A3B8" }}>
                    Tokens: <span style={{ color: "#F8FAFC", fontWeight: 800 }}>{pump?.pumpMintsTouched ?? 0}</span>
                  </div>
                  <div style={{ fontSize: 22, color: "#94A3B8" }}>
                    Closed: <span style={{ color: "#F8FAFC", fontWeight: 800 }}>{pump?.closedPositions ?? 0}</span>
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  fontSize: 24,
                  color: "#64748B",
                  marginTop: "auto",
                  marginBottom: "auto",
                  textAlign: "center",
                }}
              >
                Analysis data is currently unavailable.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 20, color: titleColor, opacity: 0.8, fontWeight: 600 }}>
            {SITE_URL.replace(/^https?:\/\//, "")}/profile/{address}
          </div>
          <div style={{ fontSize: 18, color: "#475569", fontFamily: "monospace" }}>
            {today}
          </div>
        </div>
      </div>
    ),
    size
  );
}
