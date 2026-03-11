import { ImageResponse } from "next/og";
import { getLatestPublicReceipt } from "@/lib/receipts";
import {
  getPublicProfileByWallet,
  getPublicReceiptSurface,
  isValidPublicWalletAddress,
  normalizePublicWalletAddress,
} from "@/lib/public-intelligence";

export const runtime = "nodejs";
export const alt = "PumpMatch Public Intelligence";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function baseCard(children: React.ReactNode) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background:
          "radial-gradient(circle at top, rgba(16,185,129,0.10), transparent 24%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.08), transparent 18%), radial-gradient(circle at 50% 100%, rgba(34,211,238,0.06), transparent 20%), #020617",
        color: "#f8fafc",
        padding: 48,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          borderRadius: 28,
          border: "1px solid rgba(148,163,184,0.18)",
          background: "rgba(15,23,42,0.72)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
          padding: 36,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function clampScore(value?: number | null) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

function toneColor(score: number) {
  if (score >= 80) return "#6ee7b7";
  if (score >= 50) return "#fcd34d";
  return "#fda4af";
}

function renderGenericCard(title: string, subtitle: string) {
  return new ImageResponse(
    baseCard(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(52,211,153,0.85)",
              fontWeight: 700,
            }}
          >
            PumpMatch
          </div>
          <div
            style={{
              fontSize: 52,
              lineHeight: 1.05,
              fontWeight: 800,
              maxWidth: 860,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 24,
              lineHeight: 1.5,
              color: "rgba(226,232,240,0.78)",
              maxWidth: 860,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 20,
            color: "rgba(148,163,184,0.85)",
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            <span>Behavioral Intelligence for Solana</span>
          </div>
          <div>Canonical share is via receipt link</div>
        </div>
      </div>
    ),
    size,
  );
}

function renderReceiptCard(receipt: Awaited<ReturnType<typeof getPublicReceiptSurface>> extends infer T
  ? T extends null
    ? never
    : T
  : never) {
  const trustScore = clampScore(receipt.trustScore);
  const color = toneColor(trustScore);

  return new ImageResponse(
    baseCard(
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(52,211,153,0.85)",
                fontWeight: 700,
              }}
            >
              Public Intelligence Receipt
            </div>

            <div
              style={{
                fontSize: 26,
                color: "rgba(148,163,184,0.9)",
                fontWeight: 600,
              }}
            >
              {shortenAddress(receipt.walletAddress)}
            </div>

            <div
              style={{
                fontSize: 54,
                lineHeight: 1.05,
                fontWeight: 800,
                maxWidth: 720,
              }}
            >
              {receipt.intelligenceSummary.primaryStyle || "Visible Intelligence"}
            </div>

            <div
              style={{
                fontSize: 24,
                lineHeight: 1.4,
                color: "rgba(226,232,240,0.88)",
                fontWeight: 600,
              }}
            >
              {receipt.intelligenceSummary.scoreLabel}
            </div>

            <div
              style={{
                fontSize: 22,
                lineHeight: 1.45,
                color: "rgba(203,213,225,0.76)",
                maxWidth: 720,
              }}
            >
              {receipt.intelligenceSummary.summary}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(34,211,238,0.25)",
                background: "rgba(6,182,212,0.10)",
                color: "#bae6fd",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Confidence {receipt.intelligenceConfidence.tier}
            </div>

            <div
              style={{
                display: "flex",
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(30,41,59,0.75)",
                color: "#cbd5e1",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Sample {receipt.intelligenceConfidence.sampleSize}
            </div>
          </div>
        </div>

        <div
          style={{
            width: 250,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "rgba(148,163,184,0.85)",
              textAlign: "right",
            }}
          >
            Compatibility Public Score
          </div>
          <div
            style={{
              fontSize: 120,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-0.06em",
              color,
            }}
          >
            {trustScore}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(148,163,184,0.85)",
              textAlign: "right",
            }}
          >
            Canonical public share
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function renderProfileCard(profile: Awaited<ReturnType<typeof getPublicProfileByWallet>> extends infer T
  ? T extends { ok: true; profile: infer P }
    ? P
    : never
  : never) {
  const trustScore = clampScore(profile.trustScore);
  const color = toneColor(trustScore);

  return new ImageResponse(
    baseCard(
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(52,211,153,0.85)",
                fontWeight: 700,
              }}
            >
              Public Intelligence Preview (staged fallback)
            </div>

            <div
              style={{
                fontSize: 26,
                color: "rgba(148,163,184,0.9)",
                fontWeight: 600,
              }}
            >
              {shortenAddress(profile.address)}
            </div>

            <div
              style={{
                fontSize: 54,
                lineHeight: 1.05,
                fontWeight: 800,
                maxWidth: 720,
              }}
            >
              {profile.intelligenceSummary?.primaryStyle ?? "Visible Intelligence"}
            </div>

            <div
              style={{
                fontSize: 24,
                lineHeight: 1.4,
                color: "rgba(226,232,240,0.88)",
                fontWeight: 600,
              }}
            >
              {profile.intelligenceSummary?.scoreLabel ?? "Public intelligence surface"}
            </div>

            <div
              style={{
                fontSize: 22,
                lineHeight: 1.45,
                color: "rgba(203,213,225,0.76)",
                maxWidth: 720,
              }}
            >
              {profile.intelligenceSummary?.summary ??
                "Persisted public intelligence for this wallet is available on PumpMatch."}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 24 }}>
            {profile.intelligenceConfidence ? (
              <>
                <div
                  style={{
                    display: "flex",
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,211,238,0.25)",
                    background: "rgba(6,182,212,0.10)",
                    color: "#bae6fd",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Confidence {profile.intelligenceConfidence.tier}
                </div>

                <div
                  style={{
                    display: "flex",
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.22)",
                    background: "rgba(30,41,59,0.75)",
                    color: "#cbd5e1",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Sample {profile.intelligenceConfidence.sampleSize}
                </div>
              </>
            ) : null}

            {profile.behavioral?.evidenceSources ? (
              <div
                style={{
                  display: "flex",
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(16,185,129,0.24)",
                  background: "rgba(16,185,129,0.10)",
                  color: "#bbf7d0",
                  fontSize: 18,
                  fontWeight: 700,
                  maxWidth: 420,
                }}
              >
                Evidence {profile.behavioral.evidenceSources}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            width: 250,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "rgba(148,163,184,0.75)",
              textAlign: "right",
            }}
          >
            Compatibility (transitional)
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-0.06em",
              color,
            }}
          >
            {trustScore}
          </div>
          <div
            style={{
              fontSize: 16,
              color: "rgba(148,163,184,0.75)",
              textAlign: "right",
            }}
          >
            Staged fallback when no receipt shared
          </div>
        </div>
      </div>
    ),
    size,
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: rawAddress } = await params;
  const address = normalizePublicWalletAddress(rawAddress);

  if (!isValidPublicWalletAddress(address)) {
    return renderGenericCard(
      "Invalid address",
      "PumpMatch public intelligence preview requires a valid Solana wallet address. Canonical share is via receipt link.",
    );
  }

  const latestReceipt = await getLatestPublicReceipt(address);
  if (latestReceipt) {
    const receipt = await getPublicReceiptSurface(latestReceipt.shareId);
    if (receipt) {
      return renderReceiptCard(receipt);
    }
  }

  const result = await getPublicProfileByWallet(address);

  if (!result.ok) {
    return renderGenericCard(
      "Public intelligence unavailable",
      "No public receipt or staged profile for this wallet. Publish a receipt for the canonical share.",
    );
  }

  return renderProfileCard(result.profile);
}